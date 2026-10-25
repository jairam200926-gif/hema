"""VaultGuard — Audit / Notification Pydantic Schemas"""
from datetime import datetime
from typing import Any
from uuid import UUID
from pydantic import BaseModel


class SecurityEventResponse(BaseModel):
    id: UUID
    event_type: str
    user_id: UUID | None
    backup_id: UUID | None
    share_id: UUID | None
    request_id: str | None
    result: str
    previous_hash: str | None = None
    event_hash: str | None = None
    metadata_: dict[str, Any] | None = None
    ip_address: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationResponse(BaseModel):
    id: UUID
    notification_type: str
    subject: str
    status: str
    created_at: datetime
    sent_at: datetime | None
    failure_reason: str | None

    model_config = {"from_attributes": True}
