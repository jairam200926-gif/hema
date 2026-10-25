"""
VaultGuard — Recovery Attempt ORM Model
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class RecoveryAttempt(Base):
    __tablename__ = "recovery_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    backup_id = Column(UUID(as_uuid=True), ForeignKey("backups.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Unique, opaque request identifier issued to the client (replay protection)
    request_id = Column(String(64), unique=True, nullable=False, index=True)

    shares_requested = Column(Integer, nullable=False)    # n (total shares in backup)
    valid_shares = Column(Integer, nullable=False, default=0)
    threshold_required = Column(Integer, nullable=False)  # k

    result = Column(
        Enum("PENDING", "SUCCESS", "FAILED", "EXPIRED", "REPLAY_BLOCKED", name="recovery_result_enum"),
        nullable=False,
        default="PENDING",
    )
    failure_reason = Column(String(512), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(tz=timezone.utc),
    )
    expires_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # ── Relationships ──────────────────────────────────────────────────────────
    backup = relationship("Backup", back_populates="recovery_attempts")
    user = relationship("User", back_populates="recovery_attempts")
    security_events = relationship("SecurityEvent", back_populates="recovery_attempt")

    def __repr__(self) -> str:
        return f"<RecoveryAttempt id={self.id} request_id={self.request_id!r} result={self.result}>"
