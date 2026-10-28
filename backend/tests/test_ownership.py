import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select
from app.models.models import UserProfile, Job, Application, ApplicationTimeline


def test_cannot_edit_other_user_profile(
    client: TestClient,
    user_a: UserProfile,
    token_a: str,
    user_b: UserProfile,
):
    """User A cannot modify User B's profile; returns 403 Forbidden."""
    headers = {"Authorization": f"Bearer {token_a}"}
    payload = {
        "name": "Hacked Name",
        "target_role": "Malicious Role",
    }
    response = client.put(f"/api/v1/profile/{user_b.id}", json=payload, headers=headers)
    assert response.status_code == 403
    assert "permission" in response.json()["detail"].lower()


def test_can_edit_own_profile(
    client: TestClient,
    user_a: UserProfile,
    token_a: str,
):
    """User A can update their own profile; returns 200."""
    headers = {"Authorization": f"Bearer {token_a}"}
    payload = {
        "name": "Alice Super Engineer",
        "target_role": "Lead Architect",
    }
    response = client.put(f"/api/v1/profile/{user_a.id}", json=payload, headers=headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Alice Super Engineer"
    assert response.json()["target_role"] == "Lead Architect"


def test_application_ownership_and_cross_user_isolation(
    client: TestClient,
    session: Session,
    user_a: UserProfile,
    token_a: str,
    user_b: UserProfile,
    token_b: str,
    sample_job: Job,
):
    """
    1. User A creates/saves an application.
    2. User B tries to view or transition User A's application and is rejected with 403.
    3. User A can transition their own application and audit trail is recorded.
    """
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 1. User A saves an application
    save_resp = client.post(
        "/api/v1/applications",
        json={"job_id": sample_job.id, "status": "saved"},
        headers=headers_a,
    )
    assert save_resp.status_code == 200
    app_id = save_resp.json()["id"]

    # 2. User B tries to read User A's application details
    detail_resp = client.get(f"/api/v1/applications/{app_id}", headers=headers_b)
    assert detail_resp.status_code in (403, 404)

    # 3. User B tries to execute a status transition on User A's application
    trans_resp = client.post(
        f"/api/v1/applications/{app_id}/transition",
        json={"to_status": "applied", "note": "Hacked transition"},
        headers=headers_b,
    )
    assert trans_resp.status_code == 403

    # 4. User B tries to export DOCX of User A's application
    export_resp = client.get(f"/api/v1/applications/{app_id}/export/docx", headers=headers_b)
    assert export_resp.status_code in (403, 404)

    # 5. User A successfully transitions their own application
    a_trans_resp = client.post(
        f"/api/v1/applications/{app_id}/transition",
        json={"to_status": "applied", "note": "Applied directly on Stripe careers page"},
        headers=headers_a,
    )
    assert a_trans_resp.status_code == 200
    assert a_trans_resp.json()["status"] == "applied"

    # Verify timeline entry in DB
    timeline = session.exec(
        select(ApplicationTimeline).where(ApplicationTimeline.application_id == app_id)
    ).all()
    assert len(timeline) >= 1
    assert any(t.to_status == "applied" for t in timeline)
