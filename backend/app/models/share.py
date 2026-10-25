"""
VaultGuard — Share ORM Model
Each share stores only the AES-256-GCM encrypted (x, y) coordinate.
Plaintext share values are NEVER written to disk.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Share(Base):
    __tablename__ = "shares"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    backup_id = Column(UUID(as_uuid=True), ForeignKey("backups.id", ondelete="CASCADE"), nullable=False)
    custodian_id = Column(UUID(as_uuid=True), ForeignKey("custodians.id", ondelete="SET NULL"), nullable=True)

    # Shamir share index (x-coordinate); 1-indexed, unique within a backup
    share_index = Column(Integer, nullable=False)

    # AES-256-GCM ciphertext (base64-encoded)
    encrypted_share = Column(Text, nullable=False)
    # 96-bit nonce (base64-encoded); unique per share
    nonce = Column(String(24), nullable=False)
    # 128-bit GCM authentication tag (base64-encoded)
    auth_tag = Column(String(24), nullable=False)

    # SHA-256(canonical(x_i, y_i)) — pre-encryption integrity anchor
    share_integrity_hash = Column(String(64), nullable=False)

    status = Column(
        Enum("HEALTHY", "UNVERIFIED", "COMPROMISED", "MISSING", name="share_status_enum"),
        nullable=False,
        default="UNVERIFIED",
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(tz=timezone.utc),
    )
    last_verified_at = Column(DateTime(timezone=True), nullable=True)

    # ── Relationships ──────────────────────────────────────────────────────────
    backup = relationship("Backup", back_populates="shares")
    custodian = relationship("Custodian", back_populates="shares")
    integrity_checks = relationship("IntegrityCheck", back_populates="share")
    security_events = relationship("SecurityEvent", back_populates="share")

    def __repr__(self) -> str:
        return f"<Share id={self.id} backup={self.backup_id} index={self.share_index} status={self.status}>"
