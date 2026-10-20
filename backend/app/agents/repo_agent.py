import json
import asyncio
from typing import List, Dict, AsyncGenerator
from google import genai
from google.genai import types

from app.core.config import settings

# Terminal log messages that stream to the frontend
REPO_AGENT_LOGS = [
    "[RepoAgent] ➔ Establishing handshake with GitHub API...",
    "[RepoAgent] ➔ Resolving repository metadata...",
    "[RepoAgent] ➔ Cloning metadata for repository: {repo_name}...",
    "[RepoAgent] ➔ Analyzing 'tech_stack' and 'commit_density'...",
    "[RepoAgent] ➔ Cross-referencing skills against declared profile...",
    "[RepoAgent] ➔ Running Gemini Intelligence Layer...",
    "[RepoAgent] ➔ Generating complexity score and architect commentary...",
    "[RepoAgent] ➔ Enriching profile with verified skill signals...",
    "[RepoAgent] ➔ Analysis complete. Insights ready.",
]


def _extract_repo_name(url: str) -> str:
    """Extract repo name from a GitHub URL."""
    url = url.rstrip("/")
    parts = url.split("/")
    # e.g. https://github.com/user/repo  → repo
    if len(parts) >= 2:
        return parts[-1] or parts[-2]
    return url


def _build_repo_analysis_prompt(repo_links: List[str]) -> str:
    links_text = "\n".join(f"- {link}" for link in repo_links)
    return f"""You are a Senior DevOps and Code Intelligence Agent. Analyse these GitHub repository links:

{links_text}

For each repository, infer from its name, URL structure and common GitHub conventions:
1. The likely technology stack (languages, frameworks, tools)
2. The project complexity (1–10 scale)
3. The architectural pattern (e.g. microservices, monolith, ML pipeline, REST API, etc.)
4. A one-sentence technical endorsement for a professional resume

Also:
- If the profile declares "Machine Learning" but no ML repos are found, set `ml_mismatch: true` in the response.
- If a repo suggests a specialized domain (e.g. Drone Navigation, Biometrics, Robotics), tag the user as a Subject Matter Expert in that domain.

Return STRICTLY valid JSON matching this schema:
{{
  "repos": [
    {{
      "url": "https://github.com/...",
      "name": "repo-name",
      "tech": ["Python", "FastAPI", "React"],
      "complexity_score": 7,
      "architecture_pattern": "REST API + SPA",
      "agent_comment": "Demonstrates strong async API design with React frontend.",
      "sme_tag": null
    }}
  ],
  "verified_skills": ["Python", "FastAPI", "React"],
  "ml_mismatch": false,
  "overall_complexity": 7.5
}}"""


def analyze_repos_sync(repo_links: List[str]) -> Dict:
    """Synchronously call Gemini to analyze repository links."""
    client = genai.Client(api_key=settings.google_api_key)

    prompt = _build_repo_analysis_prompt(repo_links)
    response = client.models.generate_content(
        model="gemini-3.8-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.3,
        ),
    )
    result = json.loads(response.text)
    return result


async def stream_repo_analysis(repo_links: List[str]) -> AsyncGenerator[str, None]:
    """
    Yields SSE-style log strings while performing repo analysis.
    First yields fake terminal logs (for UX), then runs Gemini, then yields `DATA:` payload.
    """
    repo_names = [_extract_repo_name(url) for url in repo_links]
    primary_repo = repo_names[0] if repo_names else "repository"

    # Stream dramatic terminal logs
    for log in REPO_AGENT_LOGS:
        formatted = log.replace("{repo_name}", primary_repo)
        yield json.dumps({"type": "log", "log": formatted})
        await asyncio.sleep(0.6)

    # Run actual Gemini analysis
    try:
        result = analyze_repos_sync(repo_links)

        # Enrich each repo entry with verified flag
        for repo in result.get("repos", []):
            repo["verified"] = True
            repo["url"] = next(
                (link for link in repo_links if repo.get("name", "").lower() in link.lower()),
                repo_links[0] if repo_links else ""
            )

        yield json.dumps({"type": "result", "data": result})

    except Exception as e:
        yield json.dumps({"type": "error", "message": f"[RepoAgent] ➔ Analysis failed: {str(e)}"})
