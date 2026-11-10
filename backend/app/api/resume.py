"""
Resume & Apply routes
  POST  /generate-resume
  POST  /apply
  GET   /applications
  WS    /logs
"""
from typing import Optional
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from pydantic import BaseModel
from sqlmodel import Session, select

import logging
from app.core.db import get_session
from app.models.models import UserProfile, Job, JobMatch
from app.api.deps import get_current_user, profile_to_dict
from app.agents.orchestrator import orchestrator
from app.services.resume_parser import (
    extract_text,
    parse_resume_text,
    compute_confidence_and_attention,
    store_uploaded_resume,
    get_empty_parsed_data,
    MAX_FILE_SIZE,
    ALLOWED_EXTENSIONS,
)

logger = logging.getLogger("jobscout.resume")
router = APIRouter()


@router.post("/resume/parse")
async def parse_resume_endpoint(
    file: UploadFile = File(...),
    current_user: UserProfile = Depends(get_current_user),
):
    """
    Accepts a PDF or DOCX resume, validates size and type, extracts text,
    parses structured profile data with per-field confidence, and stores
    the original file without modifying the user's database profile.
    """
    filename = file.filename or "resume.pdf"
    ext = Path(filename).suffix.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Please upload a .pdf or .docx file.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds 5MB size limit ({len(file_bytes) / 1024 / 1024:.1f}MB).",
        )

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # 1. Store the original file as the source of truth
    file_meta = store_uploaded_resume(file_bytes, filename, current_user.id or 0)

    # 2. Extract text from file
    try:
        raw_text = extract_text(file_bytes, filename)
    except Exception as e:
        logger.warning(f"[ResumeAPI] Extraction error for {filename}: {e}")
        return {
            "success": False,
            "error": "The document could not be read or is corrupted. Please fill in your profile manually.",
            "parsed_data": get_empty_parsed_data(),
            "confidence": {"name": 0.0, "contact": 0.0, "skills": 0.0, "education": 0.0, "experience": 0.0, "projects": 0.0},
            "attention_fields": ["name", "email", "skills", "education", "target_role", "preferred_location"],
            "file_meta": file_meta,
        }

    # 3. Handle scanned PDF / image-only / unreadable text
    if len(raw_text.strip()) < 50:
        return {
            "success": False,
            "error": "This file appears to be an image scan or unreadable layout. We've set up the form below for quick manual entry.",
            "parsed_data": get_empty_parsed_data(),
            "confidence": {"name": 0.0, "contact": 0.0, "skills": 0.0, "education": 0.0, "experience": 0.0, "projects": 0.0},
            "attention_fields": ["name", "email", "skills", "education", "target_role", "preferred_location"],
            "file_meta": file_meta,
        }

    # 4. Parse with LLM / heuristic
    try:
        parsed_data = parse_resume_text(raw_text)
        confidence, attention_fields = compute_confidence_and_attention(parsed_data, raw_text)
        return {
            "success": True,
            "error": None,
            "parsed_data": parsed_data,
            "confidence": confidence,
            "attention_fields": attention_fields,
            "file_meta": file_meta,
        }
    except Exception as e:
        logger.error(f"[ResumeAPI] Parsing exception for {filename}: {e}")
        return {
            "success": False,
            "error": f"LLM parsing was interrupted: {str(e)}. You can review or manually complete your profile below.",
            "parsed_data": get_empty_parsed_data(),
            "confidence": {"name": 0.0, "contact": 0.0, "skills": 0.0, "education": 0.0, "experience": 0.0, "projects": 0.0},
            "attention_fields": ["name", "email", "skills", "education", "target_role", "preferred_location"],
            "file_meta": file_meta,
        }


# ── Schemas ───────────────────────────────────────────────────────────────────
class ResumeRequest(BaseModel):
    job_id: int
    critic_comment: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────
@router.post("/generate-resume")
async def generate_resume(
    req: ResumeRequest = None,
    job_id: int = 1,
    critic_comment: Optional[str] = None,
    current_user: UserProfile = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # Support both JSON body and query params
    if req:
        job_id = req.job_id
        critic_comment = req.critic_comment

    job = session.get(Job, job_id) or session.get(JobMatch, job_id)

    job_target = (
        job.dict()
        if job
        else {
            "id": job_id,
            "title": "Target Role",
            "company": "Target Company",
            "description": "Target job description.",
        }
    )

    initial_state = {
        "thread_id": f"user_{current_user.id}_job_{job_id}",
        "user_profile": profile_to_dict(current_user),
        "selected_job": job_target,
        "repo_links": [r.get("url") for r in (current_user.github_repos or []) if r.get("url")],
        "enriched_repos": current_user.github_repos or [],
        "target_role": current_user.target_role or "Software Engineer",
        "preferred_location": current_user.preferred_location or "India, Remote",
        "jobs": [job_target],
        "resume_md": "",
        "ats_score": 0.0,
        "ats_details": {},
        "improvements": [],
        "critic_feedback": critic_comment or "",
        "iteration": 0,
        "status": "start",
        "logs": [],
    }
    result = await orchestrator.ainvoke(initial_state)
    return {
        "resume_md": result["resume_md"],
        "ats_score": result["ats_score"],
        "logs": result["logs"],
        "improvements": result.get("improvements", []),
    }



@router.websocket("/logs")
async def websocket_logs(websocket: WebSocket):
    from app.utils.log_generator import generate_agent_logs
    await websocket.accept()
    try:
        async for msg in generate_agent_logs():
            await websocket.send_json({"log": msg})
    except WebSocketDisconnect:
        logger.info("Client disconnected from /logs websocket")
