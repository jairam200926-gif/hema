"""VaultGuard — Recovery Pydantic Schemas"""

from uuid import UUID

from pydantic import BaseModel, Field


class RecoveryInitRequest(BaseModel):
    backup_id: UUID


class RecoveryInitResponse(BaseModel):
    request_id: str
    backup_id: UUID
    threshold: int
    total_shares: int
    expires_at: str | None = None
    message: str


class SubmittedShare(BaseModel):
    custodian_id: UUID
    share_index: int = Field(..., ge=1, le=255)


class RecoverySubmitRequest(BaseModel):
    request_id: str = Field(..., min_length=1)
    shares: list[SubmittedShare] = Field(..., min_length=1)
    confirm_release: bool = Field(default=True, description="Explicit operator confirmation flag")
    confirmation_password: str | None = Field(default=None, description="Optional reauthentication password for high-security releases")


class RecoverySubmitResponse(BaseModel):
    request_id: str
    result: str
    valid_shares: int
    threshold_required: int
    recovered_secret: str | None = None
    verification_digest: str | None = None
    message: str