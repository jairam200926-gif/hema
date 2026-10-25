"""VaultGuard — Custodian Pydantic Schemas"""
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


class CustodianCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    type: str = Field(default="TRUSTED_HUMAN", pattern=r"^(HARDWARE_TOKEN|CLOUD_KMS|TRUSTED_HUMAN|INSTITUTION)$")
    email: EmailStr | None = None
    description: str | None = Field(None, max_length=512)


class CustodianResponse(BaseModel):
    id: UUID
    name: str
    type: str
    status: str
    email: str | None
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
