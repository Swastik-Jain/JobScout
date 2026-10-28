import pytest
import httpx
from unittest.mock import AsyncMock
from app.tools.job_scraper import _extract_json_ld, _parse_from_json_ld
from app.tools.ats_adapters import (
    SLUG_REGEX,
    SLUG_BLACKLIST,
    extract_slug_from_url,
    _clean_html,
    _has_word,
    fetch_greenhouse_listings,
    fetch_lever_listings,
    fetch_ashby_listings,
)


def test_scraper_json_ld_extraction():
    """Verify JSON-LD schema parsing from HTML containing a JobPosting block."""
    sample_html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Senior Software Engineer - Datadog Careers</title>
        <script type="application/ld+json">
        {
            "@context": "https://schema.org/",
            "@type": "JobPosting",
            "title": "Staff Backend Engineer",
            "description": "<p>Build high-throughput telemetry pipelines handling 50TB daily.</p>",
            "hiringOrganization": {
                "@type": "Organization",
                "name": "Datadog"
            },
            "jobLocation": {
                "@type": "Place",
                "address": {
                    "@type": "PostalAddress",
                    "addressLocality": "Remote, US"
                }
            },
            "employmentType": "FULL_TIME"
        }
        </script>
    </head>
    <body>
        <h1>Job Details</h1>
    </body>
    </html>
    """
    json_ld = _extract_json_ld(sample_html)
    assert json_ld is not None
    assert json_ld.get("@type") == "JobPosting"

    parsed = _parse_from_json_ld(json_ld)
    assert parsed["title"] == "Staff Backend Engineer"
    assert parsed["company"] == "Datadog"
    assert "telemetry pipelines" in parsed["description"]
    assert "Remote, US" in parsed["location"]
    assert parsed["employment_type"] == "FULL_TIME"


def test_slug_regex_and_blacklist_rules():
    """Validate slug rules prevent invalid path traversal or blacklisted search keywords."""
    valid_slugs = ["stripe", "datadog", "brex-hq", "notion-labs", "figma_2026", "ramp"]
    for slug in valid_slugs:
        assert SLUG_REGEX.match(slug) is not None
        assert slug not in SLUG_BLACKLIST

    # Invalid patterns
    assert not SLUG_REGEX.match("a")               # Too short (< 3 chars)
    assert not SLUG_REGEX.match("-stripe")         # Starts with hyphen
    assert not SLUG_REGEX.match("stripe-")         # Ends with hyphen
    assert not SLUG_REGEX.match("stripe/careers")   # Contains slash
    assert not SLUG_REGEX.match("Stripe")          # Has uppercase letters

    # Blacklisted terms
    blacklisted_examples = ["jobs", "careers", "search", "api", "dashboard", "terms"]
    for slug in blacklisted_examples:
        assert slug in SLUG_BLACKLIST


def test_extract_slug_from_url():
    """Validate URL parsing handles Greenhouse, Lever, and Ashby domains."""
    urls = [
        ("https://boards.greenhouse.io/stripe/jobs/12345", ("greenhouse", "stripe")),
        ("https://job-boards.greenhouse.io/figma/jobs/67890", ("greenhouse", "figma")),
        ("https://jobs.lever.co/netflix/abc-123", ("lever", "netflix")),
        ("https://jobs.ashbyhq.com/openai/xyz-999", ("ashby", "openai")),
        ("https://google.com/search?q=jobs", None),
        ("https://boards.greenhouse.io/jobs", None),  # 'jobs' is blacklisted
    ]
    for url, expected in urls:
        assert extract_slug_from_url(url) == expected


def test_clean_html_utility():
    """Verify HTML cleaning strips script tags, HTML entities, and unnecessary tags."""
    raw = "<p>Join our <strong>innovative</strong> team &amp; build &lt;future&gt; systems.</p><script>alert(1)</script>"
    cleaned = _clean_html(raw)
    assert "Join our innovative team & build <future> systems." in cleaned
    assert "script" not in cleaned
    assert "<p>" not in cleaned


@pytest.mark.asyncio
async def test_greenhouse_adapter_parsing():
    """Test fetch_greenhouse_listings parses response and handles payload optimization."""
    mock_response = httpx.Response(
        200,
        json={
            "jobs": [
                {
                    "id": 4829102,
                    "title": "Senior Distributed Systems Engineer",
                    "absolute_url": "https://boards.greenhouse.io/stripe/jobs/4829102",
                    "location": {"name": "Remote - US"},
                }
            ]
        },
        request=httpx.Request("GET", "https://boards-api.greenhouse.io/v1/boards/stripe/jobs"),
    )
    client = AsyncMock()
    client.get.return_value = mock_response

    jobs = await fetch_greenhouse_listings("stripe", client)
    assert len(jobs) == 1
    job = jobs[0]
    assert job["external_id"] == "4829102"
    assert job["company"] == "Stripe"
    assert job["title"] == "Senior Distributed Systems Engineer"
    assert job["location"] == "Remote - US"
    assert job["ats"] == "greenhouse"
    assert job["description"] is None  # Greenhouse descriptions are fetched lazily for top shortlist


def test_word_boundary_matching():
    """
    Ensure word-boundary regex checks avoid naive substring bugs
    (e.g., 'C' matching 'Cloud', 'Go' matching 'Algorithm' or 'Good').
    """
    # Matches
    assert _has_word("Go", "Backend Go Developer")
    assert _has_word("Go", "Golang / Go programming")
    assert _has_word("C", "C / C++ Systems Programmer")
    assert _has_word("React", "Looking for React or React Native engineer")

    # Should NOT match
    assert not _has_word("Go", "Good understanding of Algorithm")
    assert not _has_word("C", "Cloud Infrastructure Architect")
    assert not _has_word("Java", "JavaScript and Node.js Developer")
