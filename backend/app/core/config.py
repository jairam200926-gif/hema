"""
VaultGuard — Application Configuration.

Loads settings from environment variables and an optional .env file.
Production deployments must provide secure cryptographic keys and
a valid database configuration.
"""

import os
import pathlib
import re
from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# Project paths
BACKEND_DIR = pathlib.Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent

# Prefer backend/.env; otherwise use the project-root .env.
BACKEND_ENV_FILE = BACKEND_DIR / ".env"
ROOT_ENV_FILE = PROJECT_ROOT / ".env"

ENV_FILE = (
    BACKEND_ENV_FILE
    if BACKEND_ENV_FILE.exists()
    else ROOT_ENV_FILE
)

HEX_KEY_PATTERN = re.compile(r"^[0-9a-fA-F]{64}$")

DEV_DEFAULT_AES_KEY_HEX = (
    "4f9e8a7b6c5d4e3f2a1b0c9d8e7f6a5b"
    "4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f"
)

DEV_DEFAULT_JWT_SECRET = (
    "vaultguard_insecure_dev_jwt_secret_must_override_in_production_32b_min"
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE) if ENV_FILE.exists() else None,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "VaultGuard"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # Authentication
    JWT_SECRET_KEY: str = DEV_DEFAULT_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    RECOVERY_REQUEST_TTL_MINUTES: int = 15

    # Database
    POSTGRES_USER: str = "vaultguard"
    POSTGRES_PASSWORD: str = "vaultguard_dev_password"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "vaultguard_db"

    DATABASE_URL: str | None = None

    # Cryptography
    AES_MASTER_KEY_HEX: str = DEV_DEFAULT_AES_KEY_HEX

    # Argon2id parameters
    ARGON2_TIME_COST: int = 3
    ARGON2_MEMORY_COST_KIB: int = 65536
    ARGON2_PARALLELISM: int = 1
    ARGON2_HASH_LENGTH: int = 32

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://hema-lac.vercel.app",
    ]

    # Email
    EMAIL_MODE: str = "development"
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@vaultguard.local"

    @field_validator("AES_MASTER_KEY_HEX")
    @classmethod
    def validate_master_key_format(cls, value: str) -> str:
        value = value.strip()

        if not HEX_KEY_PATTERN.fullmatch(value):
            raise ValueError(
                "AES_MASTER_KEY_HEX must contain exactly "
                "64 hexadecimal characters."
            )

        return value.lower()

    @field_validator("ENVIRONMENT")
    @classmethod
    def normalize_environment(cls, value: str) -> str:
        return value.strip().lower()

    @model_validator(mode="after")
    def validate_configuration(self):
        # Support the legacy AES_MASTER_KEY environment variable.
        legacy_key = os.getenv("AES_MASTER_KEY")

        if legacy_key and not os.getenv("AES_MASTER_KEY_HEX"):
            legacy_key = legacy_key.strip()

            if HEX_KEY_PATTERN.fullmatch(legacy_key):
                self.AES_MASTER_KEY_HEX = legacy_key.lower()

        # Resolve database URL.
        if not self.DATABASE_URL:
            if self.ENVIRONMENT == "development":
                database_path = BACKEND_DIR / "vaultguard.db"
                self.DATABASE_URL = f"sqlite:///{database_path.as_posix()}"
            else:
                raise ValueError(
                    "DATABASE_URL must be configured outside development."
                )

        # Validate production configuration.
        if self.ENVIRONMENT == "production":
            if self.AES_MASTER_KEY_HEX == DEV_DEFAULT_AES_KEY_HEX.lower():
                raise ValueError(
                    "Production requires a newly generated AES_MASTER_KEY_HEX."
                )

            if (
                self.JWT_SECRET_KEY == DEV_DEFAULT_JWT_SECRET
                or len(self.JWT_SECRET_KEY.encode("utf-8")) < 32
            ):
                raise ValueError(
                    "Production requires a secure JWT_SECRET_KEY "
                    "of at least 32 bytes."
                )

            if "CHANGE_ME" in self.JWT_SECRET_KEY.upper():
                raise ValueError(
                    "JWT_SECRET_KEY must not contain a placeholder."
                )

        return self

    @property
    def AES_MASTER_KEY_BYTES(self) -> bytes:
        return bytes.fromhex(self.AES_MASTER_KEY_HEX)

    @property
    def AES_MASTER_KEY(self) -> bytes:
        """Backward-compatible property returning the raw AES key."""
        return self.AES_MASTER_KEY_BYTES


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached application settings."""
    return Settings()
