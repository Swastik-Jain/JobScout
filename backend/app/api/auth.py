"""
Auth routes
  POST  /auth/register   (Canonical prefix: /api/v1/auth/register)
  POST  /auth/login      (Canonical prefix: /api/v1/auth/login)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select, func
from typing import Optional

from app.core.db import get_session
from app.core.security import hash_password, verify_password, create_access_token
from app.models.models import UserProfile
from app.api.deps import profile_to_dict

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


# ── Routes ────────────────────────────────────────────────────────────────────
@router.post("/auth/register")
def register(req: RegisterRequest, session: Session = Depends(get_session)):
    clean_email = req.email.strip().lower()
    existing = session.exec(
        select(UserProfile).where(func.lower(UserProfile.email) == clean_email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")

    cleaned_name = " ".join(p.capitalize() for p in req.name.strip().split()) if req.name else req.name
    clean_pwd = req.password.strip()
    user = UserProfile(
        name=cleaned_name,
        email=clean_email,
        phone=req.phone.strip() if req.phone else None,
        hashed_password=hash_password(clean_pwd),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token({"sub": user.email})
    return {"token": token, "profile": profile_to_dict(user)}


@router.post("/auth/login")
def login(req: LoginRequest, session: Session = Depends(get_session)):
    clean_email = req.email.strip().lower()
    user = session.exec(
        select(UserProfile).where(func.lower(UserProfile.email) == clean_email)
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    # Match exact password or trimmed password to prevent trailing whitespace issues
    pwd = req.password
    pwd_valid = verify_password(pwd, user.hashed_password)
    if not pwd_valid and pwd.strip() != pwd:
        pwd_valid = verify_password(pwd.strip(), user.hashed_password)

    if not pwd_valid:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token({"sub": user.email})
    return {"token": token, "profile": profile_to_dict(user)}
