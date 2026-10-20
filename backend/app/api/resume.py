"""
Resume & Apply routes
  POST  /generate-resume
  POST  /apply
  GET   /applications
  WS    /logs
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.db import get_session
from app.models.models import UserProfile, JobMatch, ApplicationHistory
from app.agents.orchestrator import orchestrator

router = APIRouter()


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
    session: Session = Depends(get_session),
):
    # Support both JSON body and query params
    if req:
        job_id = req.job_id
        critic_comment = req.critic_comment

    job = session.get(JobMatch, job_id)
    user = session.exec(select(UserProfile)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")

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
        "user_profile": user.dict(),
        "selected_job": job_target,
        "jobs": [],
        "resume_md": "",
        "ats_score": 0.0,
        "critic_feedback": critic_comment or "",
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


@router.post("/apply")
async def apply_job(job_id: int, session: Session = Depends(get_session)):
    job = session.get(JobMatch, job_id)
    user = session.exec(select(UserProfile)).first()
    if not job or not user:
        raise HTTPException(status_code=404, detail="Job or User not found")

    resume_md = f"# Resume for {user.name}\nApplied for {job.title}"
    history = ApplicationHistory(
        job_id=job.id,
        status="Applied",
        resume_md=resume_md,
        ats_score=90.0,
        platform=job.platform,
    )
    session.add(history)
    session.commit()
    return {"message": "Application submitted", "status": "success"}


@router.get("/applications")
def list_applications(session: Session = Depends(get_session)):
    """Return application history with enriched job title/company."""
    apps = session.exec(
        select(ApplicationHistory).order_by(ApplicationHistory.applied_at.desc())
    ).all()
    result = []
    for app in apps:
        job = session.get(JobMatch, app.job_id)
        result.append(
            {
                "id": app.id,
                "job_id": app.job_id,
                "job_title": job.title if job else "Unknown",
                "company": job.company if job else "Unknown",
                "platform": app.platform,
                "status": app.status,
                "ats_score": app.ats_score,
                "applied_at": str(app.applied_at),
            }
        )
    return result


@router.websocket("/logs")
async def websocket_logs(websocket: WebSocket):
    from app.utils.log_generator import generate_agent_logs
    await websocket.accept()
    try:
        async for msg in generate_agent_logs():
            await websocket.send_json({"log": msg})
    except WebSocketDisconnect:
        print("Client disconnected")
