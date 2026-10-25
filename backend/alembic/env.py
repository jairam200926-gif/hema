"""
Alembic environment — configured for VaultGuard.
Reads the DATABASE_URL from app settings (which reads from .env).
Imports all models so autogenerate can detect schema changes.
"""
import sys
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# ── Ensure the backend/ directory is on sys.path ──────────────────────────────
# This allows 'from app.xxx import ...' to resolve correctly.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── Import app settings and all ORM models ────────────────────────────────────
from app.core.config import get_settings
from app.core.database import Base
import app.models  # noqa: F401 — registers all subclasses with Base.metadata

settings = get_settings()

# ── Alembic Config object ─────────────────────────────────────────────────────
config = context.config

# Override sqlalchemy.url from our Settings (reads from .env)
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Autogenerate will compare against these models
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Offline mode — emits SQL without a live DB connection."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Online mode — requires a live PostgreSQL connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
