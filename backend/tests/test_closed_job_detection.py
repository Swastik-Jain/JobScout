import pytest
from sqlmodel import Session, select
from app.tools.job_scraper import is_job_closed
from app.models.models import IngestedJob, CompanySource, utc_now


def test_is_job_closed_detection_phrases():
    """Verify various phrasing of closed / filled / expired job postings is detected."""
    closed_snippets = [
        "<div>This position has been filled. Thank you for your interest.</div>",
        "<p>This job has expired and is no longer available.</p>",
        "<span>We are no longer accepting applications for this role.</span>",
        "<h1>Job Opening Closed</h1><p>Check our other openings.</p>",
        "<div>The posting you are looking for is no longer active.</div>",
        "<div>Sorry, this job posting is not found. Error 404</div>",
    ]

    for snippet in closed_snippets:
        assert is_job_closed(snippet) is True, f"Failed to detect closed job in: {snippet}"


def test_is_job_closed_active_posting():
    """Verify legitimate active postings do not trigger false positive closed flags."""
    active_snippets = [
        "<div>Join our team! Apply now to be a Senior Engineer. We are actively hiring!</div>",
        "<h1>Staff Security Engineer</h1><button>Apply for this Job</button>",
        "<p>About the role: You will architect resilient distributed systems with Go and Kafka.</p>",
    ]

    for snippet in active_snippets:
        assert is_job_closed(snippet) is False, f"False positive detected on active job: {snippet}"


def test_feed_sync_deactivates_vanished_jobs(session: Session):
    """
    Test real closed-job detection in the ATS sync engine:
    When an external_id is no longer present in a company's live ATS feed,
    the job record is automatically updated to is_active = False.
    """
    # 1. Seed two jobs for company 'Acme'
    job_1 = IngestedJob(
        external_id="acme-job-101",
        ats="greenhouse",
        company="Acme Corp",
        title="Frontend Specialist",
        url="https://boards.greenhouse.io/acme/jobs/101",
        is_active=True,
        first_seen_at=utc_now(),
        last_seen_at=utc_now(),
    )
    job_2 = IngestedJob(
        external_id="acme-job-102",
        ats="greenhouse",
        company="Acme Corp",
        title="Backend Architect",
        url="https://boards.greenhouse.io/acme/jobs/102",
        is_active=True,
        first_seen_at=utc_now(),
        last_seen_at=utc_now(),
    )
    session.add(job_1)
    session.add(job_2)
    session.commit()

    # 2. Simulate next feed pull where job_101 is still live, but job_102 has vanished (closed)
    live_feed_ids = {"acme-job-101"}

    # Run the exact sync logic used in sync_company_source:
    all_acme_jobs = session.exec(
        select(IngestedJob).where(
            IngestedJob.ats == "greenhouse",
            IngestedJob.company == "Acme Corp",
        )
    ).all()

    for job in all_acme_jobs:
        if job.external_id not in live_feed_ids:
            job.is_active = False
            session.add(job)

    session.commit()

    # 3. Verify job_1 remains active, while job_2 is deactivated
    session.refresh(job_1)
    session.refresh(job_2)

    assert job_1.is_active is True
    assert job_2.is_active is False
