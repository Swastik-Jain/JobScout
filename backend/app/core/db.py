import json
import logging
from pathlib import Path
from sqlmodel import create_engine, SQLModel, Session, select
from app.core.config import settings

logger = logging.getLogger("jobscout.db")

db_url = settings.database_url
is_sqlite = db_url.startswith("sqlite")

if is_sqlite:
    engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_engine(
        db_url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )


def seed_company_sources(session: Session):
    """Seed initial verified company sources from companies.json if table is empty."""
    from app.models.models import CompanySource
    existing = session.exec(select(CompanySource)).first()
    if existing:
        return

    seed_path = Path(__file__).resolve().parent.parent / "data" / "companies.json"
    if not seed_path.exists():
        return

    try:
        with open(seed_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        count = 0
        for ats, slugs in data.items():
            for slug in slugs:
                source = CompanySource(
                    ats=ats.lower(),
                    slug=slug.lower(),
                    name=slug.replace("-", " ").title(),
                    is_active=True,
                )
                session.add(source)
                count += 1
        session.commit()
        logger.info(f"[DB] Initialized {count} company sources from seed file.")
    except Exception as e:
        logger.warning(f"[DB] Could not seed company sources: {e}")


def init_db():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed_company_sources(session)


def get_session():
    with Session(engine) as session:
        yield session

