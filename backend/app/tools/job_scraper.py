"""
Job Page Scraper
━━━━━━━━━━━━━━━
Fetches real job pages and extracts genuine company, role, and description
from JSON-LD structured data and meta tags.
"""
import json
import re
import asyncio
import httpx
from typing import Optional, Dict


# Browser-like headers to avoid bot detection
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}

# Detection phrases across LinkedIn, Naukri, Indeed, Glassdoor, Workday, etc.
CLOSED_JOB_INDICATORS = [
    "no longer accepting applications",
    "not accepting applications",
    "this job is no longer available",
    "job is no longer available",
    "this job has expired",
    "job has expired",
    "this posting has expired",
    "posting has expired",
    "application closed",
    "applications are closed",
    "applications closed",
    "position has been filled",
    "this position has been filled",
    "this role is closed",
    "vacancy is closed",
    "this vacancy is closed",
    "hiring has ceased",
    "this job is no longer active",
    "this job is inactive",
    "no longer accepting responses",
    "job has been closed",
    "this job has been closed",
    "job posting closed",
    "job is closed",
    "opening has been filled",
    "opening is closed",
    "role has been filled",
    "we're sorry, this job has expired",
    "this job listing has expired",
    "job has been archived",
    "posting has ended",
    "job not found",
    "404 not found",
]


def is_job_closed(text: str) -> bool:
    """Return True if text contains any expired or closed job phrases."""
    if not text:
        return False
    lower = text.lower()
    return any(phrase in lower for phrase in CLOSED_JOB_INDICATORS)


def _extract_json_ld(html: str) -> Optional[Dict]:
    """Extract JobPosting JSON-LD from page HTML."""
    # Find all <script type="application/ld+json"> blocks
    pattern = r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>'
    matches = re.findall(pattern, html, re.DOTALL | re.IGNORECASE)
    for raw in matches:
        try:
            data = json.loads(raw.strip())
            # Handle arrays
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get("@type") == "JobPosting":
                        return item
            elif isinstance(data, dict):
                if data.get("@type") == "JobPosting":
                    return data
                # Sometimes nested under @graph
                for item in data.get("@graph", []):
                    if isinstance(item, dict) and item.get("@type") == "JobPosting":
                        return item
        except Exception:
            continue
    return None


def _clean_html(text: str) -> str:
    """Strip HTML tags and clean up whitespace."""
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def _get_meta(html: str, name: str) -> str:
    """Extract meta tag content."""
    patterns = [
        rf'<meta\s+(?:name|property)=["\'](?:og:)?{name}["\']\s+content=["\'](.*?)["\']',
        rf'<meta\s+content=["\'](.*?)["\']\s+(?:name|property)=["\'](?:og:)?{name}["\']',
    ]
    for p in patterns:
        m = re.search(p, html, re.IGNORECASE | re.DOTALL)
        if m:
            return _clean_html(m.group(1))
    return ""


def _parse_from_json_ld(jld: Dict) -> Dict:
    """Extract structured job data from JSON-LD JobPosting."""
    # Company
    company = ""
    org = jld.get("hiringOrganization", {})
    if isinstance(org, dict):
        company = org.get("name", "")
    elif isinstance(org, str):
        company = org

    # Location
    location = ""
    loc = jld.get("jobLocation", {})
    if isinstance(loc, dict):
        addr = loc.get("address", {})
        if isinstance(addr, dict):
            parts = [
                addr.get("addressLocality", ""),
                addr.get("addressRegion", ""),
                addr.get("addressCountry", ""),
            ]
            location = ", ".join(p for p in parts if p)
    elif isinstance(loc, list) and loc:
        addr = loc[0].get("address", {}) if isinstance(loc[0], dict) else {}
        if isinstance(addr, dict):
            location = addr.get("addressLocality", "")

    # Description — strip HTML
    raw_desc = jld.get("description", "")
    desc = _clean_html(raw_desc)[:1000]  # cap at 1000 chars

    # Salary
    salary = ""
    base = jld.get("baseSalary", {})
    if isinstance(base, dict):
        val = base.get("value", {})
        if isinstance(val, dict):
            min_v = val.get("minValue", "")
            max_v = val.get("maxValue", "")
            currency = base.get("currency", "")
            if min_v and max_v:
                salary = f"{currency} {min_v}–{max_v}"

    return {
        "title": jld.get("title", ""),
        "company": company,
        "location": location,
        "description": desc,
        "salary_range": salary,
        "employment_type": jld.get("employmentType", ""),
    }


async def scrape_job_page(url: str) -> Optional[Dict]:
    """
    Fetch a job page and extract real structured data.
    Returns dict with: title, company, location, description, salary_range
    Returns None if scraping fails.
    """
    try:
        async with httpx.AsyncClient(
            headers=HEADERS,
            follow_redirects=True,
            timeout=12.0,
        ) as client:
            resp = await client.get(url)

            final_url = str(resp.url).lower()

            # 1. Dead pages (404/410) are definitively closed/removed
            if resp.status_code in (404, 410):
                print(f"[Scraper] ➔ Dropping dead/expired job (HTTP {resp.status_code}): {url[:60]}")
                return {"is_closed": True, "reason": f"HTTP {resp.status_code}"}

            # 2. Redirects to generic search or jobs home mean the role was unlisted
            if "/jobs/search" in final_url or final_url.rstrip("/").endswith(("/jobs", "/jobs/search")):
                print(f"[Scraper] ➔ Dropping redirected/unlisted job: {url[:60]}")
                return {"is_closed": True, "reason": "Redirected to search/home"}

            if resp.status_code != 200:
                return None

            html = resp.text

            # 3. Check if job HTML explicitly states it is closed/expired
            if is_job_closed(html):
                print(f"[Scraper] ➔ Dropping closed/expired job: {url[:60]}")
                return {"is_closed": True, "reason": "Closed text indicator"}

            # 4. Try JSON-LD first (most reliable structured data)
            jld = _extract_json_ld(html)
            if jld:
                data = _parse_from_json_ld(jld)
                if data.get("title"):
                    # Infer company from ATS URL if not present in JSON-LD
                    if not data.get("company"):
                        m_gh = re.search(r'greenhouse\.io/([^/]+)', url)
                        m_lev = re.search(r'lever\.co/([^/]+)', url)
                        m_ash = re.search(r'ashbyhq\.com/([^/]+)', url)
                        if m_gh:
                            data["company"] = m_gh.group(1).replace("-", " ").title()
                        elif m_lev:
                            data["company"] = m_lev.group(1).replace("-", " ").title()
                        elif m_ash:
                            data["company"] = m_ash.group(1).replace("-", " ").title()
                    return data

            # 5. Fall back to meta tags (OG/Twitter cards)
            title = (
                _get_meta(html, "title") or
                _get_meta(html, "og:title") or
                re.search(r'<title>(.*?)</title>', html, re.IGNORECASE | re.DOTALL) and
                _clean_html(re.search(r'<title>(.*?)</title>', html, re.IGNORECASE).group(1))
            )
            description = (
                _get_meta(html, "description") or
                _get_meta(html, "og:description")
            )

            # Extract company from title if pattern is "Role at Company"
            company = ""
            if title and " at " in title:
                company = title.split(" at ")[-1].split(" - ")[0].strip()

            if title or description:
                return {
                    "title": title or "",
                    "company": company,
                    "location": "",
                    "description": description or "",
                    "salary_range": "",
                    "employment_type": "",
                }

    except Exception as e:
        print(f"[Scraper] ➔ Failed {url[:60]}: {e}")

    return None


async def scrape_jobs_batch(urls: list, max_concurrent: int = 4) -> Dict[str, Optional[Dict]]:
    """Scrape multiple job pages concurrently."""
    sem = asyncio.Semaphore(max_concurrent)

    async def bounded_scrape(url):
        async with sem:
            result = await scrape_job_page(url)
            return url, result

    tasks = [bounded_scrape(url) for url in urls]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    out = {}
    for item in results:
        if isinstance(item, Exception):
            continue
        url, data = item
        out[url] = data
    return out
