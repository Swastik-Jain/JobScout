"""
Repo Agent
━━━━━━━━━━
Inspects GitHub repositories using the GitHub REST API:
- Languages breakdown (exact bytes & percentages)
- Commit count (retrieved from GitHub pagination Link header)
- File tree & directory structure (frameworks, Docker, CI/CD, tests)
- Decoded README excerpt
- Star count & repository metadata

Passes concrete inspected data to Gemini to evaluate architectural complexity,
verified tech stacks, and resume-ready technical endorsements.
Only marks `verified = True` when the GitHub REST API actually confirms and inspects the repo.
"""

import os
import re
import json
import base64
import asyncio
from typing import List, Dict, Tuple, Optional, AsyncGenerator
import httpx
from google import genai
from google.genai import types

from app.core.config import settings

# Key architectural & configuration files to scan in the tree
SIGNIFICANT_FILES = {
    "package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "requirements.txt", "pyproject.toml", "pipfile", "setup.py",
    "dockerfile", "docker-compose.yml", "docker-compose.yaml",
    "tsconfig.json", "vite.config.ts", "vite.config.js", "next.config.js", "next.config.ts",
    "go.mod", "cargo.toml", "pom.xml", "build.gradle",
    "makefile", ".env.example", ".gitignore"
}


def parse_github_url(url: str) -> Optional[Tuple[str, str]]:
    """Extract (owner, repo) from a GitHub URL."""
    if not url:
        return None
    cleaned = url.strip().rstrip("/")
    if cleaned.endswith(".git"):
        cleaned = cleaned[:-4]
    
    # Match https://github.com/owner/repo or git@github.com:owner/repo
    m = re.search(r"github\.com[/:]([\w.-]+)/([\w.-]+)", cleaned, re.IGNORECASE)
    if m:
        return m.group(1), m.group(2)

    # Fallback for owner/repo format
    parts = [p for p in cleaned.split("/") if p]
    if len(parts) >= 2 and not cleaned.startswith("http"):
        return parts[-2], parts[-1]
    return None


def _extract_repo_name(url: str) -> str:
    parsed = parse_github_url(url)
    if parsed:
        return parsed[1]
    cleaned = url.strip().rstrip("/")
    parts = cleaned.split("/")
    return parts[-1] if parts else url


async def fetch_github_repo_data(url: str, client: httpx.AsyncClient) -> Dict:
    """
    Fetch repository ground truth directly from the GitHub REST API:
    - Repository metadata (description, stars, default branch)
    - Languages breakdown
    - Commit count
    - File tree & significant architecture files
    - Decoded README excerpt
    """
    parsed = parse_github_url(url)
    if not parsed:
        return {
            "url": url,
            "name": _extract_repo_name(url),
            "owner": "",
            "verified": False,
            "error": "Invalid GitHub repository URL format",
        }

    owner, repo = parsed
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "JobScout-RepoAgent",
    }
    if settings.github_token:
        headers["Authorization"] = f"Bearer {settings.github_token}"

    base_api = f"https://api.github.com/repos/{owner}/{repo}"

    # 1. Fetch Repository Details
    try:
        repo_resp = await client.get(base_api, headers=headers)
        if repo_resp.status_code == 404:
            return {
                "url": url,
                "name": repo,
                "owner": owner,
                "verified": False,
                "error": "Repository not found or private (HTTP 404)",
            }
        elif repo_resp.status_code in (403, 429):
            return {
                "url": url,
                "name": repo,
                "owner": owner,
                "verified": False,
                "error": "GitHub API rate limit exceeded (set GITHUB_TOKEN in backend/.env for authenticated limits)",
            }
        elif repo_resp.status_code != 200:
            return {
                "url": url,
                "name": repo,
                "owner": owner,
                "verified": False,
                "error": f"GitHub API error (HTTP {repo_resp.status_code})",
            }

        repo_info = repo_resp.json()
        default_branch = repo_info.get("default_branch") or "main"
        description = repo_info.get("description") or ""
        stars = repo_info.get("stargazers_count", 0)
        forks = repo_info.get("forks_count", 0)
        topics = repo_info.get("topics") or []

    except Exception as e:
        return {
            "url": url,
            "name": repo,
            "owner": owner,
            "verified": False,
            "error": f"Network error connecting to GitHub: {str(e)}",
        }

    # 2. Concurrently fetch Languages, Commits, File Tree, and README
    languages_pct = {}
    commit_count = 0
    significant_files = []
    key_dirs = []
    total_files = 0
    has_ci = False
    has_tests = False
    readme_text = ""

    async def get_languages():
        nonlocal languages_pct
        try:
            r = await client.get(f"{base_api}/languages", headers=headers)
            if r.status_code == 200:
                raw_langs = r.json()
                total_bytes = sum(raw_langs.values())
                if total_bytes > 0:
                    for lang, b in sorted(raw_langs.items(), key=lambda item: item[1], reverse=True):
                        pct = round((b / total_bytes) * 100, 1)
                        if pct >= 0.5:
                            languages_pct[lang] = f"{pct}%"
        except Exception:
            pass

    async def get_commit_count():
        nonlocal commit_count
        try:
            r = await client.get(f"{base_api}/commits?per_page=1", headers=headers)
            if r.status_code == 200:
                link_header = r.headers.get("Link", "")
                m = re.search(r'[?&]page=(\d+)[^>]*>;\s*rel="last"', link_header)
                if m:
                    commit_count = int(m.group(1))
                else:
                    commits = r.json()
                    commit_count = len(commits) if isinstance(commits, list) else 1
        except Exception:
            commit_count = 1

    async def get_tree():
        nonlocal significant_files, key_dirs, total_files, has_ci, has_tests
        try:
            r = await client.get(f"{base_api}/git/trees/{default_branch}?recursive=1", headers=headers)
            if r.status_code == 200:
                tree_data = r.json().get("tree", [])
                total_files = len(tree_data)
                dirs_set = set()
                sig_found = []

                for item in tree_data:
                    path = item.get("path", "")
                    path_lower = path.lower()

                    if "/" in path:
                        top_dir = path.split("/")[0]
                        if not top_dir.startswith("."):
                            dirs_set.add(top_dir)

                    filename = path.split("/")[-1].lower()
                    if filename in SIGNIFICANT_FILES and path not in sig_found:
                        sig_found.append(path)

                    if ".github/workflows" in path_lower:
                        has_ci = True
                    if "test" in path_lower:
                        has_tests = True

                significant_files = sig_found[:12]
                key_dirs = sorted(list(dirs_set))[:8]
            else:
                # Fallback to contents endpoint for top-level files
                r2 = await client.get(f"{base_api}/contents", headers=headers)
                if r2.status_code == 200:
                    contents = r2.json()
                    total_files = len(contents)
                    for item in contents:
                        name = item.get("name", "")
                        if item.get("type") == "dir" and not name.startswith("."):
                            key_dirs.append(name)
                        elif name.lower() in SIGNIFICANT_FILES:
                            significant_files.append(name)
        except Exception:
            pass

    async def get_readme():
        nonlocal readme_text
        try:
            r = await client.get(f"{base_api}/readme", headers=headers)
            if r.status_code == 200:
                content_b64 = r.json().get("content", "")
                if content_b64:
                    raw_md = base64.b64decode(content_b64).decode("utf-8", errors="ignore")
                    # Clean up excessive whitespace/lines
                    clean_lines = [l.strip() for l in raw_md.splitlines() if l.strip()]
                    readme_text = "\n".join(clean_lines[:30])
        except Exception:
            pass

    await asyncio.gather(
        get_languages(),
        get_commit_count(),
        get_tree(),
        get_readme(),
    )

    return {
        "url": url,
        "name": repo,
        "owner": owner,
        "verified": True,
        "description": description,
        "stars": stars,
        "forks": forks,
        "topics": topics,
        "default_branch": default_branch,
        "languages": languages_pct,
        "commit_count": commit_count,
        "significant_files": significant_files,
        "key_dirs": key_dirs,
        "total_files": total_files,
        "has_ci": has_ci,
        "has_tests": has_tests,
        "readme_excerpt": readme_text[:1200] if readme_text else "No README provided.",
    }


def _build_repo_analysis_prompt(inspected_repos: List[Dict]) -> str:
    repo_blocks = []
    for r in inspected_repos:
        if r.get("verified"):
            langs_str = ", ".join(f"{k} ({v})" for k, v in r.get("languages", {}).items()) or "None detected"
            sig_files = ", ".join(r.get("significant_files", [])) or "None identified"
            dirs = ", ".join(r.get("key_dirs", [])) or "None identified"
            ci_status = "Yes (.github/workflows detected)" if r.get("has_ci") else "Not detected"
            tests_status = "Yes" if r.get("has_tests") else "Not detected"

            block = f"""REPOSITORY: {r.get('url')}
- Status: VERIFIED via GitHub REST API
- Repository Name: {r.get('name')} (Owner: {r.get('owner')})
- Description: {r.get('description') or 'None'}
- Stars: {r.get('stars', 0)} | Forks: {r.get('forks', 0)}
- Total Commits: {r.get('commit_count', 0)}
- Languages Breakdown: {langs_str}
- Significant Build / Config Files: {sig_files}
- Root Directories: {dirs}
- CI/CD Pipelines: {ci_status}
- Automated Tests: {tests_status}
- README Excerpt:
{r.get('readme_excerpt', 'None')}
"""
        else:
            block = f"""REPOSITORY: {r.get('url')}
- Status: UNVERIFIED (GitHub API error: {r.get('error', 'Inaccessible')})
- Repository Name: {r.get('name')}
- NOTE: This repository could NOT be verified via GitHub REST API. Mark verified: false and state the reason in agent_comment.
"""
        repo_blocks.append(block)

    full_context = "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n".join(repo_blocks)

    return f"""You are a Senior DevOps and Code Intelligence Agent.
You are given ground-truth repository data directly fetched from the GitHub REST API (languages, commit count, file tree, build configs, and README).

{full_context}

YOUR TASK:
For each repository:
1. If Status is VERIFIED:
   - Identify the concrete technology stack directly proven by the language percentages, package manifests, and directory structure.
   - Evaluate true project complexity (1–10 scale) based on commit depth, code volume, presence of containerization/Docker, CI/CD, and tests.
   - Determine architectural pattern (e.g. Full-Stack SPA + Async REST API, Microservices, Event-Driven Pipeline, CLI Tool, Monolith).
   - Write an evidence-based technical endorsement for a resume citing concrete numbers (e.g. "Verified 142 commits with FastAPI + React architecture, Docker containerization, and automated CI workflows.").
   - Set `verified: true`.
2. If Status is UNVERIFIED:
   - Set `verified: false`.
   - Set `complexity_score: 0`.
   - In `agent_comment`, clearly explain: "Unverified: Repository could not be confirmed on GitHub ({r.get('error', 'Not found')})."

Return STRICTLY valid JSON matching this schema:
{{
  "repos": [
    {{
      "url": "https://github.com/...",
      "name": "repo-name",
      "verified": true,
      "tech": ["Python", "FastAPI", "React", "Docker"],
      "commit_count": 142,
      "complexity_score": 8,
      "architecture_pattern": "REST API + SPA",
      "agent_comment": "Verified 142 commits with containerized FastAPI backend and React frontend.",
      "sme_tag": null
    }}
  ],
  "detected_skills": ["Python", "FastAPI", "React", "Docker"],
  "verified_skills": ["Python", "FastAPI", "React", "Docker"],
  "ml_mismatch": false,
  "overall_complexity": 7.5
}}"""


async def analyze_repos_async(repo_links: List[str]) -> Tuple[Dict, List[Dict]]:
    """Fetch GitHub REST API metadata for all links, then analyze with Gemini."""
    async with httpx.AsyncClient(timeout=12.0) as client:
        inspected = await asyncio.gather(*(fetch_github_repo_data(url, client) for url in repo_links))

    client_genai = genai.Client(api_key=settings.google_api_key)
    prompt = _build_repo_analysis_prompt(list(inspected))

    response = client_genai.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.2,
        ),
    )
    result = json.loads(response.text)

    # Strictly align verified flag with actual GitHub API verification
    inspected_map = {r["url"]: r for r in inspected}
    for repo in result.get("repos", []):
        raw = inspected_map.get(repo.get("url", ""))
        is_truly_verified = bool(raw and raw.get("verified"))
        repo["verified"] = is_truly_verified
        if raw and is_truly_verified:
            repo["commit_count"] = raw.get("commit_count", 0)
            repo["stars"] = raw.get("stars", 0)

    # verified_skills must only include skills from verified repos
    if not any(r.get("verified") for r in result.get("repos", [])):
        result["verified_skills"] = []

    return result, list(inspected)


def analyze_repos_sync(repo_links: List[str]) -> Dict:
    """Synchronous entrypoint for compatibility."""
    result, _ = asyncio.run(analyze_repos_async(repo_links))
    return result


async def stream_repo_analysis(repo_links: List[str]) -> AsyncGenerator[str, None]:
    """
    Streams live real-time progress logs as GitHub REST API endpoints are queried,
    runs the Gemini Intelligence Layer on actual repo evidence, and yields the payload.
    """
    if not repo_links:
        yield json.dumps({"type": "error", "message": "[RepoAgent] ➔ No repository links provided."})
        return

    yield json.dumps({"type": "log", "log": "[RepoAgent] ➔ Initializing GitHub REST API handshake..."})
    await asyncio.sleep(0.2)

    inspected_repos: List[Dict] = []

    async with httpx.AsyncClient(timeout=12.0) as http_client:
        for url in repo_links:
            parsed = parse_github_url(url)
            if not parsed:
                yield json.dumps({
                    "type": "log",
                    "log": f"[RepoAgent] ➔ [{url}] Invalid GitHub URL format. Marked as unverified.",
                })
                inspected_repos.append({
                    "url": url,
                    "name": _extract_repo_name(url),
                    "owner": "",
                    "verified": False,
                    "error": "Invalid GitHub repository URL",
                })
                continue

            owner, repo = parsed
            yield json.dumps({
                "type": "log",
                "log": f"[RepoAgent] ➔ [{owner}/{repo}] Querying GitHub REST API (languages, tree, README, commits)...",
            })

            data = await fetch_github_repo_data(url, http_client)
            inspected_repos.append(data)

            if data.get("verified"):
                top_langs = ", ".join(list(data.get("languages", {}).keys())[:3]) or "None"
                commits = data.get("commit_count", 0)
                files = data.get("total_files", 0)
                yield json.dumps({
                    "type": "log",
                    "log": f"[RepoAgent] ➔ [{repo}] Verified: {commits} commits, {files} files, languages: {top_langs}.",
                })
            else:
                err_msg = data.get("error", "Not accessible")
                yield json.dumps({
                    "type": "log",
                    "log": f"[RepoAgent] ➔ [{repo}] Verification failed: {err_msg}. Marked as unverified.",
                })

            await asyncio.sleep(0.3)

    # Run Gemini synthesis on real inspected data
    yield json.dumps({
        "type": "log",
        "log": "[RepoAgent] ➔ Synthesizing repository architecture with Gemini Intelligence Layer...",
    })

    try:
        client_genai = genai.Client(api_key=settings.google_api_key)
        prompt = _build_repo_analysis_prompt(inspected_repos)

        response = client_genai.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )
        result = json.loads(response.text)

        # Enforce ground-truth verification flags
        inspected_map = {r["url"]: r for r in inspected_repos}
        for repo in result.get("repos", []):
            raw = inspected_map.get(repo.get("url", ""))
            is_truly_verified = bool(raw and raw.get("verified"))
            repo["verified"] = is_truly_verified
            if raw and is_truly_verified:
                repo["commit_count"] = raw.get("commit_count", 0)
                repo["stars"] = raw.get("stars", 0)

        verified_count = sum(1 for r in result.get("repos", []) if r.get("verified"))
        total_count = len(repo_links)

        if not verified_count:
            result["verified_skills"] = []
            yield json.dumps({
                "type": "log",
                "log": f"[RepoAgent] ➔ Complete. 0/{total_count} repositories verified. Unverified repos marked accordingly.",
            })
        else:
            yield json.dumps({
                "type": "log",
                "log": f"[RepoAgent] ➔ Complete. {verified_count}/{total_count} repository tech stack(s) verified via GitHub REST API.",
            })

        yield json.dumps({"type": "result", "data": result})

    except Exception as e:
        # Fallback payload: report inspected status without crashing
        fallback_repos = []
        for r in inspected_repos:
            fallback_repos.append({
                "url": r.get("url", ""),
                "name": r.get("name", ""),
                "verified": r.get("verified", False),
                "tech": list(r.get("languages", {}).keys()),
                "commit_count": r.get("commit_count", 0),
                "complexity_score": 5 if r.get("verified") else 0,
                "architecture_pattern": "Inspected Repository" if r.get("verified") else "Unverified",
                "agent_comment": (
                    f"GitHub REST API inspected: {r.get('commit_count', 0)} commits across "
                    f"{', '.join(r.get('languages', {}).keys()) or 'languages'}."
                    if r.get("verified")
                    else f"Unverified: {r.get('error', 'GitHub API error')}"
                ),
            })
        fallback_data = {
            "repos": fallback_repos,
            "detected_skills": [t for repo in fallback_repos for t in repo.get("tech", [])],
            "verified_skills": [t for repo in fallback_repos if repo.get("verified") for t in repo.get("tech", [])],
            "overall_complexity": 5.0 if any(r.get("verified") for r in fallback_repos) else 0.0,
        }
        yield json.dumps({"type": "log", "log": f"[RepoAgent] ➔ Gemini synthesis notice: {str(e)[:100]}. Returning raw inspected data."})
        yield json.dumps({"type": "result", "data": fallback_data})
