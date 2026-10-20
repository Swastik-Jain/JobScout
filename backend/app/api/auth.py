"""
Auth routes
  POST  /auth/register   (+ /api/auth/register  /register  aliases)
  POST  /auth/login      (+ /api/auth/login     /login     aliases)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
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
    existing = session.exec(
        select(UserProfile).where(UserProfile.email == req.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")

    user = UserProfile(
        name=req.name,
        email=req.email,
        phone=req.phone,
        hashed_password=hash_password(req.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token({"sub": user.email})
    return {"token": token, "profile": profile_to_dict(user)}


@router.post("/api/auth/register")
def register_api_alias(req: RegisterRequest, session: Session = Depends(get_session)):
    return register(req, session)


@router.post("/register")
def register_root_alias(req: RegisterRequest, session: Session = Depends(get_session)):
    return register(req, session)


@router.post("/auth/login")
def login(req: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(
        select(UserProfile).where(UserProfile.email == req.email)
    ).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token({"sub": user.email})
    return {"token": token, "profile": profile_to_dict(user)}


@router.post("/api/auth/login")
def login_api_alias(req: LoginRequest, session: Session = Depends(get_session)):
    return login(req, session)


@router.post("/login")
def login_root_alias(req: LoginRequest, session: Session = Depends(get_session)):
    return login(req, session)
