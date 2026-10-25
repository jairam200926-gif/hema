"""
VaultGuard — SQLAlchemy database engine and session factory.
"""
from typing import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()
database_url = settings.DATABASE_URL
if not database_url:
    # Normally prevented by Settings validation; keeps type-checkers honest.
    raise RuntimeError("DATABASE_URL is not configured.")

url = make_url(database_url)

class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass


engine_options = {
    "echo": settings.DEBUG,
    "pool_pre_ping": True,
}

if url.get_backend_name() == "sqlite":
    engine_options["connect_args"] = {"check_same_thread": False}
else:
    # Keep the connection pool small for serverless deployments.
    # DATABASE_URL may include provider-required SSL query parameters.
    engine_options.update({
        "pool_size": 1,
        "max_overflow": 0,
        "pool_timeout": 10,
        "pool_recycle": 300,
    })
    if url.get_backend_name() == "postgresql":
        engine_options["connect_args"] = {
            "connect_timeout": 10,
            "options": "-c timezone=UTC",
        }

engine = create_engine(database_url, **engine_options)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    """Yield a database session, committing successful requests and rolling back failures."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def create_tables() -> None:
    """Create ORM tables for development/testing only."""
    from app import models  # noqa: F401
    Base.metadata.create_all(bind=engine)


def check_db_connection() -> bool:
    """Return True if the database can execute a trivial query."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        # Do not leak credentials or connection details into health responses.
        # Inspect deployment logs for the underlying driver/database exception.
        return False
