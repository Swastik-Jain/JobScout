import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.db import get_session
from app.core.security import hash_password, create_access_token
from app.models.models import UserProfile, Job, Application, utc_now

# Use isolated in-memory SQLite database for testing
TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


from sqlalchemy import text

@pytest.fixture(scope="function")
def session() -> Generator[Session, None, None]:
    """Provides a fresh database session for each test function."""
    SQLModel.metadata.create_all(test_engine)
    with Session(test_engine) as s:
        yield s
    with test_engine.connect() as conn:
        conn.exec_driver_sql("PRAGMA foreign_keys = OFF;")
        SQLModel.metadata.drop_all(conn)
        conn.exec_driver_sql("PRAGMA foreign_keys = ON;")
        conn.commit()


@pytest.fixture(scope="function")
def client(session: Session) -> Generator[TestClient, None, None]:
    """TestClient wired with database session dependency override."""
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def user_a(session: Session) -> UserProfile:
    """Creates primary test user (User A)."""
    user = UserProfile(
        name="Alice Engineer",
        email="alice@example.com",
        hashed_password=hash_password("Password123!"),
        target_role="Full Stack Engineer",
        skills=["Python", "FastAPI", "React", "TypeScript"],
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@pytest.fixture(scope="function")
def token_a(user_a: UserProfile) -> str:
    """JWT bearer token for User A."""
    return create_access_token({"sub": user_a.email})


@pytest.fixture(scope="function")
def user_b(session: Session) -> UserProfile:
    """Creates secondary test user (User B) for ownership and multi-tenancy verification."""
    user = UserProfile(
        name="Bob Hacker",
        email="bob@example.com",
        hashed_password=hash_password("BobSecret456!"),
        target_role="DevOps Engineer",
        skills=["Kubernetes", "AWS", "Terraform"],
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@pytest.fixture(scope="function")
def token_b(user_b: UserProfile) -> str:
    """JWT bearer token for User B."""
    return create_access_token({"sub": user_b.email})


@pytest.fixture(scope="function")
def sample_job(session: Session) -> Job:
    """Creates a sample job in the database."""
    job = Job(
        ats="greenhouse",
        external_id="stripe-123456",
        title="Senior Python Backend Engineer",
        company="Stripe",
        location="Remote, India",
        description="We are seeking an experienced Python engineer to build distributed payment pipelines.",
        url="https://boards.greenhouse.io/stripe/jobs/123456",
        is_active=True,
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    return job
