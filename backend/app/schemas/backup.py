"""VaultGuard — Backup Pydantic Schemas"""
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class BackupCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    description: str | None = Field(None, max_length=512)
    secret: str = Field(..., min_length=1, max_length=4096, description="Plaintext secret — never persisted")
    threshold: int = Field(..., ge=2, le=255, description="Minimum shares required for recovery (k)")
    total_shares: int = Field(..., ge=2, le=255, description="Total shares to generate (n)")
    custodian_ids: list[UUID] = Field(..., min_length=2)

    def model_post_init(self, __context):
        if self.threshold > self.total_shares:
            raise ValueError("threshold (k) must be <= total_shares (n)")
        if len(self.custodian_ids) != self.total_shares:
            raise ValueError("custodian_ids length must equal total_shares")


class BackupListItem(BaseModel):
    id: UUID
    name: str
    description: str | None
    threshold: int
    total_shares: int
    algorithm: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class BackupResponse(BackupListItem):
    owner_id: UUID
    secret_verification_digest: str
    updated_at: datetime
