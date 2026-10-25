"""
VaultGuard — Custodian ORM Model
Custodians are logical trusted entities that each hold one AES-encrypted share.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Custodian(Base):
    __tablename__ = "custodians"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(128), nullable=False)
    type = Column(
        Enum("HARDWARE_TOKEN", "CLOUD_KMS", "TRUSTED_HUMAN", "INSTITUTION", name="custodian_type_enum"),
        nullable=False,
        default="TRUSTED_HUMAN",
    )
    status = Column(
        Enum("ACTIVE", "SUSPENDED", "REVOKED", name="custodian_status_enum"),
        nullable=False,
        default="ACTIVE",
    )
    email = Column(String(320), nullable=True)
    description = Column(String(512), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(tz=timezone.utc),
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    shares = relationship("Share", back_populates="custodian")

    def __repr__(self) -> str:
        return f"<Custodian id={self.id} name={self.name!r} type={self.type}>"
