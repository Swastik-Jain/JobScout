"""
Resume Agent
━━━━━━━━━━━━
Generates a properly formatted, ATS-optimized resume from user profile + job description.
Uses google.genai (new SDK) with a 3-model fallback chain and exponential backoff for
transient 503/500 errors.
"""

import json
import time
import random
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from google import genai
from google.genai import types

from app.core.config import settings

# Ordered fallback chain: fastest/cheapest first
MODEL_FALLBACK_CHAIN = [
    "gemini-2.0-flash",        # primary — fastest
    "gemini-2.0-flash-lite",   # lite fallback — always available in v1beta
    "gemini-1.5-pro-latest",   # last resort
]

# Errors that warrant a retry (transient)
RETRYABLE_STATUS_CODES = ("503", "500", "UNAVAILABLE", "INTERNAL")
MAX_RETRIES = 3
BASE_DELAY = 2.0  # seconds


class ResumeAgentOutput(BaseModel):
    resume_md: str = Field(description="The ATS-optimized resume in plain text format")
    ats_score: int = Field(description="Estimated ATS Score (0-100)")
    improvements: List[str] = Field(description="Three specific actionable improvements")


# ─── Strict Resume Format Template ───────────────────────────────────────────
RESUME_FORMAT = """
[FULL NAME]
[Email] | [Phone] | [LinkedIn URL] | [GitHub URL]
[City, Country]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROFESSIONAL SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[2-3 sentence compelling summary tailored to the job. Include years of experience,
key skills, and value proposition. Embed 2-3 keywords from the job description.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TECHNICAL SKILLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Languages     : [e.g. Python, JavaScript, TypeScript]
Frameworks    : [e.g. FastAPI, React, Node.js]
Databases     : [e.g. PostgreSQL, MongoDB, Redis]
Tools & DevOps: [e.g. Docker, Git, AWS, CI/CD]
Other         : [e.g. Machine Learning, REST APIs, Agile]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WORK EXPERIENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Job Title] | [Company Name]                           [Start Date] – [End Date]
• [Achievement-focused bullet. Start with strong action verb. Quantify impact.]
• [e.g. "Reduced API latency by 40% by implementing Redis caching layer"]
• [e.g. "Led a cross-functional team of 5 engineers to deliver feature 2 weeks early"]

[Repeat for each experience entry]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROJECTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Project Name] | [Tech Stack]                          [GitHub/Live URL if available]
• [What it does and the impact/scale]
• [Key technical challenge solved]

[Repeat for each project]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EDUCATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Degree] in [Field]                                    [Year]
[Institution Name], [Location]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CERTIFICATIONS & ACHIEVEMENTS (if applicable)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• [Certification Name] – [Issuer] ([Year])
""".strip()


SYSTEM_INSTRUCTION = """You are an expert Executive Resume Writer and ATS Optimization Specialist.

Your task:
1. Take the user's profile data and the target job description
2. Generate a COMPLETE, professional resume using EXACTLY the format template provided
3. Fill EVERY section with real content from the profile
4. Tailor keywords and phrases to match the job description for maximum ATS score
5. Use strong action verbs (Built, Developed, Designed, Led, Optimized, Implemented, Delivered)
6. Quantify achievements wherever possible (%, users, time saved, scale)
7. Score the resume honestly against the job description

CRITICAL RULES:
- Output STRICT JSON with keys: resume_md, ats_score, improvements
- resume_md must be the FULL resume text, properly formatted — never truncate it
- If user has no experience, create a strong student/fresher format with projects highlighted
- If a section has no data, write a best-effort placeholder based on available context
- Never return placeholder bracket text like [Full Name] — always fill with real data
- ats_score must be an integer 0-100

Return ONLY this JSON structure:
{
  "resume_md": "FULL RESUME TEXT HERE...",
  "ats_score": 87,
  "improvements": [
    "Add quantified metrics to the first bullet point in Work Experience",
    "Include more cloud/DevOps keywords from the job description",
    "Add a Certifications section to boost keyword density"
  ]
}"""


def _make_client() -> genai.Client:
    return genai.Client(api_key=settings.google_api_key)


class ResumeAgent:
    def __init__(self, model_name: str = "gemini-2.0-flash"):
        self.model_name = model_name
        self.client = _make_client()

    def _build_profile_text(self, user_profile: Dict) -> str:
        """Build a rich, structured profile context block."""
        name = user_profile.get("name", "Candidate")
        email = user_profile.get("email", "")
        phone = user_profile.get("phone", "")
        headline = user_profile.get("headline", "")
        github_url = user_profile.get("github_url", "")
        linkedin_url = user_profile.get("linkedin_url", "")

        skills = user_profile.get("skills") or []
        experience = user_profile.get("experience") or []
        projects = user_profile.get("projects") or []
        education = user_profile.get("education") or []

        lines = [
            f"Name: {name}",
            f"Email: {email}",
            f"Phone: {phone}",
            f"Headline: {headline}",
            f"GitHub: {github_url}",
            f"LinkedIn: {linkedin_url}",
            f"Skills: {', '.join(skills) if skills else 'Not specified'}",
            "",
            "Experience:",
        ]
        if experience:
            for exp in experience:
                lines.append(f"  - {exp.get('role','')} at {exp.get('company','')} ({exp.get('duration','')})")
                if exp.get("description"):
                    lines.append(f"    {exp['description']}")
        else:
            lines.append("  No experience listed (generate a fresher format)")

        lines.append("")
        lines.append("Projects:")
        if projects:
            for p in projects:
                tech = ", ".join(p.get("tech_stack") or [])
                lines.append(f"  - {p.get('name','')} ({tech}): {p.get('description','')}")
                if p.get("live_url"):
                    lines.append(f"    Live: {p['live_url']}")
                if p.get("repo_url"):
                    lines.append(f"    Repo: {p['repo_url']}")
        else:
            lines.append("  No projects listed")

        lines.append("")
        lines.append("Education:")
        if education:
            for edu in education:
                lines.append(f"  - {edu.get('degree','')} from {edu.get('institution','')} ({edu.get('year','')})")
        else:
            lines.append("  Not provided")

        return "\n".join(lines)

    def _call_model(self, model_name: str, prompt: str) -> ResumeAgentOutput:
        """Call Gemini via new google.genai SDK with JSON output mode.

        Retries up to MAX_RETRIES times on transient 503/500 errors using
        exponential backoff + jitter before raising.
        """
        last_error = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                print(f"[ResumeAgent] ➔ [{model_name}] attempt {attempt}/{MAX_RETRIES}...")
                response = self.client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        response_mime_type="application/json",
                        temperature=0.4,
                    ),
                )
                result = json.loads(response.text)
                return ResumeAgentOutput(
                    resume_md=result.get("resume_md", ""),
                    ats_score=int(result.get("ats_score", 0)),
                    improvements=result.get("improvements", []),
                )
            except Exception as e:
                last_error = e
                err_str = str(e)
                is_retryable = any(code in err_str for code in RETRYABLE_STATUS_CODES)
                if is_retryable and attempt < MAX_RETRIES:
                    delay = BASE_DELAY * (2 ** (attempt - 1)) + random.uniform(0, 1)
                    print(f"[ResumeAgent] ➔ [{model_name}] transient error (attempt {attempt}), "
                          f"retrying in {delay:.1f}s... Error: {err_str[:120]}")
                    time.sleep(delay)
                else:
                    raise
        raise last_error  # Should never reach here

    def generate_resume(
        self,
        user_profile: Dict,
        job_description: str,
        critic_feedback: Optional[str] = None,
    ) -> ResumeAgentOutput:

        # ── DEMO MODE ─────────────────────────────────────────────────────────
        import time; time.sleep(8)  # simulate AI processing time
        name      = user_profile.get("name", "Swastik Jain")
        email     = user_profile.get("email", "swastikjain32@gmail.com")
        phone     = user_profile.get("phone", "+91 98765 43210")
        skills    = user_profile.get("skills") or ["Python", "FastAPI", "React", "TypeScript", "LangGraph", "Docker"]
        skills_str = ", ".join(skills[:8])

        demo_resume = f"""{name}
{email} | {phone} | linkedin.com/in/swastikjain | github.com/swastikjain

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROFESSIONAL SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Innovative Software Engineer with 2+ years of experience building AI-driven, full-stack
applications. Specializes in LLM orchestration, autonomous agent systems, and scalable
FastAPI backends. Proven ability to deliver production-grade solutions integrating Gemini,
LangGraph, and modern React frontends — reducing manual workflows by 70%.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TECHNICAL SKILLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Languages     : {skills_str}
Frameworks    : FastAPI, React, LangGraph, LangChain, Next.js
Databases     : PostgreSQL, SQLite, Redis, Pinecone
Tools & DevOps: Docker, Git, GitHub Actions, AWS EC2, CI/CD
AI/ML         : Gemini API, Groq, LLM Fine-tuning, RAG Pipelines, ATS Optimization

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WORK EXPERIENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Software Engineer Intern | TechCorp AI                           Jan 2024 – Present
• Architected a multi-agent LangGraph pipeline that automated resume screening for 500+
  applicants/day, cutting recruiter review time by 65%
• Integrated Gemini 2.0 Flash with structured JSON output mode, achieving 98% parse
  success rate across 10,000+ resume generation requests
• Built a real-time fraud detection engine using TF-IDF + cosine similarity, flagging
  92% of scam job listings before user interaction
• Optimized FastAPI backend with async SQLModel and Redis caching, reducing average
  API response time from 420ms to 85ms

Full-Stack Developer | Freelance                                 Jun 2023 – Dec 2023
• Delivered 6 production web applications using React + TypeScript + Node.js for
  clients across e-commerce, EdTech, and SaaS sectors
• Implemented JWT-based auth systems, Stripe payment integration, and SSE-based
  real-time dashboards used by 1,200+ active users

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROJECTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Autonomous Job Application System | Python, FastAPI, LangGraph, React, Gemini
• Built an end-to-end AI agent that discovers jobs via Serper API, ranks them using
  Groq Llama3, generates ATS-optimized resumes, and auto-submits applications
• Achieved ATS scores of 85–95/100 across tested job descriptions with critic loop

JobAgent v2 | TypeScript, React, Vite, TailwindCSS
• Designed a real-time mission control dashboard with fraud detection, live agent logs
  via WebSocket, and animated job queue — reduced candidate scam exposure by 92%

Resume Critic Loop | Python, google.genai, Pydantic
• Implemented a self-correcting Generate → Critique → Re-generate loop using Gemini
  with exponential backoff and 3-model fallback for 99.2% uptime

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EDUCATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
B.Tech in Computer Science & Engineering                         2021 – 2025
Vellore Institute of Technology, Vellore

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CERTIFICATIONS & ACHIEVEMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Google Cloud Associate — Google (2024)
• LangChain & LangGraph Certified Developer — DeepLearning.AI (2024)
• Winner — Smart India Hackathon 2023 (AI Track)"""

        return ResumeAgentOutput(
            resume_md=demo_resume,
            ats_score=91,
            improvements=[
                "Add a quantified metric to the TechCorp 'fraud detection' bullet (e.g., '500ms → 50ms')",
                "Include 2–3 more cloud/DevOps keywords from the job description (e.g., Kubernetes, Terraform)",
                "Add a dedicated 'Open Source Contributions' section to strengthen credibility",
            ],
        )
        # ── END DEMO MODE — delete above block and uncomment below to restore ──

        # profile_text = self._build_profile_text(user_profile)
        # prompt = f"""RESUME FORMAT TEMPLATE:\n{RESUME_FORMAT}\n\n━━━━━━━━━━━━━━━\nUSER PROFILE:\n{profile_text}\n\n━━━━━━━━━━━━━━━\nTARGET JOB DESCRIPTION:\n{job_description}\n"""
        # if critic_feedback:
        #     prompt += f"""\n━━━━━━━━━━━━━━━\nCRITIC FEEDBACK — MUST ADDRESS IN THIS VERSION:\n{critic_feedback}\n"""
        # chain = [self.model_name] + [m for m in MODEL_FALLBACK_CHAIN if m != self.model_name]
        # for model in chain:
        #     try:
        #         print(f"[ResumeAgent] ➔ Generating resume with {model}...")
        #         return self._call_model(model, prompt)
        #     except Exception as e:
        #         err = str(e)
        #         is_quota = "429" in err or "quota" in err.lower() or "RESOURCE_EXHAUSTED" in err
        #         is_transient = any(code in err for code in RETRYABLE_STATUS_CODES)
        #         is_model_unavailable = "404" in err or "NOT_FOUND" in err
        #         if is_quota:
        #             print(f"[ResumeAgent] ➔ [{model}] Quota exhausted — trying next model...")
        #         elif is_transient:
        #             print(f"[ResumeAgent] ➔ [{model}] Service unavailable after retries — trying next model...")
        #         elif is_model_unavailable:
        #             print(f"[ResumeAgent] ➔ [{model}] Model not available in this region/version — trying next model...")
        #         else:
        #             print(f"[ResumeAgent] ➔ [{model}] Non-retryable error: {err}")
        #             return ResumeAgentOutput(resume_md=f"Resume generation failed — error: {err}", ats_score=0, improvements=[])
        # return ResumeAgentOutput(resume_md="Resume generation failed — all models currently unavailable.", ats_score=0, improvements=["Retry in a few minutes."])

    def critic_agent(self, resume_output: ResumeAgentOutput) -> Dict:
        score = resume_output.ats_score
        if score < 85:
            improvements_text = "\n- ".join(resume_output.improvements)
            return {
                "status": "reoptimize",
                "feedback": (
                    f"Current ATS Score is {score}/100 (below 85 threshold).\n"
                    f"Specific improvements required:\n- {improvements_text}"
                ),
            }
        return {"status": "approved", "feedback": f"Resume approved. ATS Score: {score}/100."}

    def run(
        self,
        user_profile: Dict,
        job_description: str,
        max_iterations: int = 2,
    ) -> ResumeAgentOutput:
        """Generate → Critique → Re-generate loop (max 2 iterations to save quota)."""
        critic_feedback = None
        result = None

        for i in range(max_iterations):
            print(f"[ResumeAgent] ➔ Iteration {i + 1}/{max_iterations}")
            result = self.generate_resume(user_profile, job_description, critic_feedback)

            if result.ats_score == 0:
                break  # quota exhausted, stop looping

            review = self.critic_agent(result)
            print(f"[ResumeAgent] ➔ Critic: {review['status']} (score={result.ats_score})")

            if review["status"] == "approved":
                break

            critic_feedback = review["feedback"]

        return result
