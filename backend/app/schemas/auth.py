"""
VaultGuard — Authentication Pydantic Schemas
"""
import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Password strength policy ───────────────────────────────────────────────────
_PASSWORD_REGEX = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+\[\]{};:'\",.<>/?\\|`~]).{10,128}$"
)


class UserRegisterRequest(BaseModel):
    username: str = Field(
        ...,
        min_length=3,
        max_length=64,
        pattern=r"^[a-zA-Z0-9_-]+$",
        description="Alphanumeric username (3–64 chars, underscores/hyphens allowed)",
    )
    email: EmailStr
    password: str = Field(..., min_length=10, max_length=128)
    role: str = Field(default="USER", pattern=r"^(USER|ADMIN|CUSTODIAN)$")

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not _PASSWORD_REGEX.match(v):
            raise ValueError(
                "Password must be 10–128 characters and contain uppercase, "
                "lowercase, a digit, and a special character."
            )
        return v


class UserLoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=128, description="Operator username or email address")
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int    # seconds


class UserResponse(BaseModel):
    id: UUID
    username: str
    email: str
    role: str
    is_active: bool

    model_config = {"from_attributes": True}


class UserMeResponse(UserResponse):
    email_verified: bool
    created_at: datetime
    updated_at: datetime
