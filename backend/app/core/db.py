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


def _auto_migrate_columns(engine):
    """Ensures newly added SQLModel columns exist in SQLite without requiring manual migrations."""
    from sqlalchemy import text, inspect
    try:
        inspector = inspect(engine)
        with engine.begin() as conn:
            for table_name, table in SQLModel.metadata.tables.items():
                if not inspector.has_table(table_name):
                    continue
                existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
                for col in table.columns:
                    if col.name not in existing_cols:
                        col_type = col.type.compile(engine.dialect)
                        default_clause = ""
                        if col.default is not None and hasattr(col.default, "arg"):
                            default_clause = f" DEFAULT '{col.default.arg}'"
                        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}{default_clause}"))
                        logger.info(f"[DB] Auto-migrated: added column {col.name} ({col_type}) to {table_name}")
    except Exception as e:
        logger.warning(f"[DB] Auto-migration check warning: {e}")


def init_db():
    SQLModel.metadata.create_all(engine)
    if is_sqlite:
        _auto_migrate_columns(engine)
    with Session(engine) as session:
        seed_company_sources(session)


def get_session():
    with Session(engine) as session:
        yield session

