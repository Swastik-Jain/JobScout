import logging
logger = logging.getLogger("jobscout.resume_agent")
"""
Resume Agent
━━━━━━━━━━━━
Generates a properly formatted, ATS-optimized resume from user profile + job description.
Uses google.genai (new SDK) with a 3-model fallback chain and exponential backoff for
transient 503/500 errors.
"""

import re
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

from app.schemas.resume_schema import (
    ResumeData,
    render_plain_text,
    build_deterministic_resume_data,
)

# Ordered fallback chain from centralized settings
MODEL_FALLBACK_CHAIN = settings.gemini_model_chain

# Errors that warrant a retry (transient)
RETRYABLE_STATUS_CODES = ("503", "500", "UNAVAILABLE", "INTERNAL")
MAX_RETRIES = 3
BASE_DELAY = 2.0  # seconds

BANNED_PHRASES = [
    "demonstrating expertise",
    "showcasing",
    "robust",
    "cutting-edge",
    "state-of-the-art",
    "seamless",
    "leveraging",
    "passionate",
    "results-driven",
    "hands-on experience",
    "spearheaded",
    "utilized",
]


def find_banned_phrases(resume: ResumeData) -> List[str]:
    """Find banned phrases in summary and all bullets (case-insensitive)."""
    hits: List[str] = []
    texts: List[str] = []
    if resume.summary:
        texts.append(resume.summary)
    for exp in resume.experience:
        texts.extend(exp.bullets)
    for proj in resume.projects:
        texts.extend(proj.bullets)

    for t in texts:
        for phrase in BANNED_PHRASES:
            pattern = r'(?<![a-zA-Z0-9])' + re.escape(phrase) + r'(?![a-zA-Z0-9])'
            if re.search(pattern, t, re.IGNORECASE):
                hits.append(f"Contains banned phrase '{phrase}'.")
    return hits


class ResumeAgentOutput(BaseModel):
    resume_data: Optional[ResumeData] = None
    resume_md: str = Field(description="The ATS-optimized resume in plain text format")
    ats_score: int = Field(description="Estimated ATS Score (0-100)")
    improvements: List[str] = Field(description="Three specific actionable improvements")


SYSTEM_INSTRUCTION = """You are an expert Executive Resume Writer and ATS Optimization Specialist.
Your task is to craft an ATS-optimized, structured resume for the candidate against the target job description.

RULES:
1. Use ONLY facts in the profile. Never add companies, degrees, certificates, links, tools, or numbers that are not in the profile.
2. Choose and order content for the target job. Max 3 projects, max 3 bullets per project (4 only if the project is the most relevant), max 14 bullets in total.
3. Every bullet: 12–25 words, starts with a past-tense action verb, pattern = action + what + how + result.
4. Use a number only if it appears in the profile. If a bullet would be clearly stronger with a number the profile lacks, end that bullet with the literal text " [add metric]". Use this on at most 2 bullets in the whole resume.
5. Skills: 4–5 groups (e.g. Languages, ML/AI, Backend & Web, Tools & DevOps), only skills present in profile.skills or in a listed project's tech stack.
6. Banned words/phrases: "demonstrating expertise", "showcasing", "robust", "cutting-edge", "state-of-the-art", "seamless", "leveraging", "passionate", "results-driven", "hands-on experience", "spearheaded", "utilized".
7. Omit `summary` (set null) unless the profile has no projects and no experience.
8. basics.email/phone/name/location/links come verbatim from the profile.
"""


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

    async def _call_model_async(self, model_name: str, prompt: str) -> ResumeData:
        """Call Gemini via new google.genai async client with response_schema=ResumeData and 1 retry on validation error."""
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
                        response_schema=ResumeData,
                        temperature=0.2,
                    ),
                )
                try:
                    return ResumeData.model_validate_json(response.text)
                except Exception as val_err:
                    logger.warning(f"[ResumeAgent] Validation error on {model_name}: {val_err}. Retrying once with error feedback...")
                    retry_prompt = (
                        f"{prompt}\n\n"
                        f"IMPORTANT: The previous output failed Pydantic validation with error:\n{val_err}\n"
                        f"Please output strictly valid JSON satisfying the schema rules."
                    )
                    retry_resp = await self.client.aio.models.generate_content(
                        model=model_name,
                        contents=retry_prompt,
                        config=types.GenerateContentConfig(
                            system_instruction=SYSTEM_INSTRUCTION,
                            response_mime_type="application/json",
                            response_schema=ResumeData,
                            temperature=0.2,
                        ),
                    )
                    return ResumeData.model_validate_json(retry_resp.text)
            except Exception as e:
                last_error = e
                err_str = str(e)
                is_retryable = any(code in err_str for code in RETRYABLE_STATUS_CODES)
                if is_retryable and attempt < MAX_RETRIES:
                    delay = BASE_DELAY * (2 ** (attempt - 1)) + random.uniform(0, 1)
                    logger.warning(f"[ResumeAgent] ➔ [{model_name}] transient error (attempt {attempt}), "
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
        """Asynchronous, non-blocking structured resume generation."""
        base_data = build_deterministic_resume_data(user_profile)
        base_resume_md = render_plain_text(base_data)
        user_skills = user_profile.get("skills") or []

        if not self.client:
            logger.info("[ResumeAgent] ➔ Gemini API key not configured — using deterministic baseline resume.")
            fallback_ats, _ = compute_ats_score(base_resume_md, job_description, user_skills)
            return ResumeAgentOutput(
                resume_data=base_data,
                resume_md=base_resume_md,
                ats_score=fallback_ats,
                improvements=["Gemini API key not configured — served verified deterministic baseline resume."],
            )

        profile_text = self._build_profile_text(user_profile)
        prompt = (
            f"USER PROFILE:\n{profile_text}\n\n"
            f"TARGET JOB DESCRIPTION:\n{job_description}\n"
        )
        if critic_feedback:
            prompt += (
                f"\nCRITIC FEEDBACK — MUST ADDRESS IN THIS VERSION:\n{critic_feedback}\n"
            )

        chain = [self.model_name] + [m for m in MODEL_FALLBACK_CHAIN if m != self.model_name]
        for model in chain:
            try:
                logger.info(f"[ResumeAgent] ➔ Generating resume with {model}...")
                resume_data = await self._call_model_async(model, prompt)

                # Enforce no fabrication on the generated resume
                is_valid, errors = validate_no_fabrication(resume_data, user_profile)
                if not is_valid:
                    logger.warning(f"[ResumeAgent] ➔ Anti-fabrication flagged: {errors}. Preserving verified profile.")
                    resume_data = base_data
                    improvements = ["Reverted unverified modifications to preserve strict candidate accuracy."]
                else:
                    improvements = ["Tailored experience bullets and technical skills for target role."]

                # Find banned phrases and append to improvements
                banned_hits = find_banned_phrases(resume_data)
                improvements.extend(banned_hits)

                rendered_md = render_plain_text(resume_data)
                ats_score, ats_details = compute_ats_score(rendered_md, job_description, user_skills)

                return ResumeAgentOutput(
                    resume_data=resume_data,
                    resume_md=rendered_md,
                    ats_score=ats_score,
                    improvements=improvements,
                )
            except Exception as e:
                err = str(e)
                is_quota = "429" in err or "quota" in err.lower() or "RESOURCE_EXHAUSTED" in err
                is_transient = any(code in err for code in RETRYABLE_STATUS_CODES)
                is_model_unavailable = "404" in err or "NOT_FOUND" in err
                if is_quota:
                    logger.warning(f"[ResumeAgent] ➔ [{model}] Quota exhausted — trying next model...")
                elif is_transient:
                    logger.warning(f"[ResumeAgent] ➔ [{model}] Service unavailable after retries — trying next model...")
                elif is_model_unavailable:
                    logger.warning(f"[ResumeAgent] ➔ [{model}] Model not available in this region/version — trying next model...")
                else:
                    logger.error(f"[ResumeAgent] ➔ [{model}] Non-retryable error: {err}")
                    ats_score, _ = compute_ats_score(base_resume_md, job_description, user_skills)
                    return ResumeAgentOutput(
                        resume_data=base_data,
                        resume_md=base_resume_md,
                        ats_score=ats_score,
                        improvements=[f"LLM error: {err} — served verified baseline resume."],
                    )

        fallback_ats, _ = compute_ats_score(base_resume_md, job_description, user_skills)
        return ResumeAgentOutput(
            resume_data=base_data,
            resume_md=base_resume_md,
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
