"""
Shared FastAPI dependencies and small helpers used across routers.
"""
from app.models.models import UserProfile


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
        "skills": user.skills,
        "experience": user.experience,
        "projects": user.projects,
        "education": user.education,
        "github_repos": user.github_repos,
        "created_at": str(user.created_at),
        "updated_at": str(user.updated_at),
    }
