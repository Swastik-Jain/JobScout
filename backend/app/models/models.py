from datetime import datetime, timezone
from typing import Optional, List, Dict
from sqlmodel import SQLModel, Field, Column, JSON
from sqlalchemy import UniqueConstraint


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class UserProfile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique=True, index=True)
    phone: Optional[str] = None
    headline: Optional[str] = None          # e.g. "Full-Stack Engineer · Python · React"
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    hashed_password: str = Field(default="")

    # JSON fields
    skills: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    experience: List[Dict] = Field(default_factory=list, sa_column=Column(JSON))
    projects: List[Dict] = Field(default_factory=list, sa_column=Column(JSON))
    education: List[Dict] = Field(default_factory=list, sa_column=Column(JSON))
    github_repos: List[Dict] = Field(default_factory=list, sa_column=Column(JSON))
    # github_repos schema: [{url, name, description, tech, stars, complexity_score, agent_comment, verified}]

    # Profile preferences for job matching
    preferred_location: Optional[str] = Field(default="India, Remote")
    seniority_level: Optional[str] = Field(default="Entry-Level / Fresher")

    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class CompanySource(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    ats: str = Field(index=True)                  # "greenhouse", "lever", "ashby"
    slug: str = Field(index=True)                 # e.g. "canonical"
    name: str                                     # e.g. "Canonical"
    is_active: bool = Field(default=True, index=True)
    last_ok_at: Optional[datetime] = None
    fail_count: int = Field(default=0)
    last_error: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)


class Job(SQLModel, table=True):
    """Global ATS job catalog — never deleted, only marked inactive when closed."""
    id: Optional[int] = Field(default=None, primary_key=True)
    ats: str = Field(index=True)                  # "greenhouse", "lever", "ashby"
    external_id: str = Field(index=True)          # Unique job ID from ATS (e.g. "2413329")
    company: str = Field(index=True)
    title: str = Field(index=True)
    location: str = Field(default="")
    url: str
    description: Optional[str] = None
    is_active: bool = Field(default=True, index=True)
    first_seen_at: datetime = Field(default_factory=utc_now)
    last_seen_at: datetime = Field(default_factory=utc_now)


# IngestedJob alias for backwards compatibility
IngestedJob = Job


class JobScore(SQLModel, table=True):
    """Per-user match score for a job."""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="userprofile.id", index=True)
    job_id: int = Field(foreign_key="job.id", index=True)
    match_score: float
    justification: Optional[str] = None
    key_requirements: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utc_now)


class Application(SQLModel, table=True):
    """Human-in-the-loop application tracking record."""
    __table_args__ = (UniqueConstraint("user_id", "job_id", name="uq_user_job"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="userprofile.id", index=True)
    job_id: int = Field(foreign_key="job.id", index=True)
    resume_version_id: Optional[int] = Field(default=None, foreign_key="resumeversion.id")
    # Valid states: saved, prepared, applied, interviewing, accepted, declined, rejected, ghosted, withdrawn
    status: str = Field(default="saved", index=True)
    prep_status: str = Field(default="idle", index=True)  # idle, preparing, ready, failed
    prep_error: Optional[str] = None
    notes: Optional[str] = None
    applied_at: Optional[datetime] = None
    last_contact_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ResumeVersion(SQLModel, table=True):
    """Immutable versioned application materials generated for an application."""
    id: Optional[int] = Field(default=None, primary_key=True)
    application_id: int = Field(foreign_key="application.id", index=True)
    version_number: int = Field(default=1)
    resume_md: str
    cover_note: Optional[str] = None
    qa_drafts: List[Dict] = Field(default_factory=list, sa_column=Column(JSON))
    ats_score: float = Field(default=0.0)
    ats_details: Dict = Field(default_factory=dict, sa_column=Column(JSON))
    improvements: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utc_now)


class ApplicationTimeline(SQLModel, table=True):
    """Audit log of application status transitions."""
    id: Optional[int] = Field(default=None, primary_key=True)
    application_id: int = Field(foreign_key="application.id", index=True)
    from_status: Optional[str] = None
    to_status: str
    note: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)


# Legacy models kept for backwards-compatibility during migration
class JobMatch(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    company: str
    description: Optional[str] = None
    platform: str
    url: Optional[str] = None
    location: Optional[str] = None
    salary_range: Optional[str] = None
    match_score: float
    justification: Optional[str] = None
    key_requirements: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utc_now)


class ApplicationHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    job_id: int = Field(foreign_key="jobmatch.id")
    status: str = "Pending"
    resume_md: str
    ats_score: float
    platform: str
    applied_at: datetime = Field(default_factory=utc_now)
