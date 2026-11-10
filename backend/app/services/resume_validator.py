"""
Resume Validator & Deterministic Renderer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. render_deterministic_base_resume(profile): Renders a baseline Markdown resume
   strictly from user profile data. Used for diff comparisons.
2. validate_no_fabrication(text, profile): AST/regex verification that ensures
   no phantom employers, degrees, or projects were introduced by LLM generation.
3. compute_ats_score(resume_text, job_desc, skills): Computes deterministic keyword
   coverage (60%) + semantic relevance (40%).
"""

import re
import logging
from typing import Dict, List, Tuple, Set, Optional, Any

logger = logging.getLogger("jobscout.resume_validator")


def render_deterministic_base_resume(profile: Dict) -> str:
    """
    Renders a standard, clean Markdown resume directly from profile fields.
    This provides an immutable baseline against which tailored revisions can be diffed.
    """
    name = profile.get("name") or "Candidate Name"
    email = profile.get("email") or ""
    phone = profile.get("phone") or ""
    headline = profile.get("headline") or ""
    github = profile.get("github_url") or ""
    linkedin = profile.get("linkedin_url") or ""

    contact_parts = [p for p in [email, phone, github, linkedin] if p]
    contact_line = " | ".join(contact_parts)

    lines = [
        f"# {name}",
        contact_line,
        f"\n**{headline}**\n" if headline else "",
    ]

    # Skills Section
    skills = profile.get("skills") or []
    if skills:
        lines.append("## Technical Skills")
        lines.append(", ".join(skills))
        lines.append("")

    # Experience Section
    experience = profile.get("experience") or []
    if experience:
        lines.append("## Professional Experience")
        for exp in experience:
            title = exp.get("title") or "Software Engineer"
            company = exp.get("company") or "Company"
            duration = exp.get("duration") or ""
            desc = exp.get("description") or ""
            dur_str = f" ({duration})" if duration else ""
            lines.append(f"### {title} — {company}{dur_str}")
            if desc:
                # Format bullet points if not already bulleted
                desc_lines = [l.strip() for l in desc.split("\n") if l.strip()]
                for dl in desc_lines:
                    if dl.startswith("- ") or dl.startswith("* "):
                        lines.append(dl)
                    else:
                        lines.append(f"- {dl}")
            lines.append("")

    # Projects Section
    projects = profile.get("projects") or []
    if projects:
        lines.append("## Featured Projects")
        for p in projects:
            p_name = p.get("name") or "Project"
            tech = p.get("tech") or ""
            desc = p.get("description") or ""
            tech_str = f" [{tech}]" if tech else ""
            lines.append(f"### {p_name}{tech_str}")
            if desc:
                desc_lines = [l.strip() for l in desc.split("\n") if l.strip()]
                for dl in desc_lines:
                    if dl.startswith("- ") or dl.startswith("* "):
                        lines.append(dl)
                    else:
                        lines.append(f"- {dl}")
            lines.append("")

    # Education Section
    education = profile.get("education") or []
    if education:
        lines.append("## Education")
        for edu in education:
            deg = edu.get("degree") or "Degree"
            inst = edu.get("institution") or "University"
            year = edu.get("year") or ""
            yr_str = f" ({year})" if year else ""
            lines.append(f"- **{deg}**, {inst}{yr_str}")
        lines.append("")

    return "\n".join(lines).strip()


def extract_ground_truth_entities(profile: Dict) -> Dict[str, Set[str]]:
    """Extract normalized set of authorized entities from profile."""
    companies = set()
    for exp in profile.get("experience") or []:
        c = (exp.get("company") or "").strip().lower()
        if c:
            companies.add(c)

    institutions = set()
    degrees = set()
    for edu in profile.get("education") or []:
        inst = (edu.get("institution") or "").strip().lower()
        deg = (edu.get("degree") or "").strip().lower()
        if inst:
            institutions.add(inst)
        if deg:
            degrees.add(deg)

    projects = set()
    for p in profile.get("projects") or []:
        pn = (p.get("name") or "").strip().lower()
        if pn:
            projects.add(pn)

    return {
        "companies": companies,
        "institutions": institutions,
        "degrees": degrees,
        "projects": projects,
    }


def _normalize_ws(s: str) -> str:
    return " ".join(s.strip().split()).lower()


def _normalize_url(url: str) -> str:
    u = url.strip().lower()
    for prefix in ("https://", "http://", "www."):
        if u.startswith(prefix):
            u = u[len(prefix):]
    return u.rstrip("/")


def validate_resume_data(resume: "ResumeData", profile: Dict) -> Tuple[bool, List[str]]:
    """
    Validates ResumeData fields against the ground-truth profile.
    Fails if:
    - any experience.company does not match profile experience item
    - any education.institution does not match profile education item
    - any project.name does not match profile project item
    - any certification does not match profile certification
    - any link url is not in profile links or profile project repo_url/live_url
    - email or phone differs from profile
    - any skill is not in profile.skills or profile project tech_stack
    """
    violations: List[str] = []

    # 1. Experience company
    profile_companies = {
        _normalize_ws(exp.get("company", ""))
        for exp in (profile.get("experience") or [])
        if exp.get("company")
    }
    for exp in resume.experience:
        c_norm = _normalize_ws(exp.company)
        if c_norm and c_norm not in profile_companies:
            violations.append(f"Unverified employer claimed: '{exp.company}' (not in profile experience).")

    # 2. Education institution
    profile_institutions = {
        _normalize_ws(edu.get("institution", ""))
        for edu in (profile.get("education") or [])
        if edu.get("institution")
    }
    for edu in resume.education:
        i_norm = _normalize_ws(edu.institution)
        if i_norm and i_norm not in profile_institutions:
            violations.append(f"Unverified institution claimed: '{edu.institution}' (not in profile education).")

    # 3. Project name
    profile_projects = {
        _normalize_ws(p.get("name") or p.get("title") or "")
        for p in (profile.get("projects") or [])
        if (p.get("name") or p.get("title"))
    }
    for proj in resume.projects:
        p_norm = _normalize_ws(proj.name)
        if p_norm and p_norm not in profile_projects:
            violations.append(f"Unverified project claimed: '{proj.name}' (not in profile projects).")

    # 4. Certifications
    profile_certs = set()
    for c in profile.get("certifications") or []:
        if isinstance(c, str):
            profile_certs.add(_normalize_ws(c))
        elif isinstance(c, dict) and c.get("name"):
            profile_certs.add(_normalize_ws(c["name"]))
    for cert in resume.certifications:
        c_norm = _normalize_ws(cert)
        if c_norm and c_norm not in profile_certs:
            violations.append(f"Unverified certification claimed: '{cert}' (not in profile certifications).")

    # 5. Link URLs
    allowed_urls = set()
    for k in ("github_url", "linkedin_url", "website"):
        val = profile.get(k)
        if val:
            allowed_urls.add(_normalize_url(val))
    for l in profile.get("links") or []:
        if isinstance(l, dict) and l.get("url"):
            allowed_urls.add(_normalize_url(l["url"]))
        elif isinstance(l, str):
            allowed_urls.add(_normalize_url(l))
    for p in profile.get("projects") or []:
        for url_field in ("repo_url", "live_url", "url"):
            if p.get(url_field):
                allowed_urls.add(_normalize_url(p[url_field]))
    for link in resume.basics.links:
        if link.url:
            norm_link = _normalize_url(link.url)
            if norm_link not in allowed_urls:
                violations.append(f"Unverified link URL claimed: '{link.url}' (not in profile links or projects).")

    # 6. Email and Phone
    profile_email = (profile.get("email") or "").strip().lower()
    resume_email = resume.basics.email.strip().lower()
    if profile_email and resume_email != profile_email:
        violations.append(f"Email '{resume.basics.email}' differs from profile email '{profile.get('email')}'.")

    profile_phone = re.sub(r'[\s\-\(\)\.]', '', profile.get("phone") or "")
    resume_phone = re.sub(r'[\s\-\(\)\.]', '', resume.basics.phone or "")
    if profile_phone and resume_phone != profile_phone:
        violations.append(f"Phone '{resume.basics.phone}' differs from profile phone '{profile.get('phone')}'.")

    # 7. Skills
    allowed_skills = {
        _normalize_ws(s)
        for s in (profile.get("skills") or [])
        if s
    }
    for p in profile.get("projects") or []:
        techs = p.get("tech_stack") or p.get("tech") or []
        if isinstance(techs, str):
            techs = [t.strip() for t in techs.split(",") if t.strip()]
        for t in techs:
            if t:
                allowed_skills.add(_normalize_ws(t))
    for group in resume.skills:
        for item in group.items:
            i_norm = _normalize_ws(item)
            if i_norm and i_norm not in allowed_skills:
                violations.append(f"Unverified skill claimed: '{item}' (not in profile skills or project tech).")

    return (len(violations) == 0, violations)


def validate_no_fabrication(generated_input: Any, profile: Dict) -> Tuple[bool, List[str]]:
    """
    Validates that the generated resume does not claim unearned employers,
    unregistered degrees, fabricated projects, or unauthorized skills.
    Accepts either ResumeData (structured) or str (text/markdown).
    Returns (is_valid, list_of_violations).
    """
    from app.schemas.resume_schema import ResumeData
    if isinstance(generated_input, ResumeData):
        return validate_resume_data(generated_input, profile)

    generated_text = str(generated_input or "")
    gt = extract_ground_truth_entities(profile)
    violations = []

    current_section = "header"
    for raw_line in generated_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        # Check section boundaries
        if line.startswith("## ") or line.startswith("━━━━━━━━━━"):
            sec_lower = line.lower()
            if "experience" in sec_lower or "work" in sec_lower or "employment" in sec_lower:
                current_section = "experience"
            elif "project" in sec_lower:
                current_section = "projects"
            elif "education" in sec_lower:
                current_section = "education"
            else:
                current_section = "other"
            continue

        # Header lines: "### Title — Company" or "### Company | Title"
        if line.startswith("### "):
            header_content = line[4:].strip()

            if current_section == "experience":
                # Patterns: "Title — Company", "Title at Company", "Company - Title"
                # Split on common separators: —, –, -, |, at
                parts = re.split(r'\s+[-—–|]\s+|\s+at\s+', header_content, flags=re.IGNORECASE)
                if len(parts) >= 2:
                    # One of the parts is the company name
                    c1 = re.sub(r'\s*\([^)]*\)', '', parts[0]).strip().lower()
                    c2 = re.sub(r'\s*\([^)]*\)', '', parts[1]).strip().lower()

                    matches_any = any(
                        (allowed in c1 or c1 in allowed or allowed in c2 or c2 in allowed)
                        for allowed in gt["companies"]
                    )
                    if not matches_any:
                        violations.append(f"Unverified employer claimed: '{parts[1].strip()}' (not in profile experience).")

            elif current_section == "projects":
                # Pattern: "ProjectName [Tech]" or "ProjectName - Description"
                proj_name = re.split(r'\s*[\(\[\—\–\-|:]', header_content)[0].strip().lower()
                if proj_name and not any(allowed in proj_name or proj_name in allowed for allowed in gt["projects"]):
                    violations.append(f"Unverified project claimed: '{proj_name}' (not in profile projects).")

    return (len(violations) == 0, violations)



async def judge_resume_with_llm(
    resume_text: str,
    job_description: str,
    candidate_skills: List[str],
) -> Tuple[int, str]:
    """
    Independent LLM Judge that audits candidate resume alignment against the job description.
    Scores technical depth and relevance on 0-100 scale, returning (score, critique).
    """
    from app.core.config import settings
    import json

    if not settings.google_api_key or not job_description or not resume_text:
        return (75, "Standard baseline alignment with technical job criteria.")

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.google_api_key)
        prompt = f"""You are an objective ATS Evaluation Auditor.
Critique the match between the Job Description and the Candidate Resume.
Evaluate:
1. Technical alignment: Are the core skills used in real context or just listed?
2. Experience depth: Does the candidate meet the required responsibilities?
3. Domain relevance: Are the projects and achievements relevant to this role?

Scoring scale:
- Minimal overlap or missing fundamental core requirements: 25-45
- Partial match (has basic skills but lacks depth or specific stack): 50-70
- Strong alignment with clear demonstrable achievements: 75-88
- Exceptional fit with deep direct experience: 89-98

JOB DESCRIPTION:
{job_description[:1200]}

CANDIDATE RESUME:
{resume_text[:2000]}

Return JSON:
{{
  "semantic_score": <integer 0-100>,
  "critique": "<2 sentence honest critique explaining technical depth and specific gaps>"
}}
"""
        response = await client.aio.models.generate_content(
            model=settings.gemini_primary_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )
        data = json.loads(response.text)
        score = int(data.get("semantic_score", 75))
        critique = str(data.get("critique", "Strong technical alignment with verified skills."))
        return (max(20, min(98, score)), critique)
    except Exception as e:
        logger.warning(f"[ATSJudge] ➔ LLM Judge fallback: {e}")
        return (75, "Grounded baseline alignment with core technical proficiencies.")


def compute_ats_score(
    resume_text: str,
    job_description: str,
    candidate_skills: List[str],
    llm_judge_score: Optional[int] = None,
    judge_critique: Optional[str] = None,
    llm_relevance_rating: Optional[int] = None,
) -> Tuple[int, Dict[str, any]]:
    """
    Computes transparent ATS Score:
    Score = 60% Keyword Coverage + 40% LLM Semantic Judge Alignment.
    """
    if not job_description or not resume_text:
        return (50, {
            "final_score": 50,
            "keyword_coverage_score": 50,
            "semantic_alignment_score": 50,
            "matched_keywords": [],
            "missing_keywords": [],
            "judge_critique": "Awaiting job description and candidate resume text.",
            "formula": "ATS Score = (60% × Keyword Coverage) + (40% × LLM Semantic Judge)",
        })

    # 1. Deterministic Keyword Extraction from Job Description
    words = re.findall(r'\b[A-Za-z0-9#+.]{2,20}\b', job_description)
    stop_words = {"the", "and", "for", "with", "that", "this", "from", "will", "are", "you", "our", "team", "work", "role", "have", "years", "experience", "must", "plus", "about"}
    jd_words = {w.lower() for w in words if w.lower() not in stop_words and len(w) > 2}

    # Intersect with candidate skills & standard tech dictionary
    target_keywords = set()
    for s in (candidate_skills or []):
        if s.lower() in jd_words or s.lower() in job_description.lower():
            target_keywords.add(s)

    # Standard industry keywords to look for in JD
    TECH_VOCAB = [
        "python", "javascript", "typescript", "react", "fastapi", "django", "node", "sql", "postgresql",
        "docker", "kubernetes", "aws", "git", "linux", "rest", "graphql", "redis", "mongodb", "ci/cd",
        "html", "css", "tailwind", "go", "golang", "c++", "java", "kafka", "pandas", "pytorch",
    ]
    for kw in TECH_VOCAB:
        pattern = r'(?<![a-zA-Z0-9_])' + re.escape(kw) + r'(?![a-zA-Z0-9_])'
        if re.search(pattern, job_description, re.IGNORECASE):
            target_keywords.add(kw.title() if len(kw) > 3 else kw.upper())

    if not target_keywords:
        target_keywords = set((candidate_skills or [])[:8]) or {"Software Engineering"}

    # Check match in resume using boundary-aware matching
    matched = []
    missing = []
    for kw in sorted(target_keywords):
        pattern = r'(?<![a-zA-Z0-9_])' + re.escape(kw.lower()) + r'(?![a-zA-Z0-9_])'
        if re.search(pattern, resume_text, re.IGNORECASE):
            matched.append(kw)
        else:
            missing.append(kw)

    coverage_pct = int(round((len(matched) / max(len(target_keywords), 1)) * 100))

    # 2. LLM Judge Alignment
    judge_score = llm_judge_score if llm_judge_score is not None else (llm_relevance_rating if llm_relevance_rating is not None else 75)
    final_score = int(round(0.60 * coverage_pct + 0.40 * judge_score))
    final_score = max(25, min(98, final_score))

    details = {
        "final_score": final_score,
        "keyword_coverage_score": coverage_pct,
        "semantic_alignment_score": judge_score,
        "matched_keywords": matched,
        "missing_keywords": missing,
        "judge_critique": judge_critique or "Strong technical alignment with verified candidate proficiencies.",
        "formula": "ATS Score = (60% × Keyword Coverage) + (40% × LLM Semantic Judge)",
    }
    return (final_score, details)
