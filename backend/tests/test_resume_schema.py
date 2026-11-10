"""
Unit tests for Structured Resume Schema, Plain-Text Renderer, Validator, Banned Phrases, and PUT API.
"""
import pytest
from pydantic import ValidationError
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.schemas.resume_schema import (
    ResumeLink,
    ResumeBasics,
    SkillGroup,
    ExperienceItem,
    ProjectItem,
    EducationItem,
    ResumeData,
    render_plain_text,
)
from app.agents.resume_agent import find_banned_phrases
from app.services.resume_validator import validate_resume_data, validate_no_fabrication
from app.models.models import UserProfile, Job, Application, ResumeVersion


def test_schema_rejects_5_bullets():
    """Schema rejects more than 4 bullets on experience and project items."""
    with pytest.raises(ValidationError):
        ExperienceItem(
            role="Software Engineer",
            company="Acme Corp",
            start="2022",
            end="Present",
            bullets=["Bullet 1", "Bullet 2", "Bullet 3", "Bullet 4", "Bullet 5"],
        )

    with pytest.raises(ValidationError):
        ProjectItem(
            name="Job Bot",
            tech=["Python", "FastAPI"],
            bullets=["Bullet 1", "Bullet 2", "Bullet 3", "Bullet 4", "Bullet 5"],
        )

    # 4 bullets is valid
    exp = ExperienceItem(
        role="Software Engineer",
        company="Acme Corp",
        start="2022",
        end="Present",
        bullets=["Bullet 1", "Bullet 2", "Bullet 3", "Bullet 4"],
    )
    assert len(exp.bullets) == 4


def test_render_plain_text_sections_in_order():
    """render_plain_text output contains each section heading in order (Education, Skills, Experience, Projects, Certifications)."""
    resume = ResumeData(
        basics=ResumeBasics(
            name="Alice Smith",
            email="alice@example.com",
            phone="123-456-7890",
            location="San Francisco, CA",
            links=[ResumeLink(label="GitHub", url="https://github.com/alice")],
        ),
        education=[
            EducationItem(
                degree="B.S. in Computer Science",
                institution="Stanford University",
                start="2018",
                end="2022",
            )
        ],
        skills=[
            SkillGroup(category="Languages", items=["Python", "TypeScript"]),
            SkillGroup(category="Frameworks", items=["FastAPI", "React"]),
        ],
        experience=[
            ExperienceItem(
                role="Backend Engineer",
                company="TechCorp",
                start="2022",
                end="Present",
                bullets=["Engineered microservices in Python."],
            )
        ],
        projects=[
            ProjectItem(
                name="AI Scheduler",
                tech=["Python", "FastAPI"],
                bullets=["Built scheduling optimizer."],
            )
        ],
        certifications=["AWS Certified Solutions Architect"],
    )

    rendered = render_plain_text(resume)
    edu_pos = rendered.find("EDUCATION")
    skills_pos = rendered.find("SKILLS")
    exp_pos = rendered.find("EXPERIENCE")
    proj_pos = rendered.find("PROJECTS")
    cert_pos = rendered.find("CERTIFICATIONS")

    assert edu_pos != -1
    assert skills_pos != -1
    assert exp_pos != -1
    assert proj_pos != -1
    assert cert_pos != -1

    assert edu_pos < skills_pos < exp_pos < proj_pos < cert_pos


def test_validator_rejects_unknown_company_and_accepts_matching():
    """Validator rejects an unknown company and accepts a matching one."""
    profile = {
        "name": "Bob Stone",
        "email": "bob@example.com",
        "skills": ["Python", "FastAPI"],
        "experience": [
            {"company": "Google", "role": "Software Engineer", "duration": "2020-2023"}
        ],
        "education": [
            {"institution": "MIT", "degree": "B.S. CS", "year": "2020"}
        ],
        "projects": [],
    }

    # Matching company
    valid_resume = ResumeData(
        basics=ResumeBasics(name="Bob Stone", email="bob@example.com"),
        skills=[SkillGroup(category="Languages", items=["Python"])],
        experience=[
            ExperienceItem(
                role="Software Engineer",
                company="Google",
                start="2020",
                end="2023",
                bullets=["Built distributed backend systems."],
            )
        ],
        education=[
            EducationItem(degree="B.S. CS", institution="MIT", end="2020")
        ],
    )
    is_valid, errors = validate_resume_data(valid_resume, profile)
    assert is_valid is True
    assert errors == []

    # Unknown company
    invalid_resume = ResumeData(
        basics=ResumeBasics(name="Bob Stone", email="bob@example.com"),
        skills=[SkillGroup(category="Languages", items=["Python"])],
        experience=[
            ExperienceItem(
                role="Software Engineer",
                company="Fabricated Corp",
                start="2020",
                end="2023",
                bullets=["Built non-existent backend systems."],
            )
        ],
        education=[
            EducationItem(degree="B.S. CS", institution="MIT", end="2020")
        ],
    )
    is_valid_inv, errors_inv = validate_resume_data(invalid_resume, profile)
    assert is_valid_inv is False
    assert any("Fabricated Corp" in err for err in errors_inv)


def test_find_banned_phrases_detects_robust():
    """find_banned_phrases detects 'robust' in bullets."""
    resume = ResumeData(
        basics=ResumeBasics(name="Carol White", email="carol@example.com"),
        skills=[SkillGroup(category="Languages", items=["Python"])],
        experience=[
            ExperienceItem(
                role="Software Engineer",
                company="Acme",
                start="2021",
                end="2023",
                bullets=["Engineered a robust distributed pipeline handling 10k RPS."],
            )
        ],
        education=[
            EducationItem(degree="B.S. CS", institution="Caltech", end="2021")
        ],
    )

    hits = find_banned_phrases(resume)
    assert len(hits) >= 1
    assert any("robust" in h.lower() for h in hits)


def test_put_application_resume_version_and_ownership(
    client: TestClient,
    session: Session,
    user_a: UserProfile,
    token_a: str,
    user_b: UserProfile,
    token_b: str,
    sample_job: Job,
):
    """PUT /applications/{id}/resume creates version n+1 for the owner and returns 404 for another user."""
    # Create application for user A
    app = Application(
        user_id=user_a.id,
        job_id=sample_job.id,
        status="saved",
        prep_status="ready",
    )
    session.add(app)
    session.commit()
    session.refresh(app)

    # Add initial ResumeVersion (version 1)
    v1 = ResumeVersion(
        application_id=app.id,
        version_number=1,
        resume_md="Initial Resume",
        cover_note="Initial Cover Note",
        ats_score=75.0,
        improvements=["Improve bullet metrics."],
    )
    session.add(v1)
    session.commit()

    resume_payload = {
        "basics": {
            "name": "Alice Engineer",
            "email": "alice@example.com",
            "phone": "555-0100",
            "location": "Remote",
            "links": [{"label": "GitHub", "url": "https://github.com/alice"}],
        },
        "summary": None,
        "skills": [
            {"category": "Backend", "items": ["Python", "FastAPI", "PostgreSQL"]}
        ],
        "experience": [
            {
                "role": "Full Stack Engineer",
                "company": "Acme",
                "start": "2022",
                "end": "Present",
                "bullets": ["Architected async event bus reducing latency by 40%."],
            }
        ],
        "projects": [],
        "education": [
            {
                "degree": "B.S. Computer Science",
                "institution": "University",
                "end": "2022",
            }
        ],
        "certifications": [],
    }

    # 1. Owner (User A) updates resume
    headers_a = {"Authorization": f"Bearer {token_a}"}
    resp_a = client.put(
        f"/applications/{app.id}/resume",
        json=resume_payload,
        headers=headers_a,
    )
    assert resp_a.status_code == 200
    data = resp_a.json()
    assert data["version_number"] == 2
    assert data["resume"] is not None
    assert data["resume"]["basics"]["name"] == "Alice Engineer"
    assert data["cover_note"] == "Initial Cover Note"
    assert data["ats_score"] == 75.0
    assert "EDUCATION" in data["resume_md"]

    # 2. Non-owner (User B) attempts to update resume -> 404
    headers_b = {"Authorization": f"Bearer {token_b}"}
    resp_b = client.put(
        f"/applications/{app.id}/resume",
        json=resume_payload,
        headers=headers_b,
    )
    assert resp_b.status_code == 404
