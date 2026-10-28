"""
Applications API Routes
━━━━━━━━━━━━━━━━━━━━━━━
State-Machine Driven Human-in-the-Loop Application Lifecycle:
  POST   /applications                    — Bookmark/save job
  GET    /applications                    — List current user's applications
  GET    /applications/{id}               — Get application with latest materials & history
  POST   /applications/{id}/transition    — State transition (atomic with timeline)
  PATCH  /applications/{id}               — Edit custom notes
  POST   /applications/{id}/prepare       — Asynchronous background material preparation
  GET    /applications/{id}/prepare/status— Check preparation status
  GET    /applications/{id}/export        — Download tailored materials as DOCX or Markdown
"""
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Response
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.db import get_session
from app.api.deps import get_current_user
from app.models.models import (
    UserProfile,
    Job,
    Application,
    ResumeVersion,
    ApplicationTimeline,
)
from app.services.application_service import (
    transition_application,
    save_job_for_user,
    run_application_prep_task,
    export_resume_to_docx,
    VALID_TRANSITIONS,
)
from app.services.resume_validator import render_deterministic_base_resume

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────
class SaveJobRequest(BaseModel):
    job_id: int
    notes: Optional[str] = None


class TransitionRequest(BaseModel):
    to_status: str
    note: Optional[str] = None
    applied_at: Optional[datetime] = None
    last_contact_at: Optional[datetime] = None


class UpdateApplicationRequest(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    applied_at: Optional[datetime] = None
    last_contact_at: Optional[datetime] = None
    resume_md: Optional[str] = None
    cover_note: Optional[str] = None


# Alias for backwards compatibility
UpdateNotesRequest = UpdateApplicationRequest


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/applications")
def save_application(
    req: SaveJobRequest,
    current_user: UserProfile = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Bookmark/save a job. Idempotent: returns existing application if already saved."""
    app = save_job_for_user(
        job_id=req.job_id,
        user_id=current_user.id,
        session=session,
        notes=req.notes,
    )
    return {
        "id": app.id,
        "job_id": app.job_id,
        "status": app.status,
        "prep_status": app.prep_status,
        "notes": app.notes,
        "created_at": str(app.created_at),
    }


@router.get("/applications")
def list_my_applications(
    current_user: UserProfile = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Lists all applications for the authenticated user with joined job and latest material details."""
    apps = session.exec(
        select(Application)
        .where(Application.user_id == current_user.id)
        .order_by(Application.updated_at.desc())
    ).all()

    result = []
    for app in apps:
        job = session.get(Job, app.job_id)
        # Find latest resume version
        latest_version = session.exec(
            select(ResumeVersion)
            .where(ResumeVersion.application_id == app.id)
            .order_by(ResumeVersion.version_number.desc())
        ).first()

        result.append({
            "id": app.id,
            "job_id": app.job_id,
            "job_title": job.title if job else "Unknown Role",
            "company": job.company if job else "Unknown Company",
            "location": job.location if job else "",
            "job_url": job.url if job else "",
            "is_active_on_ats": job.is_active if job else True,
            "status": app.status,
            "prep_status": app.prep_status,
            "prep_error": app.prep_error,
            "notes": app.notes,
            "applied_at": str(app.applied_at) if app.applied_at else None,
            "last_contact_at": str(app.last_contact_at) if app.last_contact_at else None,
            "created_at": str(app.created_at),
            "updated_at": str(app.updated_at),
            "ats_score": latest_version.ats_score if latest_version else None,
            "has_materials": latest_version is not None,
        })
    return result


@router.get("/applications/{id}")
def get_application_details(
    id: int,
    current_user: UserProfile = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Returns application details, timeline history, and latest generated materials."""
    app = session.get(Application, id)
    if not app or app.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Application not found.")

    job = session.get(Job, app.job_id)
    latest_version = session.exec(
        select(ResumeVersion)
        .where(ResumeVersion.application_id == app.id)
        .order_by(ResumeVersion.version_number.desc())
    ).first()

    timeline = session.exec(
        select(ApplicationTimeline)
        .where(ApplicationTimeline.application_id == app.id)
        .order_by(ApplicationTimeline.created_at.asc())
    ).all()

    base_resume = render_deterministic_base_resume(current_user.dict())

    return {
        "id": app.id,
        "job_id": app.job_id,
        "job": {
            "title": job.title if job else "",
            "company": job.company if job else "",
            "location": job.location if job else "",
            "url": job.url if job else "",
            "description": job.description if job else "",
            "is_active": job.is_active if job else True,
        },
        "status": app.status,
        "prep_status": app.prep_status,
        "prep_error": app.prep_error,
        "notes": app.notes,
        "applied_at": str(app.applied_at) if app.applied_at else None,
        "last_contact_at": str(app.last_contact_at) if app.last_contact_at else None,
        "allowed_next_states": sorted(list(VALID_TRANSITIONS.get(app.status, set()))),
        "base_resume_md": base_resume,
        "materials": {
            "version_number": latest_version.version_number if latest_version else 0,
            "resume_md": latest_version.resume_md if latest_version else base_resume,
            "cover_note": latest_version.cover_note if latest_version else "",
            "qa_drafts": latest_version.qa_drafts if latest_version else [],
            "ats_score": latest_version.ats_score if latest_version else 0,
            "ats_details": latest_version.ats_details if latest_version else {},
            "improvements": latest_version.improvements if latest_version else [],
        } if latest_version else None,
        "timeline": [
            {
                "from_status": t.from_status,
                "to_status": t.to_status,
                "note": t.note,
                "timestamp": str(t.created_at),
            }
            for t in timeline
        ],
    }


@router.post("/applications/{id}/transition")
def update_status(
    id: int,
    req: TransitionRequest,
    current_user: UserProfile = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Executes state machine transition with validation in an atomic transaction."""
    app = transition_application(
        application_id=id,
        to_status=req.to_status,
        user_id=current_user.id,
        session=session,
        note=req.note,
        applied_at=req.applied_at,
        last_contact_at=req.last_contact_at,
    )
    return {
        "id": app.id,
        "status": app.status,
        "applied_at": str(app.applied_at) if app.applied_at else None,
        "last_contact_at": str(app.last_contact_at) if app.last_contact_at else None,
        "updated_at": str(app.updated_at),
    }


@router.patch("/applications/{id}")
def update_application(
    id: int,
    req: UpdateApplicationRequest,
    current_user: UserProfile = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Updates candidate status, notes, dates, or custom resume/cover edits on an application."""
    app = session.get(Application, id)
    if not app or app.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Application not found.")

    # Status change goes through state-transition validator
    if req.status and req.status != app.status:
        app = transition_application(
            application_id=id,
            to_status=req.status,
            user_id=current_user.id,
            session=session,
            note=f"Status updated via edit to '{req.status}'",
            applied_at=req.applied_at,
            last_contact_at=req.last_contact_at,
        )

    if req.notes is not None:
        app.notes = req.notes

    if req.applied_at is not None:
        app.applied_at = req.applied_at

    if req.last_contact_at is not None:
        app.last_contact_at = req.last_contact_at

    # If user provided edited resume markdown or cover note
    if req.resume_md is not None or req.cover_note is not None:
        latest = session.exec(
            select(ResumeVersion)
            .where(ResumeVersion.application_id == app.id)
            .order_by(ResumeVersion.version_number.desc())
        ).first()

        new_version = ResumeVersion(
            application_id=app.id,
            version_number=(latest.version_number + 1) if latest else 1,
            resume_md=req.resume_md if req.resume_md is not None else (latest.resume_md if latest else ""),
            cover_note=req.cover_note if req.cover_note is not None else (latest.cover_note if latest else ""),
            qa_drafts=latest.qa_drafts if latest else [],
            ats_score=latest.ats_score if latest else 0.0,
            ats_details=latest.ats_details if latest else {},
            improvements=latest.improvements if latest else [],
        )
        session.add(new_version)
        session.flush()
        app.resume_version_id = new_version.id

    app.updated_at = datetime.now(timezone.utc)
    session.add(app)
    session.commit()
    session.refresh(app)

    return {
        "id": app.id,
        "status": app.status,
        "notes": app.notes,
        "applied_at": str(app.applied_at) if app.applied_at else None,
        "last_contact_at": str(app.last_contact_at) if app.last_contact_at else None,
        "updated_at": str(app.updated_at),
    }


@router.post("/applications/{id}/prepare")
def trigger_preparation(
    id: int,
    background_tasks: BackgroundTasks,
    force: bool = False,
    current_user: UserProfile = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    Spawns background task to generate tailored materials without blocking HTTP thread.
    Idempotent: if already preparing, returns 200 without duplicate work.
    """
    app = session.get(Application, id)
    if not app or app.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Application not found.")

    if app.prep_status == "preparing":
        return {"status": "preparing", "message": "Preparation already in progress."}

    if app.prep_status == "ready" and not force:
        return {"status": "ready", "message": "Materials already prepared. Pass ?force=true to regenerate."}

    app.prep_status = "preparing"
    app.prep_error = None
    session.add(app)
    session.commit()

    background_tasks.add_task(run_application_prep_task, app.id, current_user.id)
    return {"status": "preparing", "message": "Tailoring materials in background."}


@router.get("/applications/{id}/prepare/status")
def get_preparation_status(
    id: int,
    current_user: UserProfile = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Poll endpoint to check background preparation status."""
    app = session.get(Application, id)
    if not app or app.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Application not found.")

    latest_version = session.exec(
        select(ResumeVersion)
        .where(ResumeVersion.application_id == app.id)
        .order_by(ResumeVersion.version_number.desc())
    ).first()

    return {
        "id": app.id,
        "prep_status": app.prep_status,
        "prep_error": app.prep_error,
        "ats_score": latest_version.ats_score if latest_version else None,
        "has_materials": latest_version is not None,
    }


@router.get("/applications/{id}/export")
def export_application_material(
    id: int,
    format: str = "markdown",  # markdown | docx | text
    current_user: UserProfile = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Exports tailored resume as DOCX or Markdown."""
    app = session.get(Application, id)
    if not app or app.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Application not found.")

    job = session.get(Job, app.job_id)
    latest_version = session.exec(
        select(ResumeVersion)
        .where(ResumeVersion.application_id == app.id)
        .order_by(ResumeVersion.version_number.desc())
    ).first()

    resume_text = latest_version.resume_md if latest_version else render_deterministic_base_resume(current_user.dict())
    comp_clean = "".join(c for c in (job.company if job else "Application") if c.isalnum() or c in (' ', '_', '-')).strip()
    filename_base = f"{current_user.name.replace(' ', '_')}_{comp_clean}_Resume"

    if format.lower() == "docx":
        docx_buf = export_resume_to_docx(resume_text, title=f"{current_user.name} - Resume")
        return Response(
            content=docx_buf.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename_base}.docx"'},
        )
    else:
        return Response(
            content=resume_text,
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename_base}.md"'},
        )
