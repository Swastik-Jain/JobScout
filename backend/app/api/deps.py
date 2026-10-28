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


def profile_to_dict(user: UserProfile) -> dict:
    """Serialize a UserProfile ORM object to a plain dict for API responses."""
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "headline": user.headline,
        "github_url": user.github_url,
        "linkedin_url": user.linkedin_url,
        "preferred_location": user.preferred_location,
        "seniority_level": user.seniority_level,
        "skills": user.skills,
        "experience": user.experience,
        "projects": user.projects,
        "education": user.education,
        "github_repos": user.github_repos,
        "created_at": str(user.created_at),
        "updated_at": str(user.updated_at),
    }
