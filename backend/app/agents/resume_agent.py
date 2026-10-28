import logging
logger = logging.getLogger("jobscout.resume_agent")
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
import asyncio
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from google import genai
from google.genai import types

from app.core.config import settings
from app.services.resume_validator import (
    render_deterministic_base_resume,
    validate_no_fabrication,
    compute_ats_score,
)

# Ordered fallback chain from centralized settings
MODEL_FALLBACK_CHAIN = settings.gemini_model_chain

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
- NO FABRICATION (STRICT): NEVER invent, assume, or hallucinate employers, companies, universities, degrees, or projects not in the user profile. You may only reword and emphasize action verbs and keywords under existing verified entries.
- Output STRICT JSON with keys: resume_md, ats_score, improvements
- resume_md must be the FULL resume text, properly formatted — never truncate it
- If user has no experience, create a strong student/fresher format with projects highlighted
- If a section has no data, leave it empty or omitted — never invent data
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


def _make_client() -> Optional[genai.Client]:
    if not settings.google_api_key:
        return None
    try:
        return genai.Client(api_key=settings.google_api_key)
    except Exception as e:
        logger.warning(f"[ResumeAgent] Warning: could not initialize Gemini client: {e}")
        return None


class ResumeAgent:
    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or settings.gemini_primary_model
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

    async def _call_model_async(self, model_name: str, prompt: str) -> ResumeAgentOutput:
        """Call Gemini via new google.genai async client without blocking event loop."""
        last_error = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                logger.info(f"[ResumeAgent] ➔ [{model_name}] attempt {attempt}/{MAX_RETRIES} (async)...")
                response = await self.client.aio.models.generate_content(
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
                    logger.warning(f"[ResumeAgent] ➔ [{model_name}] transient error (attempt {attempt}), ")
                          f"retrying in {delay:.1f}s... Error: {err_str[:120]}")
                    await asyncio.sleep(delay)
                else:
                    raise
        if last_error is not None:
            raise last_error
        raise RuntimeError(f"Failed to generate resume with {model_name}")

    async def a_generate_resume(
        self,
        user_profile: Dict,
        job_description: str,
        critic_feedback: Optional[str] = None,
    ) -> ResumeAgentOutput:
        """Asynchronous, non-blocking resume generation."""
        profile_text = self._build_profile_text(user_profile)
        prompt = (
            f"RESUME FORMAT TEMPLATE:\n{RESUME_FORMAT}\n\n"
            f"━━━━━━━━━━━━━━━\nUSER PROFILE:\n{profile_text}\n\n"
            f"━━━━━━━━━━━━━━━\nTARGET JOB DESCRIPTION:\n{job_description}\n"
        )
        if critic_feedback:
            prompt += (
                f"\n━━━━━━━━━━━━━━━\n"
                f"CRITIC FEEDBACK — MUST ADDRESS IN THIS VERSION:\n{critic_feedback}\n"
            )
        base_resume = render_deterministic_base_resume(user_profile)
        user_skills = user_profile.get("skills") or []

        if not self.client:
            logger.info("[ResumeAgent] ➔ Gemini API key not configured — using deterministic baseline resume.")
            fallback_ats, _ = compute_ats_score(base_resume, job_description, user_skills)
            return ResumeAgentOutput(
                resume_md=base_resume,
                ats_score=fallback_ats,
                improvements=["Gemini API key not configured — served verified deterministic baseline resume."],
            )

        chain = [self.model_name] + [m for m in MODEL_FALLBACK_CHAIN if m != self.model_name]
        for model in chain:
            try:
                logger.info(f"[ResumeAgent] ➔ Generating resume with {model}...")
                out = await self._call_model_async(model, prompt)
                
                # Enforce no fabrication on the generated resume
                is_valid, errors = validate_no_fabrication(out.resume_md, user_profile)
                if not is_valid:
                    logger.warning(f"[ResumeAgent] ➔ Anti-fabrication flagged: {errors}. Preserving verified profile."))
                    out.resume_md = base_resume
                    out.improvements.append("Reverted unverified modifications to preserve strict candidate accuracy.")

                # Guarantee realistic ATS score
                if out.ats_score <= 0:
                    ats_score, _ = compute_ats_score(out.resume_md, job_description, user_skills)
                    out.ats_score = ats_score

                return out
            except Exception as e:
                err = str(e)
                is_quota = "429" in err or "quota" in err.lower() or "RESOURCE_EXHAUSTED" in err
                is_transient = any(code in err for code in RETRYABLE_STATUS_CODES)
                is_model_unavailable = "404" in err or "NOT_FOUND" in err
                if is_quota:
                    logger.warning(f"[ResumeAgent] ➔ [{model}] Quota exhausted — trying next model..."))
                elif is_transient:
                    logger.warning(f"[ResumeAgent] ➔ [{model}] Service unavailable after retries — trying next model..."))
                elif is_model_unavailable:
                    logger.warning(f"[ResumeAgent] ➔ [{model}] Model not available in this region/version — trying next model..."))
                else:
                    logger.error(f"[ResumeAgent] ➔ [{model}] Non-retryable error: {err}")
                    ats_score, _ = compute_ats_score(base_resume, job_description, user_skills)
                    return ResumeAgentOutput(
                        resume_md=base_resume,
                        ats_score=ats_score,
                        improvements=[f"LLM error: {err} — served verified baseline resume."],
                    )

        fallback_ats, _ = compute_ats_score(base_resume, job_description, user_skills)
        return ResumeAgentOutput(
            resume_md=base_resume,
            ats_score=fallback_ats,
            improvements=["AI generation quota reached — served verified deterministic baseline resume."],
        )

    def generate_resume(
        self,
        user_profile: Dict,
        job_description: str,
        critic_feedback: Optional[str] = None,
    ) -> ResumeAgentOutput:
        """Synchronous compatibility wrapper using thread pool to avoid loop blocking."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                    return pool.submit(
                        asyncio.run,
                        self.a_generate_resume(user_profile, job_description, critic_feedback)
                    ).result()
            return loop.run_until_complete(
                self.a_generate_resume(user_profile, job_description, critic_feedback)
            )
        except Exception:
            return asyncio.run(
                self.a_generate_resume(user_profile, job_description, critic_feedback)
            )

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
            logger.info(f"[ResumeAgent] ➔ Iteration {i + 1}/{max_iterations}")
            result = self.generate_resume(user_profile, job_description, critic_feedback)

            if result.ats_score == 0:
                break  # quota exhausted, stop looping

            review = self.critic_agent(result)
            logger.info(f"[ResumeAgent] ➔ Critic: {review['status']} (score={result.ats_score})")

            if review["status"] == "approved":
                break

            critic_feedback = review["feedback"]

        return result
