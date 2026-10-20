from typing import Optional, List, Dict
from sqlmodel import SQLModel, Field, Column, JSON
from datetime import datetime

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

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


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
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ApplicationHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    job_id: int = Field(foreign_key="jobmatch.id")
    status: str = "Pending"  # Pending, Applied, Rejected, Interview
    resume_md: str
    ats_score: float
    platform: str
    applied_at: datetime = Field(default_factory=datetime.utcnow)
