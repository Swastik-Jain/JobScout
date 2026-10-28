import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select
from app.models.models import UserProfile
from app.core.security import verify_password


def test_register_success(client: TestClient, session: Session):
    """Test user registration generates access token and does not leak password hash."""
    payload = {
        "name": "Devin Coder",
        "email": "devin@startup.io",
        "phone": "+1-555-0199",
        "password": "SecurePassword123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    assert "token" in data
    assert len(data["token"]) > 20
    assert "profile" in data
    assert data["profile"]["email"] == "devin@startup.io"
    assert "hashed_password" not in data["profile"]

    # Verify DB state
    db_user = session.exec(select(UserProfile).where(UserProfile.email == "devin@startup.io")).first()
    assert db_user is not None
    assert verify_password("SecurePassword123!", db_user.hashed_password)


def test_register_duplicate_email_fails(client: TestClient, user_a: UserProfile):
    """Test registering with an existing email returns 400 Bad Request."""
    payload = {
        "name": "Imposter Alice",
        "email": user_a.email,  # Already in db
        "password": "AnotherPassword456!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"].lower()


def test_login_success(client: TestClient, user_a: UserProfile):
    """Test login with correct credentials returns 200 and valid JWT token."""
    payload = {
        "email": user_a.email,
        "password": "Password123!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert data["profile"]["email"] == user_a.email


def test_login_invalid_password(client: TestClient, user_a: UserProfile):
    """Test login with incorrect password returns 401 Unauthorized."""
    payload = {
        "email": user_a.email,
        "password": "WrongPassword999!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    assert "invalid" in response.json()["detail"].lower()


def test_login_nonexistent_user(client: TestClient):
    """Test login with non-existent email returns 401 Unauthorized."""
    payload = {
        "email": "nobody@nowhere.com",
        "password": "Password123!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401


def test_protected_route_requires_auth(client: TestClient):
    """Test accessing protected route without Bearer token returns 401."""
    response = client.get("/api/v1/profile/me")
    assert response.status_code == 401


def test_protected_route_with_valid_token(client: TestClient, user_a: UserProfile, token_a: str):
    """Test accessing protected route with Bearer token returns 200."""
    headers = {"Authorization": f"Bearer {token_a}"}
    response = client.get("/api/v1/profile/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == user_a.email
    assert data["name"] == user_a.name
