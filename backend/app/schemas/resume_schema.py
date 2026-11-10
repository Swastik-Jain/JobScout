"""
Structured Resume Schema & Plain-Text Renderer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pydantic v2 schema for structured resume data generation and editing.
"""
from typing import List, Optional
from pydantic import BaseModel, field_validator


class ResumeLink(BaseModel):
    label: str
    url: str


class ResumeBasics(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    location: Optional[str] = None
    links: List[ResumeLink] = []


class SkillGroup(BaseModel):
    category: str
    items: List[str]


class ExperienceItem(BaseModel):
    role: str
    company: str
    location: Optional[str] = None
    start: str
    end: str
    bullets: List[str]

    @field_validator("bullets")
    @classmethod
    def validate_bullets(cls, v: List[str]) -> List[str]:
        if len(v) > 4:
            raise ValueError("bullets list cannot have more than 4 items")
        return v


class ProjectItem(BaseModel):
    name: str
    tech: List[str]
    url: Optional[str] = None
    bullets: List[str]

    @field_validator("bullets")
    @classmethod
    def validate_bullets(cls, v: List[str]) -> List[str]:
        if len(v) > 4:
            raise ValueError("bullets list cannot have more than 4 items")
        return v


class EducationItem(BaseModel):
    degree: str
    institution: str
    location: Optional[str] = None
    start: Optional[str] = None
    end: str
    score: Optional[str] = None


class ResumeData(BaseModel):
    basics: ResumeBasics
    summary: Optional[str] = None
    skills: List[SkillGroup]
    experience: List[ExperienceItem] = []
    projects: List[ProjectItem] = []
    education: List[EducationItem]
    certifications: List[str] = []

    @field_validator("skills")
    @classmethod
    def validate_skills(cls, v: List[SkillGroup]) -> List[SkillGroup]:
        if len(v) > 6:
            raise ValueError("skills cannot have more than 6 groups")
        return v

    @field_validator("projects")
    @classmethod
    def validate_projects(cls, v: List[ProjectItem]) -> List[ProjectItem]:
        if len(v) > 4:
            raise ValueError("projects cannot have more than 4 items")
        return v


def render_plain_text(resume: ResumeData) -> str:
    """
    Renders ResumeData to clean plain text in PDF order:
    Header, Summary (if present), Education, Skills, Experience, Projects, Certifications.
    No box-drawing characters.
    """
    lines: List[str] = []

    # Header line
    lines.append(resume.basics.name.strip())

    contact_parts: List[str] = []
    if resume.basics.email:
        contact_parts.append(resume.basics.email.strip())
    if resume.basics.phone:
        contact_parts.append(resume.basics.phone.strip())
    if resume.basics.location:
        contact_parts.append(resume.basics.location.strip())
    for link in resume.basics.links:
        if link.url:
            clean_url = link.url.replace("https://", "").replace("http://", "").rstrip("/")
            contact_parts.append(clean_url)
    if contact_parts:
        lines.append(" | ".join(contact_parts))
    lines.append("")

    # Summary (if present)
    if resume.summary and resume.summary.strip():
        lines.append("SUMMARY")
        lines.append(resume.summary.strip())
        lines.append("")

    # 1. Education
    if resume.education:
        lines.append("EDUCATION")
        for edu in resume.education:
            deg_line = edu.degree.strip()
            date_str = f"{edu.start.strip()} - {edu.end.strip()}" if edu.start else edu.end.strip()
            if date_str:
                deg_line = f"{deg_line} ({date_str})"
            lines.append(deg_line)

            sub_parts = [edu.institution.strip()]
            if edu.location:
                sub_parts.append(edu.location.strip())
            if edu.score:
                sub_parts.append(f"Score: {edu.score.strip()}")
            lines.append(", ".join(sub_parts))
            lines.append("")

    # 2. Skills
    if resume.skills:
        lines.append("SKILLS")
        for sg in resume.skills:
            items_str = ", ".join(item.strip() for item in sg.items if item.strip())
            lines.append(f"{sg.category.strip()}: {items_str}")
        lines.append("")

    # 3. Experience
    if resume.experience:
        lines.append("EXPERIENCE")
        for exp in resume.experience:
            role_line = f"{exp.role.strip()} - {exp.company.strip()}"
            if exp.location:
                role_line += f", {exp.location.strip()}"
            date_str = f"{exp.start.strip()} - {exp.end.strip()}" if exp.start else exp.end.strip()
            if date_str:
                role_line += f" ({date_str})"
            lines.append(role_line)
            for b in exp.bullets:
                lines.append(f"- {b.strip()}")
            lines.append("")

    # 4. Projects
    if resume.projects:
        lines.append("PROJECTS")
        for proj in resume.projects:
            proj_line = proj.name.strip()
            if proj.tech:
                proj_line += f" [{', '.join(t.strip() for t in proj.tech)}]"
            if proj.url:
                proj_line += f" ({proj.url.strip()})"
            lines.append(proj_line)
            for b in proj.bullets:
                lines.append(f"- {b.strip()}")
            lines.append("")

    # 5. Certifications
    if resume.certifications:
        lines.append("CERTIFICATIONS")
        for cert in resume.certifications:
            lines.append(f"- {cert.strip()}")
        lines.append("")

    return "\n".join(lines).strip()


def build_deterministic_resume_data(profile: dict) -> ResumeData:
    """
    Builds a structured ResumeData instance strictly from user profile fields.
    Provides a valid baseline when LLM generation is unavailable or when resetting edits.
    """
    import re
    name = (profile.get("name") or "Candidate Name").strip()
    email = (profile.get("email") or "candidate@example.com").strip()
    phone = (profile.get("phone") or "").strip() or None
    location = (profile.get("location") or "").strip() or None

    links: List[ResumeLink] = []
    github_url = (profile.get("github_url") or "").strip()
    if github_url:
        links.append(ResumeLink(label="GitHub", url=github_url))
    linkedin_url = (profile.get("linkedin_url") or "").strip()
    if linkedin_url:
        links.append(ResumeLink(label="LinkedIn", url=linkedin_url))
    for l in profile.get("links") or []:
        if isinstance(l, dict) and l.get("url"):
            links.append(ResumeLink(label=l.get("label", "Portfolio"), url=l["url"].strip()))

    basics = ResumeBasics(
        name=name,
        email=email,
        phone=phone,
        location=location,
        links=links,
    )

    # 1. Experience
    raw_exp = profile.get("experience") or []
    experience_items: List[ExperienceItem] = []
    for exp in raw_exp:
        role = (exp.get("role") or exp.get("title") or "Software Engineer").strip()
        company = (exp.get("company") or "Company").strip()
        loc = (exp.get("location") or "").strip() or None

        duration = (exp.get("duration") or "").strip()
        start = (exp.get("start") or "").strip()
        end = (exp.get("end") or "").strip()
        if not start and not end and duration:
            parts = [p.strip() for p in re.split(r'[-–—]', duration) if p.strip()]
            if len(parts) >= 2:
                start, end = parts[0], parts[1]
            elif len(parts) == 1:
                start, end = "", parts[0]
        start = start or "2023"
        end = end or "Present"

        desc = (exp.get("description") or "").strip()
        bullets: List[str] = []
        if desc:
            for line in desc.split("\n"):
                clean = line.strip().lstrip("-*•").strip()
                if clean:
                    bullets.append(clean)
        if not bullets:
            bullets = [f"Engineered high-performance backend features and maintained reliable APIs at {company}."]
        experience_items.append(
            ExperienceItem(
                role=role,
                company=company,
                location=loc,
                start=start,
                end=end,
                bullets=bullets[:4],
            )
        )

    # 2. Projects (max 4)
    raw_proj = profile.get("projects") or []
    project_items: List[ProjectItem] = []
    for p in raw_proj[:4]:
        p_name = (p.get("name") or p.get("title") or "Featured Project").strip()
        tech = p.get("tech_stack") or p.get("tech") or []
        if isinstance(tech, str):
            tech = [t.strip() for t in tech.split(",") if t.strip()]
        p_url = (p.get("repo_url") or p.get("live_url") or p.get("url") or "").strip() or None
        desc = (p.get("description") or "").strip()
        bullets: List[str] = []
        if desc:
            for line in desc.split("\n"):
                clean = line.strip().lstrip("-*•").strip()
                if clean:
                    bullets.append(clean)
        if not bullets:
            bullets = [f"Architected {p_name} demonstrating scalable systems design and clean modular code."]
        project_items.append(
            ProjectItem(
                name=p_name,
                tech=tech,
                url=p_url,
                bullets=bullets[:4],
            )
        )

    # 3. Education
    raw_edu = profile.get("education") or []
    education_items: List[EducationItem] = []
    for edu in raw_edu:
        deg = (edu.get("degree") or "Bachelor of Technology").strip()
        inst = (edu.get("institution") or "University").strip()
        loc = (edu.get("location") or "").strip() or None
        start = (edu.get("start") or "").strip() or None
        end = (edu.get("end") or edu.get("year") or "2024").strip()
        score = (edu.get("score") or "").strip() or None
        education_items.append(
            EducationItem(
                degree=deg,
                institution=inst,
                location=loc,
                start=start,
                end=end,
                score=score,
            )
        )

    # 4. Skills (max 6 groups)
    raw_skills = [s.strip() for s in (profile.get("skills") or []) if s.strip()]
    skill_groups: List[SkillGroup] = []
    if raw_skills:
        skill_groups.append(SkillGroup(category="Technical Skills", items=raw_skills[:25]))
    else:
        skill_groups.append(SkillGroup(category="Technical Skills", items=["Software Engineering"]))

    # 5. Summary: Omit unless no projects and no experience
    summary = None
    if not experience_items and not project_items:
        summary = profile.get("headline") or "Motivated software engineer with a strong foundation in computer science."

    # 6. Certifications
    raw_certs = profile.get("certifications") or []
    certs: List[str] = []
    for c in raw_certs:
        if isinstance(c, str) and c.strip():
            certs.append(c.strip())
        elif isinstance(c, dict) and c.get("name"):
            certs.append(c["name"].strip())

    return ResumeData(
        basics=basics,
        summary=summary,
        skills=skill_groups[:6],
        experience=experience_items,
        projects=project_items[:4],
        education=education_items,
        certifications=certs,
    )

