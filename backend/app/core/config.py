"""
VaultGuard — Application Configuration
All settings are loaded from environment variables via pydantic-settings.
No secret defaults are acceptable in production; sensible insecure defaults
are used ONLY for local development and the prototype testbed.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
import os
import pathlib
import os
import pathlib
import re
from functools import lru_cache
from typing import Optional
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Locate repository root and backend directory for .env resolution
BACKEND_DIR = pathlib.Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent if (BACKEND_DIR.parent / ".env").exists() else BACKEND_DIR

# Prioritize backend/.env, fall back to root .env
ENV_FILE = BACKEND_DIR / ".env" if (BACKEND_DIR / ".env").exists() else (PROJECT_ROOT / ".env")

# Well-known development-only fallback key (NEVER randomly generated on restart to preserve persistence)
DEV_DEFAULT_AES_KEY_HEX = "4f9e8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f"
DEV_DEFAULT_JWT_SECRET = "vaultguard_insecure_dev_jwt_secret_must_override_in_production_32b_min"

HEX_KEY_PATTERN = re.compile(r"^[0-9a-fA-F]{64}$")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE) if ENV_FILE.exists() else None,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ────────────────────────────────────────────────────────────
    APP_NAME: str = "VaultGuard"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # development | staging | production

    # ── Security ───────────────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = DEV_DEFAULT_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"          # Pinned — rejects "none" & asymmetric
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    RECOVERY_REQUEST_TTL_MINUTES: int = 15

    # ── Database ───────────────────────────────────────────────────────────────
    POSTGRES_USER: str = "vaultguard"
    POSTGRES_PASSWORD: str = "vaultguard_dev_password"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "vaultguard_db"

    @property
    def DATABASE_URL(self) -> str:
        env_url = os.getenv("DATABASE_URL")
        if env_url:
            return env_url
        # If DATABASE_URL is not set, default to local SQLite in development for zero-friction setup
        if self.ENVIRONMENT == "development":
            return f"sqlite:///{BACKEND_DIR}/vaultguard.db"
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # ── Cryptography ───────────────────────────────────────────────────────────
    # Standardized AES-256-GCM master key — MUST be a 32-byte hex string (64 hex characters).
    AES_MASTER_KEY_HEX: str = DEV_DEFAULT_AES_KEY_HEX

    @field_validator("AES_MASTER_KEY_HEX")
    @classmethod
    def validate_master_key_format(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if not HEX_KEY_PATTERN.match(cleaned):
            raise ValueError(
                "AES_MASTER_KEY_HEX must be exactly 64 hexadecimal characters encoding a 32-byte AES-256 key."
            )
        return cleaned

    @model_validator(mode="after")
    def validate_production_configuration(self) -> "Settings":
        # Resolve legacy env var if set
        legacy_env = os.getenv("AES_MASTER_KEY")
        if legacy_env and not os.getenv("AES_MASTER_KEY_HEX"):
            cleaned_alias = legacy_env.strip().lower()
            if HEX_KEY_PATTERN.match(cleaned_alias):
                self.AES_MASTER_KEY_HEX = cleaned_alias

        # Production security assertion
        if self.ENVIRONMENT.lower() == "production":
            insecure_placeholders = {
                DEV_DEFAULT_AES_KEY_HEX.lower(),
                ("0" * 64).lower(),
                "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef".lower(),
            }
            if self.AES_MASTER_KEY_HEX.lower() in insecure_placeholders:
                raise ValueError(
                    "CRITICAL PRODUCTION ERROR: Default or placeholder AES_MASTER_KEY_HEX cannot be used in production. "
                    "Generate a fresh 32-byte key: python -c \"import secrets; print(secrets.token_hex(32))\""
                )
            if (
                self.JWT_SECRET_KEY == DEV_DEFAULT_JWT_SECRET
                or len(self.JWT_SECRET_KEY.strip()) < 32
                or "CHANGE_ME" in self.JWT_SECRET_KEY
            ):
                raise ValueError(
                    "CRITICAL PRODUCTION ERROR: Insecure JWT_SECRET_KEY in production. "
                    "Provide a cryptographically secure random secret of at least 32 bytes."
                )

        return self

    @property
    def AES_MASTER_KEY_BYTES(self) -> bytes:
        return bytes.fromhex(self.AES_MASTER_KEY_HEX)

    @property
    def AES_MASTER_KEY(self) -> bytes:
        """Backward-compatibility property returning raw 32 bytes."""
        return self.AES_MASTER_KEY_BYTES

    # ── Argon2id Parameters (RFC 9106) ─────────────────────────────────────────
    ARGON2_TIME_COST: int = 3
    ARGON2_MEMORY_COST_KIB: int = 65536   # 64 MB
    ARGON2_PARALLELISM: int = 1
    ARGON2_HASH_LENGTH: int = 32

    # ── CORS ───────────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    # ── Email ──────────────────────────────────────────────────────────────────
    EMAIL_MODE: str = "development"   # development | smtp
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@vaultguard.local"


@lru_cache
def get_settings() -> Settings:
    """Cached singleton settings loader."""
    return Settings()

