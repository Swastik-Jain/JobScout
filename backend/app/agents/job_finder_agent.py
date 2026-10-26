"""
Job Finder Agent
━━━━━━━━━━━━━━━
Uses Serper (Google Search) to find recently posted jobs, then
Gemini to score and structure them against the user's profile.
"""
import re
import asyncio
import json
import random
from typing import List, Dict
from google import genai
from google.genai import types

from app.core.config import settings
from app.tools.job_scraper import scrape_jobs_batch, is_job_closed

# Current models available in v1beta — ordered fastest/cheapest first
SCORING_MODEL_CHAIN = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"]
RETRYABLE_CODES = ("503", "500", "UNAVAILABLE", "INTERNAL")
MAX_RETRIES = 3
BASE_DELAY = 2.0

_client = genai.Client(api_key=settings.google_api_key) if settings.google_api_key else None


# ─── Serper Fetch ─────────────────────────────────────────────────────────────
async def fetch_serper(query: str, platform_name: str) -> List[Dict]:
    """Search Google via Serper and return organic results."""
    if not settings.serper_api_key:
        return []

    import httpx
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": settings.serper_api_key, "Content-Type": "application/json"},
                json={
                    "q": query,
                    "num": 6,
                    "gl": "in",        # India geo
                    "hl": "en",
                    "location": "India",
                    "tbs": "qdr:d2",   # Past 48 hours only — fresh, active postings only
                },
                timeout=15.0,
            )
            if r.status_code == 200:
                results = r.json().get("organic", [])
                print(f"[JobFinderAgent] ➔ {platform_name}: {len(results)} results")
                return [
                    {
                        "platform": platform_name,
                        "title": item.get("title", ""),
                        "snippet": item.get("snippet", ""),
                        "link": item.get("link", ""),
                    }
                    for item in results
                ]
            else:
                print(f"[JobFinderAgent] ➔ Serper {platform_name}: HTTP {r.status_code}")
                return []
        except Exception as e:
            print(f"[JobFinderAgent] ➔ Serper exception ({platform_name}): {e}")
            return []


# ─── Gemini Ranker ────────────────────────────────────────────────────────────
async def scrape_and_rank_jobs(snippets: List[Dict], user_profile: Dict) -> List[Dict]:
    """
    1. Scrape each job's URL for REAL company/title/description from HTML JSON-LD
    2. Enrich snippet with scraped data
    3. Pass enriched data to Gemini ONLY for scoring (no description invention)
    """
    print(f"[JobFinderAgent] ➔ Scraping {len(snippets)} real job pages...")
    urls = [s["link"] for s in snippets if s.get("link")]
    scraped = await scrape_jobs_batch(urls, max_concurrent=5)

    enriched = []
    for s in snippets:
        url = s.get("link", "")
        raw_title = s.get("title", "")
        raw_snippet = s.get("snippet", "")

        # 1. Snippet-level pre-check: drop if title or snippet shows it's closed
        if is_job_closed(raw_title) or is_job_closed(raw_snippet):
            print(f"[JobFinderAgent] ➔ Skipping closed listing from search snippet: {raw_title[:50]}")
            continue

        page_data = scraped.get(url)

        # 2. Live HTML check: drop if scraper confirmed the position has closed
        if page_data and page_data.get("is_closed"):
            print(f"[JobFinderAgent] ➔ Dropping confirmed closed job page: {url[:60]}")
            continue

        if page_data and page_data.get("description") and len(page_data["description"]) > 50:
            # Real data from page HTML
            entry = {
                "platform": s["platform"],
                "url": url,
                "title": page_data.get("title") or s.get("title", ""),
                "company": page_data.get("company") or "",
                "location": page_data.get("location") or "India",
                "description": page_data["description"][:800],
                "salary_range": page_data.get("salary_range", ""),
                "source": "scraped",
            }
            # If company still empty, try extracting from page title
            if not entry["company"]:
                # Pattern: "Company hiring Role" or "Role at Company"
                title_text = page_data.get("title") or s.get("title", "")
                m = re.search(r'^(.+?)\s+hiring\s+', title_text, re.IGNORECASE)
                if m:
                    entry["company"] = m.group(1).strip()
                else:
                    m2 = re.search(r'\bat\s+([A-Z][\w\s]+?)(?:\s*[-|,]|$)', title_text)
                    if m2:
                        entry["company"] = m2.group(1).strip()
        else:
            # Drop unverified LinkedIn links — LinkedIn pages that fail to scrape or return 404/429 are 90%+ closed
            if s.get("platform") == "LinkedIn":
                print(f"[JobFinderAgent] ➔ Dropping unverified LinkedIn listing: {url[:55]}")
                continue

            # For other platforms, only keep snippet if it has a real description and is not closed
            if not raw_snippet or len(raw_snippet) < 40 or is_job_closed(raw_snippet):
                print(f"[JobFinderAgent] ➔ Dropping empty or closed snippet: {raw_title[:50]}")
                continue

            # Extract company from Google title pattern: "Company hiring Role" or "Role - Company"
            raw_title = s.get("title", "")
            company = ""
            m = re.search(r'^(.+?)\s+hiring\s+', raw_title, re.IGNORECASE)
            if m:
                company = m.group(1).strip()
            else:
                parts = raw_title.split(" - ")
                if len(parts) >= 2:
                    company = parts[1].strip()

            entry = {
                "platform": s["platform"],
                "url": url,
                "title": raw_title,
                "company": company,
                "location": "India",
                "description": raw_snippet,
                "salary_range": "",
                "source": "snippet",
            }

        enriched.append(entry)
        src_label = "HTML" if entry.get("source") == "scraped" else "snippet"
        print(f"  [{src_label}] {entry['title'][:55]} @ {entry['company'] or '?'}")

    return await rank_enriched_jobs(enriched, user_profile)


async def rank_enriched_jobs(jobs: List[Dict], user_profile: Dict) -> List[Dict]:
    """Score enriched jobs against user profile. No description invention."""
    print(f"[JobFinderAgent] ➔ Scoring {len(jobs)} enriched jobs with Gemini...")

    profile_text = (
        f"Skills: {', '.join(user_profile.get('skills', []))}\n"
        f"Experience: {json.dumps(user_profile.get('experience', []))}\n"
        f"Projects: {json.dumps(user_profile.get('projects', []))}"
    )

    jobs_text = json.dumps([{
        "title": j["title"],
        "company": j["company"],
        "platform": j["platform"],
        "url": j["url"],
        "location": j["location"],
        "description": j["description"],
    } for j in jobs])

    prompt = f"""You are a Recruitment Analyst. Score each job against the candidate. Do NOT modify any field.

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
- justification: 1 honest sentence
- key_requirements: list of skills found in description (can be [])

Return: {{"jobs": [{{all original fields + match_score + justification + key_requirements}}]}}
"""

    async def _try_model(model: str) -> list:
        """Call a single model with exponential backoff on transient errors."""
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

    print("[JobFinderAgent] ➔ All scoring models failed — returning jobs with default score.")
    return [{**j, "match_score": 50, "justification": "Scored offline", "key_requirements": []} for j in jobs]


# ─── Sanitize ─────────────────────────────────────────────────────────────────
def _sanitize(job: Dict) -> Dict:
    """Ensure all required JobMatch DB fields exist."""
    return {
        "title": str(job.get("title", "Unknown Role")),
        "company": str(job.get("company", "Unknown Company")),
        "description": str(job.get("description") or job.get("snippet") or ""),
        "platform": str(job.get("platform", "Unknown")),
        "url": str(job.get("url") or job.get("link") or ""),
        "location": str(job.get("location") or "India"),
        "salary_range": str(job.get("salary_range") or ""),
        "match_score": float(job.get("match_score") or 0),
        "justification": str(job.get("justification") or ""),
        "key_requirements": job.get("key_requirements") or [],
    }


# ─── Main Entry ───────────────────────────────────────────────────────────────
async def run_job_finder_agent(job_role: str, user_profile: Dict) -> List[Dict]:
    """
    Main entry: Queries live job portals via Serper API and scores them with Gemini.
    Returns an empty list if Serper is unconfigured or returns no listings.
    Never invents simulated jobs or fake URLs.
    """
    print(f"[JobFinderAgent] ➔ Starting live search for role: '{job_role}'")

    if not settings.serper_api_key:
        print("[JobFinderAgent] ➔ SERPER_API_KEY is not configured. Live job search disabled.")
        return []

    all_snippets: List[Dict] = []

    # Negative search operators to filter out expired listings across all platforms
    EXCLUDE_CLOSED = '-"no longer accepting applications" -"job has expired" -"closed" -"not accepting applications"'
    queries = [
        # Direct modern ATS portals (Greenhouse, Lever, Ashby) — active tech jobs
        (f'"{job_role}" (site:boards.greenhouse.io OR site:jobs.lever.co OR site:jobs.ashbyhq.com) (India OR "Remote") {EXCLUDE_CLOSED}', "Direct ATS"),
        # LinkedIn /jobs/view/ = individual job posting with real description
        (f'"{job_role}" site:linkedin.com/jobs/view (India OR Bangalore OR "Remote") {EXCLUDE_CLOSED}', "LinkedIn"),
        # Naukri individual job detail pages
        (f'"{job_role}" "apply" "experience" site:naukri.com -site:naukri.com/jobs {EXCLUDE_CLOSED}', "Naukri"),
        # Indeed individual job pages
        (f'"{job_role}" "job description" "responsibilities" site:in.indeed.com {EXCLUDE_CLOSED}', "Indeed"),
        # Glassdoor individual job detail pages
        (f'"{job_role}" "responsibilities" "requirements" site:glassdoor.co.in/job-listing {EXCLUDE_CLOSED}', "Glassdoor"),
    ]

    results = await asyncio.gather(*[
        fetch_serper(q, platform) for q, platform in queries
    ])
    for r in results:
        all_snippets.extend(r)

    print(f"[JobFinderAgent] ➔ Aggregated {len(all_snippets)} live search snippets.")

    if not all_snippets:
        print("[JobFinderAgent] ➔ No active job postings found on portals for this search.")
        return []

    scored = await scrape_and_rank_jobs(all_snippets, user_profile)
    if not scored:
        print("[JobFinderAgent] ➔ No jobs could be parsed or matched against profile.")
        return []

    sanitized = [_sanitize(j) for j in scored if j]
    sanitized.sort(key=lambda x: x["match_score"], reverse=True)

    print(f"[JobFinderAgent] ➔ Returning {len(sanitized)} verified live jobs.")
    return sanitized
