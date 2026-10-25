"""
VaultGuard — Backup ORM Model
A Backup record stores metadata only — never the plaintext secret.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Backup(Base):
    __tablename__ = "backups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(128), nullable=False)
    description = Column(String(512), nullable=True)
    threshold = Column(Integer, nullable=False)       # k — minimum shares required
    total_shares = Column(Integer, nullable=False)    # n — total shares generated
    algorithm = Column(String(64), nullable=False, default="SHAMIR_GF256")
    status = Column(
        Enum("ACTIVE", "RECOVERING", "RECOVERED", "CORRUPTED", "ARCHIVED", name="backup_status_enum"),
        nullable=False,
        default="ACTIVE",
    )
    # SHA-256(secret) — used to verify reconstruction without storing the secret
    secret_verification_digest = Column(String(64), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(tz=timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(tz=timezone.utc),
        onupdate=lambda: datetime.now(tz=timezone.utc),
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    owner = relationship("User", back_populates="backups")
    shares = relationship("Share", back_populates="backup", cascade="all, delete-orphan")
    recovery_attempts = relationship("RecoveryAttempt", back_populates="backup")
    integrity_checks = relationship("IntegrityCheck", back_populates="backup")
    security_events = relationship("SecurityEvent", back_populates="backup")

    def __repr__(self) -> str:
        return f"<Backup id={self.id} name={self.name!r} ({self.threshold}/{self.total_shares})>"
