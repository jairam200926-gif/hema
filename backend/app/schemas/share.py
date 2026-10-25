"""VaultGuard — Share Pydantic Schemas"""
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class ShareResponse(BaseModel):
    id: UUID
    backup_id: UUID
    custodian_id: UUID | None
    share_index: int
    # encrypted_share is intentionally omitted from API responses
    share_integrity_hash: str
    status: str
    created_at: datetime
    last_verified_at: datetime | None

    model_config = {"from_attributes": True}
