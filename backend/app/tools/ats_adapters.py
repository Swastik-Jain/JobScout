"""
ATS Adapters for Direct Public Job Board APIs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tier 1: Direct public ATS feeds (Greenhouse, Lever, Ashby)
- DB-backed CompanySource registry & IngestedJob sync engine
- Word-boundary regex matching (no C/Go/Java substring bugs)
- Hard seniority and location/remote filters before scoring
- Greenhouse payload optimization (fetch listing without content, fetch description on shortlist)
- Guardrailed slug auto-discovery with regex + live API check + registry cap
- Real position-closed signal (vanished jobs marked is_active=False)
"""

import re
import asyncio
from datetime import datetime
from typing import List, Dict, Tuple, Optional
import httpx
from sqlmodel import Session, select

from app.models.models import CompanySource, IngestedJob, utc_now

# Guardrail: regex for slug validation (2-50 chars, alphanumeric + hyphen/underscore)
SLUG_REGEX = re.compile(r'^[a-z0-9][a-z0-9\-_]{1,48}[a-z0-9]$')

# Blacklist of common non-company slugs found in search URLs
SLUG_BLACKLIST = {
    "jobs", "careers", "search", "api", "embed", "application",
    "apply", "default", "boards", "privacy", "terms", "about",
    "teams", "login", "auth", "dashboard", "admin", "view"
}

MAX_ACTIVE_SOURCES = 100


def _clean_html(raw_html: str) -> str:
    """Strip HTML tags and normalize whitespace."""
    if not raw_html:
        return ""
    text = re.sub(r'<[^>]+>', ' ', raw_html)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def extract_slug_from_url(url: str) -> Optional[Tuple[str, str]]:
    """
    Extract (ats, slug) from Greenhouse, Lever, or Ashby URLs.
    Supports both classic boards.greenhouse.io and new job-boards.greenhouse.io.
    """
    if not url:
        return None
    # Greenhouse: job-boards.greenhouse.io/{slug} or boards.greenhouse.io/{slug}
    m_gh = re.search(r'(?:job-boards|boards)\.greenhouse\.io/([^/?#]+)', url)
    if m_gh:
        slug = m_gh.group(1).lower()
        if SLUG_REGEX.match(slug) and slug not in SLUG_BLACKLIST:
            return "greenhouse", slug

    # Lever: jobs.lever.co/{slug}
    m_lev = re.search(r'jobs\.lever\.co/([^/?#]+)', url)
    if m_lev:
        slug = m_lev.group(1).lower()
        if SLUG_REGEX.match(slug) and slug not in SLUG_BLACKLIST:
            return "lever", slug

    # Ashby: jobs.ashbyhq.com/{slug}
    m_ash = re.search(r'jobs\.ashbyhq\.com/([^/?#]+)', url)
    if m_ash:
        slug = m_ash.group(1).lower()
        if SLUG_REGEX.match(slug) and slug not in SLUG_BLACKLIST:
            return "ashby", slug

    return None


async def validate_and_register_slug(ats: str, slug: str, session: Session) -> bool:
    """
    Auto-learning guardrail:
    1. Validate slug regex and blacklist
    2. Check max registry cap
    3. Make a single live test call to verify endpoint returns HTTP 200 with active jobs
    4. Upsert into CompanySource DB table
    """
    ats = ats.lower().strip()
    slug = slug.lower().strip()

    if not SLUG_REGEX.match(slug) or slug in SLUG_BLACKLIST or ats not in ("greenhouse", "lever", "ashby"):
        return False

    existing = session.exec(select(CompanySource).where(CompanySource.ats == ats, CompanySource.slug == slug)).first()
    if existing:
        return True  # Already registered

    total_active = len(session.exec(select(CompanySource).where(CompanySource.is_active == True)).all())
    if total_active >= MAX_ACTIVE_SOURCES:
        print(f"[ATSAdapters] ➔ Registry cap of {MAX_ACTIVE_SOURCES} reached; skipping '{slug}'.")
        return False

    # Live verification check before saving
    endpoint = ""
    if ats == "greenhouse":
        endpoint = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs"
    elif ats == "lever":
        endpoint = f"https://api.lever.co/v0/postings/{slug}?mode=json"
    elif ats == "ashby":
        endpoint = f"https://api.ashbyhq.com/posting-api/job-board/{slug}"

    try:
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
            r = await client.get(endpoint)
            if r.status_code != 200:
                return False
            data = r.json()
            job_count = len(data if isinstance(data, list) else data.get("jobs", []))
            if job_count == 0:
                return False
    except Exception as e:
        print(f"[ATSAdapters] ➔ Verification failed for {ats}:{slug}: {e}")
        return False

    # Insert into database
    source = CompanySource(
        ats=ats,
        slug=slug,
        name=slug.replace("-", " ").title(),
        is_active=True,
        last_ok_at=utc_now(),
        fail_count=0,
    )
    session.add(source)
    session.commit()
    print(f"[ATSAdapters] ➔ Auto-learned verified {ats} board for '{slug}' ({job_count} active jobs).")
    return True


# ─── Individual Feed Fetchers ─────────────────────────────────────────────────

async def fetch_greenhouse_listings(slug: str, client: httpx.AsyncClient) -> List[Dict]:
    """
    Payload Optimization:
    Fetches the lightweight job list WITHOUT content=true to avoid gigabyte payloads.
    Returns: [{external_id, title, location, url, company}]
    """
    url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs"
    company_name = slug.replace("-", " ").title()
    r = await client.get(url, timeout=7.0)
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}")

    jobs = []
    for item in r.json().get("jobs", []):
        loc = (item.get("location") or {}).get("name", "") or ""
        apply_url = item.get("absolute_url") or f"https://job-boards.greenhouse.io/{slug}/jobs/{item.get('id')}"
        jobs.append({
            "external_id": str(item.get("id")),
            "title": str(item.get("title", "")).strip(),
            "company": company_name,
            "location": loc.strip(),
            "url": apply_url,
            "description": None,  # Fetch lazily for shortlisted candidates
            "ats": "greenhouse",
        })
    return jobs


async def fetch_greenhouse_job_content(slug: str, job_id: str, client: httpx.AsyncClient) -> str:
    """Fetch description content for a single Greenhouse job."""
    url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs/{job_id}"
    try:
        r = await client.get(url, timeout=6.0)
        if r.status_code == 200:
            return _clean_html(r.json().get("content", ""))
    except Exception:
        pass
    return ""


async def fetch_lever_listings(slug: str, client: httpx.AsyncClient) -> List[Dict]:
    """Fetch structured jobs from Lever public API."""
    url = f"https://api.lever.co/v0/postings/{slug}?mode=json"
    company_name = slug.replace("-", " ").title()
    r = await client.get(url, timeout=7.0)
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}")

    data = r.json()
    if not isinstance(data, list):
        return []

    jobs = []
    for item in data:
        cats = item.get("categories") or {}
        location = cats.get("location") or cats.get("allLocations") or ""
        if isinstance(location, list):
            location = ", ".join(location)

        desc = item.get("descriptionPlain") or _clean_html(item.get("description", ""))
        apply_url = item.get("hostedUrl") or item.get("applyUrl") or ""

        jobs.append({
            "external_id": str(item.get("id")),
            "title": str(item.get("text", "")).strip(),
            "company": company_name,
            "location": str(location).strip(),
            "url": apply_url,
            "description": desc[:1200] if desc else None,
            "ats": "lever",
        })
    return jobs


async def fetch_ashby_listings(slug: str, client: httpx.AsyncClient) -> List[Dict]:
    """Fetch structured jobs from Ashby public API."""
    url = f"https://api.ashbyhq.com/posting-api/job-board/{slug}"
    company_name = slug.replace("-", " ").title()
    r = await client.get(url, timeout=7.0)
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}")

    data = r.json()
    jobs = []
    for item in data.get("jobs", []):
        location = item.get("location") or ""
        desc = item.get("descriptionPlain") or _clean_html(item.get("descriptionHtml", ""))
        apply_url = item.get("jobUrl") or item.get("applyUrl") or ""

        jobs.append({
            "external_id": str(item.get("id")),
            "title": str(item.get("title", "")).strip(),
            "company": company_name,
            "location": str(location).strip(),
            "url": apply_url,
            "description": desc[:1200] if desc else None,
            "ats": "ashby",
        })
    return jobs


# ─── Background Feed Ingest & Upsert ──────────────────────────────────────────

async def sync_company_source(source: CompanySource, session: Session, client: httpx.AsyncClient) -> int:
    """
    Ingests and updates feeds for a single company source.
    - Dedupes by (ats, external_id)
    - Detects closed postings: any previously active job missing from the fetch is marked is_active=False
    - Tracks fail_count and last_error; deactivates after 3 consecutive failures
    """
    raw_listings: List[Dict] = []
    try:
        if source.ats == "greenhouse":
            raw_listings = await fetch_greenhouse_listings(source.slug, client)
        elif source.ats == "lever":
            raw_listings = await fetch_lever_listings(source.slug, client)
        elif source.ats == "ashby":
            raw_listings = await fetch_ashby_listings(source.slug, client)
        else:
            return 0

        # Success: reset fail_count
        source.fail_count = 0
        source.last_ok_at = utc_now()
        source.last_error = None

    except Exception as e:
        source.fail_count += 1
        source.last_error = str(e)[:250]
        if source.fail_count >= 3:
            source.is_active = False
            print(f"[ATSAdapters] ➔ Source {source.ats}:{source.slug} deactivated after {source.fail_count} failures: {e}")
        else:
            print(f"[ATSAdapters] ➔ Feed error for {source.ats}:{source.slug} (fail #{source.fail_count}): {e}")
        session.add(source)
        session.commit()
        return 0

    seen_ids = set()
    now = utc_now()

    # Load existing jobs for this ats & company
    existing_jobs = session.exec(
        select(IngestedJob).where(
            IngestedJob.ats == source.ats,
            IngestedJob.company == source.name,
        )
    ).all()
    existing_map = {j.external_id: j for j in existing_jobs}

    for item in raw_listings:
        ext_id = item["external_id"]
        seen_ids.add(ext_id)

        if ext_id in existing_map:
            job = existing_map[ext_id]
            job.title = item["title"]
            job.location = item["location"]
            job.url = item["url"]
            job.is_active = True
            job.last_seen_at = now
            if item.get("description"):
                job.description = item["description"]
            session.add(job)
        else:
            new_job = IngestedJob(
                ats=item["ats"],
                external_id=ext_id,
                company=item["company"],
                title=item["title"],
                location=item["location"],
                url=item["url"],
                description=item.get("description"),
                is_active=True,
                first_seen_at=now,
                last_seen_at=now,
            )
            session.add(new_job)

    # Closed job detection: jobs missing from this fetch become inactive
    for ext_id, job in existing_map.items():
        if ext_id not in seen_ids and job.is_active:
            job.is_active = False
            session.add(job)

    session.add(source)
    session.commit()
    return len(raw_listings)


async def sync_all_active_sources(session: Session, max_concurrent: int = 6) -> Dict[str, int]:
    """
    Sync all active company sources concurrently using a bounded semaphore.
    """
    sources = session.exec(select(CompanySource).where(CompanySource.is_active == True)).all()
    print(f"[ATSAdapters] ➔ Starting feed sync across {len(sources)} active company sources...")
    sem = asyncio.Semaphore(max_concurrent)
    stats = {"total_sources": len(sources), "synced_sources": 0, "total_jobs": 0}

    async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
        async def _bounded_sync(src):
            async with sem:
                count = await sync_company_source(src, session, client)
                return count

        results = await asyncio.gather(*[_bounded_sync(s) for s in sources], return_exceptions=True)
        for r in results:
            if isinstance(r, int) and r > 0:
                stats["synced_sources"] += 1
                stats["total_jobs"] += r

    print(f"[ATSAdapters] ➔ Feed sync completed: {stats['synced_sources']}/{stats['total_sources']} sources synced ({stats['total_jobs']} jobs processed).")
    return stats


# ─── Word-Boundary & Weighted Scoring Prefilter ───────────────────────────────

def _has_word(target_word: str, text: str) -> bool:
    """
    Word-boundary match: prevents 'C' matching 'Cloud', 'Go' matching 'Algorithm',
    'Java' matching 'JavaScript', or 'R' matching any word with r.
    """
    tw = target_word.strip().lower()
    if not tw:
        return False
    if tw in ("c++", "c#", ".net"):
        escaped = re.escape(tw)
        return bool(re.search(r'(?:^|\s|[(\[,])' + escaped + r'(?:$|\s|[)\],.:;])', text.lower()))
    escaped = re.escape(tw)
    return bool(re.search(r'\b' + escaped + r'\b', text.lower()))


def prefilter_ingested_jobs(
    jobs: List[IngestedJob],
    target_role: str,
    user_profile: Dict,
    max_results: int = 15,
) -> List[Dict]:
    """
    1. Hard filters:
       - Seniority: If entry-level/fresher, hard-drop Senior/Staff/Lead/Manager roles
       - Location: Drop explicit on-site US/EU roles if user prefers India / Remote
    2. Word-boundary weighted scoring:
       - Role in title: +12
       - Role words in title: +5
       - Seniority keywords in title: +6
       - Skills in title: +5
       - Skills in description: +2
       - India / Remote match: +4
    3. Sort descending and return top N
    """
    if not jobs:
        return []

    # 1. Profile Seniority & Location preferences
    user_skills = [s.strip() for s in user_profile.get("skills", []) if s.strip()]
    user_exp = user_profile.get("experience", [])
    seniority_pref = (user_profile.get("seniority_level") or "").lower()
    location_pref = (user_profile.get("preferred_location") or "India, Remote").lower()

    # Determine if candidate is Entry-Level / Fresher
    is_entry_level = (
        "entry" in seniority_pref
        or "fresher" in seniority_pref
        or "intern" in seniority_pref
        or len(user_exp) == 0
    )

    SENIOR_KEYWORDS = ["senior", "sr", "sr.", "lead", "staff", "principal", "director", "vp", "head", "architect", "manager"]
    ENTRY_KEYWORDS = ["intern", "internship", "new grad", "graduate", "entry", "junior", "jr", "jr.", "associate", "sde-1", "sde 1", "sde i", "engineer i"]

    # Location keywords
    INDIA_LOCATIONS = {"india", "bangalore", "bengaluru", "hyderabad", "pune", "delhi", "mumbai", "gurgaon", "noida", "chennai"}
    REMOTE_LOCATIONS = {"remote", "worldwide", "anywhere", "emea", "apac", "home based", "home-based", "distributed", "global"}

    role_words = [w.lower() for w in re.findall(r'\b\w+\b', target_role) if len(w) > 1]

    candidates = []

    for j in jobs:
        title = j.title.lower()
        loc = (j.location or "").lower()
        desc = (j.description or "").lower()
        full_text = f"{title} {loc} {desc}"

        # ── HARD FILTER 1: SENIORITY ──────────────────────────────────────────
        if is_entry_level:
            # Drop senior roles
            if any(_has_word(sk, title) for sk in SENIOR_KEYWORDS):
                continue
        else:
            # If candidate has 3+ years experience, don't show internships
            if any(_has_word(ek, title) for ek in ("intern", "internship")):
                continue

        # ── HARD FILTER 2: LOCATION ───────────────────────────────────────────
        # If user prefers India/Remote, drop explicit local-only US/EU jobs that have no remote/India match
        is_india = any(k in loc for k in INDIA_LOCATIONS)
        is_remote = any(k in loc for k in REMOTE_LOCATIONS) or "remote" in title

        if "india" in location_pref or "remote" in location_pref:
            # If location is present and explicitly outside without remote/India option
            has_explicit_foreign = any(c in loc for c in ("united states", "usa", "san francisco", "new york", "london", "seattle", "germany", "france"))
            if has_explicit_foreign and not (is_india or is_remote):
                continue

        # ── WEIGHTED SCORING ──────────────────────────────────────────────────
        score = 0

        # Exact role phrase match in title
        if target_role.lower() in title:
            score += 12

        # Role words in title
        for rw in role_words:
            if _has_word(rw, title):
                score += 5
            elif _has_word(rw, desc):
                score += 2

        # Seniority keyword match in title
        if is_entry_level:
            for ek in ENTRY_KEYWORDS:
                if _has_word(ek, title):
                    score += 6
                    break

        # Skill overlap using word boundaries
        for sk in user_skills:
            if _has_word(sk, title):
                score += 5
            elif desc and _has_word(sk, desc):
                score += 2

        # Location bonus
        if is_india:
            score += 5
        elif is_remote:
            score += 3

        if score > 0:
            candidates.append((score, j))

    # Sort descending by score, take top N
    candidates.sort(key=lambda x: x[0], reverse=True)
    shortlisted_jobs = [c[1] for c in candidates[:max_results]]

    return [
        {
            "id": j.id,
            "external_id": j.external_id,
            "title": j.title,
            "company": j.company,
            "location": j.location,
            "url": j.url,
            "description": j.description,
            "platform": j.ats.title(),
            "source": "ats_api",
        }
        for j in shortlisted_jobs
    ]


async def enrich_greenhouse_descriptions(shortlist: List[Dict]):
    """
    Fetches full descriptions for shortlisted Greenhouse jobs that don't have descriptions yet.
    Only queries the 5-15 shortlisted survivors (zero waste!).
    """
    to_fetch = [j for j in shortlist if j.get("platform") == "Greenhouse" and not j.get("description")]
    if not to_fetch:
        return

    async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
        async def _fetch_one(job_dict):
            # Extract slug from URL
            slug_info = extract_slug_from_url(job_dict.get("url", ""))
            if slug_info:
                _, slug = slug_info
                ext_id = job_dict.get("external_id", "")
                desc = await fetch_greenhouse_job_content(slug, ext_id, client)
                if desc:
                    job_dict["description"] = desc[:1200]

        await asyncio.gather(*[_fetch_one(j) for j in to_fetch], return_exceptions=True)
