"""
VaultGuard — SQLAlchemy Database Engine & Session Factory
"""
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from typing import Generator
from app.core.config import get_settings

settings = get_settings()


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass


# Synchronous engine (suitable for the prototype scope)
if settings.DATABASE_URL.startswith("postgresql"):
    engine = create_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,          # SQL logging in debug mode only
        pool_pre_ping=True,           # Validate connections before use
        pool_size=5,
        max_overflow=10,
        connect_args={
            "connect_timeout": 10,
            "options": "-c timezone=UTC",
        },
    )
elif settings.DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        pool_pre_ping=True,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        pool_pre_ping=True,
    )

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,       # Avoids lazy-load issues after commit
)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a transactional DB session.
    Rolls back on exception; always closes on teardown.
    """
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
    """Create all tables from the ORM model metadata (used for dev/testing)."""
    from app import models  # noqa: F401 — registers all model subclasses
    Base.metadata.create_all(bind=engine)


def check_db_connection() -> bool:
    """Health-check probe; returns True if the database is reachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
