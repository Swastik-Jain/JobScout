"""
Shared FastAPI dependencies and small helpers used across routers.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select

from app.core.db import get_session
from app.core.security import decode_token
from app.models.models import UserProfile

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    session: Session = Depends(get_session),
) -> UserProfile:
    """
    Validates the Bearer JWT token from the Authorization header and returns the authenticated user.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email = decode_token(credentials.credentials)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = session.exec(select(UserProfile).where(UserProfile.email == email)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account no longer exists.",
        )

    return user


def check_profile_complete(user: UserProfile) -> bool:
    """
    Computes whether a candidate profile is complete.
    Required fields:
      - target_role (non-empty string)
      - preferred_location (non-empty string)
      - skills (at least 1 non-empty skill)
      - education (at least 1 entry with graduation year)
    Optional fields:
      - experience (freshers without experience can complete profile)
      - projects, github_repos, phone, headline
    """
    has_target_role = bool(user.target_role and user.target_role.strip())
    has_location = bool(user.preferred_location and user.preferred_location.strip())
    has_skills = bool(user.skills and any(isinstance(s, str) and s.strip() for s in user.skills))

    has_edu = False
    if user.education and isinstance(user.education, list):
        for edu in user.education:
            if isinstance(edu, dict):
                inst = edu.get("institution") or ""
                deg = edu.get("degree") or ""
                year = edu.get("year") or edu.get("graduation_year") or edu.get("grad_year") or ""
                if (inst.strip() or deg.strip()) and str(year).strip():
                    has_edu = True
                    break

    return bool(has_target_role and has_location and has_skills and has_edu)


def profile_to_dict(user: UserProfile) -> dict:
    """Serialize a UserProfile ORM object to a plain dict for API responses."""
    formatted_name = " ".join(p.capitalize() for p in user.name.strip().split()) if user.name else user.name
    return {
        "id": user.id,
        "name": formatted_name,
        "email": user.email,
        "phone": user.phone,
        "headline": user.headline,
        "github_url": user.github_url,
        "linkedin_url": user.linkedin_url,
        "target_role": user.target_role or "Software Engineer",
        "preferred_location": user.preferred_location or "India, Remote",
        "seniority_level": user.seniority_level or "Entry-Level / Fresher",
        "skills": user.skills or [],
        "experience": user.experience or [],
        "projects": user.projects or [],
        "education": user.education or [],
        "github_repos": user.github_repos or [],
        "profile_complete": check_profile_complete(user),
        "created_at": str(user.created_at),
        "updated_at": str(user.updated_at),
    }
