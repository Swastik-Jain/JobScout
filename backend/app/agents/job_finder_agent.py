"""
Job Finder Agent — Production Hybrid Engine
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Reads active jobs directly from the DB-backed IngestedJob repository (fast, polite, 0 Serper cost per scan).
- Uses word-boundary matching, hard seniority/location filters, and weighted scoring.
- Enriches descriptions lazily only for the top shortlisted survivors.
- Uses Gemini strictly for match scoring and justification (never invents fake postings or URLs).
- Provides discover_new_ats_sources_offline() for scheduled background ATS board discovery.
"""
import re
import asyncio
import json
import random
from typing import List, Dict, Optional
import httpx
from google import genai
from google.genai import types
from sqlmodel import Session, select

from app.core.config import settings
from app.models.models import IngestedJob, CompanySource
from app.tools.ats_adapters import (
    sync_all_active_sources,
    prefilter_ingested_jobs,
    enrich_greenhouse_descriptions,
    extract_slug_from_url,
    validate_and_register_slug,
)

# Current models available in v1beta — ordered fastest/cheapest first
SCORING_MODEL_CHAIN = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"]
RETRYABLE_CODES = ("503", "500", "UNAVAILABLE", "INTERNAL")
MAX_RETRIES = 3
BASE_DELAY = 2.0

_client = genai.Client(api_key=settings.google_api_key) if settings.google_api_key else None


# ─── Offline Scheduled ATS Discovery ──────────────────────────────────────────
async def discover_new_ats_sources_offline(session: Session) -> int:
    """
    Offline/Scheduled discovery:
    Queries Google via Serper to discover new company ATS job boards (Greenhouse, Lever, Ashby),
    validates each candidate slug with regex + live API test, and registers valid sources into the DB.
    Does NOT run per user request, preventing credit burning.
    """
    if not settings.serper_api_key:
        print("[JobDiscoveryOffline] ➔ SERPER_API_KEY is not configured; offline discovery disabled.")
        return 0

    print("[JobDiscoveryOffline] ➔ Running scheduled ATS discovery query via Serper...")
    query = '(site:job-boards.greenhouse.io OR site:boards.greenhouse.io OR site:jobs.lever.co OR site:jobs.ashbyhq.com) ("software engineer" OR "developer") (India OR Remote)'

    discovered_count = 0
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": settings.serper_api_key, "Content-Type": "application/json"},
                json={
                    "q": query,
                    "num": 20,
                    "gl": "in",
                    "hl": "en",
                },
                timeout=15.0,
            )
            if r.status_code == 200:
                results = r.json().get("organic", [])
                for item in results:
                    link = item.get("link", "")
                    slug_info = extract_slug_from_url(link)
                    if slug_info:
                        ats, slug = slug_info
                        registered = await validate_and_register_slug(ats, slug, session)
                        if registered:
                            discovered_count += 1
            else:
                print(f"[JobDiscoveryOffline] ➔ Serper HTTP {r.status_code}")
        except Exception as e:
            print(f"[JobDiscoveryOffline] ➔ Serper discovery error: {e}")

    print(f"[JobDiscoveryOffline] ➔ Discovered and registered {discovered_count} new verified company ATS sources.")
    return discovered_count


# ─── Gemini Ranker ────────────────────────────────────────────────────────────
async def rank_enriched_jobs(jobs: List[Dict], user_profile: Dict) -> List[Dict]:
    """Score shortlisted jobs against user profile using Gemini. No description invention."""
    if not jobs:
        return []

    print(f"[JobFinderAgent] ➔ Scoring {len(jobs)} shortlisted jobs with Gemini...")

    profile_text = (
        f"Candidate Skills: {', '.join(user_profile.get('skills', []))}\n"
        f"Seniority / Preference: {user_profile.get('seniority_level', 'Entry-Level / Fresher')}\n"
        f"Location Preference: {user_profile.get('preferred_location', 'India, Remote')}\n"
        f"Experience: {json.dumps(user_profile.get('experience', []))}\n"
        f"Projects: {json.dumps(user_profile.get('projects', []))}"
    )

    jobs_text = json.dumps([{
        "id": j.get("id"),
        "external_id": j.get("external_id"),
        "title": j["title"],
        "company": j["company"],
        "platform": j["platform"],
        "url": j["url"],
        "location": j["location"],
        "description": j.get("description") or "Active verified position on company career portal.",
    } for j in jobs])

    prompt = f"""You are a Recruitment Analyst. Score each job against the candidate. Do NOT modify any job fields.

CANDIDATE:
{profile_text}

JOBS (real data — copy title/company/description/url/platform/location EXACTLY as-is):
{jobs_text}

SCORING RULES:
- BOTH skills AND experience empty → max 35
- Skills empty → max 45
- Skills partially match job description → 50-70
- Strong skill match + experience exists → 70-92
- Near-perfect match → up to 95

For EACH job return ALL fields unchanged, plus:
- match_score: integer per rules
- justification: 1 honest sentence explaining why this candidate matches or has gaps
- key_requirements: list of relevant tech skills found in title or description

Return JSON: {{"jobs": [{{all original fields + match_score + justification + key_requirements}}]}}
"""

    async def _try_model(model: str) -> list:
        last_err = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                print(f"[JobFinderAgent] ➔ Scoring with {model} (attempt {attempt})...")
                response = await _client.aio.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.1,
                    ),
                )
                return json.loads(response.text).get("jobs", [])
            except Exception as e:
                last_err = e
                err_str = str(e)
                is_retryable = any(c in err_str for c in RETRYABLE_CODES)
                if is_retryable and attempt < MAX_RETRIES:
                    delay = BASE_DELAY * (2 ** (attempt - 1)) + random.uniform(0, 1)
                    print(f"[JobFinderAgent] ➔ [{model}] transient error, retrying in {delay:.1f}s...")
                    await asyncio.sleep(delay)
                else:
                    raise
        raise last_err

    if _client:
        for model in SCORING_MODEL_CHAIN:
            try:
                return await _try_model(model)
            except Exception as e:
                err = str(e)
                is_quota = "429" in err or "quota" in err.lower() or "RESOURCE_EXHAUSTED" in err
                is_transient = any(c in err for c in RETRYABLE_CODES)
                if is_quota or is_transient:
                    print(f"[JobFinderAgent] ➔ [{model}] unavailable — trying next model...")
                else:
                    print(f"[JobFinderAgent] ➔ Scoring error (non-retryable): {err}")
                    break

    print("[JobFinderAgent] ➔ LLM unavailable — returning verified jobs with baseline score.")
    return [{
        **j,
        "match_score": 65 if any(s.lower() in j["title"].lower() for s in user_profile.get("skills", [])) else 50,
        "justification": f"Verified active opening at {j['company']}.",
        "key_requirements": [s for s in user_profile.get("skills", []) if s.lower() in j["title"].lower()],
    } for j in jobs]


# ─── Sanitize ─────────────────────────────────────────────────────────────────
def _sanitize(job: Dict) -> Dict:
    """Ensure all required Job DB fields exist."""
    res = {
        "title": str(job.get("title", "Unknown Role")),
        "company": str(job.get("company", "Unknown Company")),
        "description": str(job.get("description") or f"Active verified opening on {job.get('company')} job board."),
        "platform": str(job.get("platform", "Unknown")),
        "url": str(job.get("url") or ""),
        "location": str(job.get("location") or "India / Remote"),
        "salary_range": str(job.get("salary_range") or ""),
        "match_score": float(job.get("match_score") or 0),
        "justification": str(job.get("justification") or ""),
        "key_requirements": job.get("key_requirements") or [],
    }
    if job.get("id") is not None:
        res["id"] = int(job["id"])
    if job.get("external_id"):
        res["external_id"] = str(job["external_id"])
    return res


# ─── Main Entry ───────────────────────────────────────────────────────────────
async def run_job_finder_agent(job_role: str, user_profile: Dict, session: Session) -> List[Dict]:
    """
    Production-grade hybrid scan:
    1. Reads active verified postings from IngestedJob in DB.
    2. If DB is empty, runs an initial sync of active company feeds.
    3. Runs word-boundary matching + hard seniority/location filters.
    4. Enriches descriptions lazily only for the top 15 survivors.
    5. Scores with Gemini (with fallback), never inventing fake jobs.
    """
    print(f"[JobFinderAgent] ➔ Starting job scan for role: '{job_role}'")

    # 1. Fetch active jobs from DB
    active_jobs = session.exec(
        select(IngestedJob).where(IngestedJob.is_active == True)
    ).all()

    # If DB has no active jobs yet (e.g. first boot), run initial sync
    if not active_jobs:
        print("[JobFinderAgent] ➔ IngestedJob repository is empty. Triggering initial feed sync...")
        await sync_all_active_sources(session)
        active_jobs = session.exec(
            select(IngestedJob).where(IngestedJob.is_active == True)
        ).all()

    if not active_jobs:
        print("[JobFinderAgent] ➔ No active jobs currently available in feed repository.")
        return []

    print(f"[JobFinderAgent] ➔ Filtering {len(active_jobs)} active repository jobs...")

    # 2. Word-boundary + hard seniority/location pre-filter
    shortlist = prefilter_ingested_jobs(
        jobs=active_jobs,
        target_role=job_role,
        user_profile=user_profile,
        max_results=15,
    )

    if not shortlist:
        print(f"[JobFinderAgent] ➔ No active jobs passed criteria for '{job_role}'.")
        return []

    print(f"[JobFinderAgent] ➔ Shortlisted {len(shortlist)} top matching jobs. Enriching descriptions...")

    # 3. Payload optimization: enrich descriptions only for survivors
    await enrich_greenhouse_descriptions(shortlist)

    # 4. Score with Gemini
    scored = await rank_enriched_jobs(shortlist, user_profile)
    if not scored:
        return []

    sanitized = [_sanitize(j) for j in scored if j]
    sanitized.sort(key=lambda x: x["match_score"], reverse=True)

    print(f"[JobFinderAgent] ➔ Returning {len(sanitized)} verified live jobs.")
    return sanitized
