"""
VaultGuard application settings.

Production deployments must explicitly provide:
- ENVIRONMENT=production
- DATABASE_URL for a reachable hosted PostgreSQL database
- JWT_SECRET_KEY (at least 32 characters, generated securely)
- AES_MASTER_KEY_HEX (64 hexadecimal characters, generated securely)
"""
from functools import lru_cache
import os
import pathlib
import re
from urllib.parse import quote

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = pathlib.Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent if (BACKEND_DIR.parent / ".env").exists() else BACKEND_DIR
ENV_FILE = BACKEND_DIR / ".env" if (BACKEND_DIR / ".env").exists() else (PROJECT_ROOT / ".env")

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

    APP_NAME: str = "VaultGuard"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    JWT_SECRET_KEY: str = DEV_DEFAULT_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    RECOVERY_REQUEST_TTL_MINUTES: int = 15

    # Pydantic Settings reads DATABASE_URL from the environment automatically.
    DATABASE_URL: str | None = None

    POSTGRES_USER: str = "vaultguard"
    POSTGRES_PASSWORD: str = "vaultguard_dev_password"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "vaultguard_db"

    AES_MASTER_KEY_HEX: str = DEV_DEFAULT_AES_KEY_HEX

    @field_validator("ENVIRONMENT")
    @classmethod
    def normalize_environment(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in {"development", "staging", "production"}:
            raise ValueError("ENVIRONMENT must be development, staging, or production")
        return value

    @field_validator("AES_MASTER_KEY_HEX")
    @classmethod
    def validate_master_key_format(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if not HEX_KEY_PATTERN.fullmatch(cleaned):
            raise ValueError(
                "AES_MASTER_KEY_HEX must be exactly 64 hexadecimal characters."
            )
        return cleaned

    @model_validator(mode="after")
    def validate_and_resolve_configuration(self) -> "Settings":
        # Support older deployments that used AES_MASTER_KEY for the hex value.
        legacy_key = os.getenv("AES_MASTER_KEY")
        if legacy_key and not os.getenv("AES_MASTER_KEY_HEX"):
            cleaned = legacy_key.strip().lower()
            if HEX_KEY_PATTERN.fullmatch(cleaned):
                self.AES_MASTER_KEY_HEX = cleaned

        if not self.DATABASE_URL:
            if self.ENVIRONMENT == "development":
                self.DATABASE_URL = f"sqlite:///{BACKEND_DIR / 'vaultguard.db'}"
            else:
                raise ValueError(
                    "DATABASE_URL must be configured for staging/production. "
                    "Set it to your hosted PostgreSQL connection URL."
                )

        # Providers sometimes supply postgres://; SQLAlchemy expects postgresql://.
        url = self.DATABASE_URL.strip()
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
