"""Closed-job detection via ATS feed sync (the mechanism that actually runs in production)."""
from sqlmodel import select

from app.models.models import CompanySource, Job
from app.tools import ats_adapters


def _listing(ext_id: str, title: str) -> dict:
    return {
        "external_id": ext_id,
        "title": title,
        "company": "Acme",
        "location": "Remote, India",
        "url": f"https://boards.greenhouse.io/acme/jobs/{ext_id}",
        "description": None,
        "ats": "greenhouse",
    }


async def _sync(session, source, monkeypatch, listings):
    async def fake_fetch(slug, client):
        return listings

    monkeypatch.setattr(ats_adapters, "fetch_greenhouse_listings", fake_fetch)
    return await ats_adapters.sync_company_source(source, session, client=None)


async def test_job_missing_from_feed_is_deactivated_and_reactivated(session, monkeypatch):
    source = CompanySource(ats="greenhouse", slug="acme", name="Acme")
    session.add(source)
    session.commit()
    session.refresh(source)

    both = [_listing("1", "Backend Engineer"), _listing("2", "Frontend Engineer")]
    assert await _sync(session, source, monkeypatch, both) == 2

    # Job 2 vanishes from the feed -> closed
    assert await _sync(session, source, monkeypatch, [both[0]]) == 1
    jobs = {j.external_id: j for j in session.exec(select(Job)).all()}
    assert jobs["1"].is_active is True
    assert jobs["2"].is_active is False

    # Job 2 reappears -> active again, no duplicate row
    await _sync(session, source, monkeypatch, both)
    session.expire_all()
    jobs = session.exec(select(Job)).all()
    assert len(jobs) == 2
    assert all(j.is_active for j in jobs)


async def test_repeated_feed_failures_deactivate_source(session, monkeypatch):
    source = CompanySource(ats="greenhouse", slug="broken", name="Broken")
    session.add(source)
    session.commit()
    session.refresh(source)

    async def boom(slug, client):
        raise RuntimeError("HTTP 500")

    monkeypatch.setattr(ats_adapters, "fetch_greenhouse_listings", boom)
    for _ in range(3):
        assert await ats_adapters.sync_company_source(source, session, client=None) == 0

    session.refresh(source)
    assert source.fail_count == 3
    assert source.is_active is False
