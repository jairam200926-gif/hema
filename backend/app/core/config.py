from functools import lru_cache
import json
import os
import pathlib
import re

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

    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "https://hema-smdr4skgd-tesla-webdevelopment.vercel.app",
        "https://hema-lac.vercel.app",
    ]

    DATABASE_URL: str | None = None

    POSTGRES_USER: str = "vaultguard"
    POSTGRES_PASSWORD: str = "vaultguard_dev_password"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "vaultguard_db"

    AES_MASTER_KEY_HEX: str = DEV_DEFAULT_AES_KEY_HEX

    # Argon2id password-hashing parameters used by app/crypto/hashing.py.
    ARGON2_TIME_COST: int = 3
    ARGON2_MEMORY_COST_KIB: int = 65536
    ARGON2_PARALLELISM: int = 1
    ARGON2_HASH_LENGTH: int = 32

    @property
    def AES_MASTER_KEY_BYTES(self) -> bytes:
        """Return the configured AES-256 master key as 32 raw bytes."""
        return bytes.fromhex(self.AES_MASTER_KEY_HEX)

    @property
    def AES_MASTER_KEY(self) -> bytes:
        """Backward-compatible property for crypto modules using the raw key."""
        return self.AES_MASTER_KEY_BYTES

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if value is None:
            return []
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []
            if raw.startswith("["):
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError:
                    parsed = None
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]
            return [item.strip() for item in raw.replace(" ", "").split(",") if item.strip()]
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        return [str(value).strip()]

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
            raise ValueError("AES_MASTER_KEY_HEX must be exactly 64 hexadecimal characters.")
        return cleaned

    @model_validator(mode="after")
    def validate_and_resolve_configuration(self) -> "Settings":
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

        url = self.DATABASE_URL.strip()
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
        self.DATABASE_URL = url

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
