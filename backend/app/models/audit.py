"""
VaultGuard — Audit / Security Event ORM Models
Includes: SecurityEvent, IntegrityCheck, Notification, NotificationPreference
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class SecurityEvent(Base):
    """Immutable append-only audit log entry."""
    __tablename__ = "security_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type = Column(
        Enum(
            # Backup lifecycle
            "BACKUP_CREATED", "BACKUP_ARCHIVED",
            # Share operations
            "SHARE_GENERATED", "SHARE_INTEGRITY_VERIFIED", "SHARE_INTEGRITY_FAILURE",
            # Recovery
            "RECOVERY_INITIATED", "RECOVERY_SUCCESS", "RECOVERY_FAILED",
            # Attack simulations / anomalies
            "REPLAY_ATTEMPT", "DUPLICATE_SHARE", "INVALID_THRESHOLD",
            "BRUTE_FORCE_ATTEMPT", "SYBIL_ATTEMPT", "UNAUTHORIZED_ATTEMPT",
            "POLICY_VIOLATION",
            # Auth & Admin
            "USER_REGISTERED", "USER_LOGIN", "USER_LOGIN_FAILED",
            "CUSTODIAN_CREATED", "CUSTODIAN_REVOKED", "AUDIT_CHAIN_VERIFIED",
            name="security_event_type_enum",
        ),
        nullable=False,
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    backup_id = Column(UUID(as_uuid=True), ForeignKey("backups.id", ondelete="SET NULL"), nullable=True)
    share_id = Column(UUID(as_uuid=True), ForeignKey("shares.id", ondelete="SET NULL"), nullable=True)
    recovery_attempt_id = Column(
        UUID(as_uuid=True), ForeignKey("recovery_attempts.id", ondelete="SET NULL"), nullable=True
    )
    request_id = Column(String(64), nullable=True, index=True)
    result = Column(
        Enum("SUCCESS", "FAILURE", "WARNING", "INFO", name="event_result_enum"),
        nullable=False,
        default="INFO",
    )
    # Cryptographic Hash-Chain Columns for Tamper Evidence
    previous_hash = Column(String(64), nullable=True)
    event_hash = Column(String(64), nullable=True)

    metadata_ = Column("metadata", JSON, nullable=True)   # Flexible extra data
    ip_address = Column(String(45), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(tz=timezone.utc),
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    user = relationship("User", back_populates="security_events")
    backup = relationship("Backup", back_populates="security_events")
    share = relationship("Share", back_populates="security_events")
    recovery_attempt = relationship("RecoveryAttempt", back_populates="security_events")
    notifications = relationship("Notification", back_populates="security_event")

    def __repr__(self) -> str:
        return f"<SecurityEvent type={self.event_type} result={self.result} at={self.created_at}>"


class IntegrityCheck(Base):
    """Records the outcome of each individual share integrity verification run."""
    __tablename__ = "integrity_checks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    share_id = Column(UUID(as_uuid=True), ForeignKey("shares.id", ondelete="CASCADE"), nullable=False)
    backup_id = Column(UUID(as_uuid=True), ForeignKey("backups.id", ondelete="CASCADE"), nullable=False)
    expected_hash = Column(String(64), nullable=False)
    calculated_hash = Column(String(64), nullable=False)
    status = Column(
        Enum("PASSED", "FAILED", "ERROR", name="integrity_check_status_enum"),
        nullable=False,
    )
    checked_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(tz=timezone.utc),
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    share = relationship("Share", back_populates="integrity_checks")
    backup = relationship("Backup", back_populates="integrity_checks")

    def __repr__(self) -> str:
        return f"<IntegrityCheck share={self.share_id} status={self.status}>"


class Notification(Base):
    """Outbound notification record (email queue entry)."""
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    security_event_id = Column(
        UUID(as_uuid=True), ForeignKey("security_events.id", ondelete="SET NULL"), nullable=True
    )
    recipient = Column(String(320), nullable=False)
    notification_type = Column(String(64), nullable=False)
    subject = Column(String(256), nullable=False)
    body = Column(Text, nullable=True)
    status = Column(
        Enum("QUEUED", "SENT", "FAILED", "SUPPRESSED", name="notification_status_enum"),
        nullable=False,
        default="QUEUED",
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(tz=timezone.utc),
    )
    sent_at = Column(DateTime(timezone=True), nullable=True)
    failure_reason = Column(String(512), nullable=True)

    # ── Relationships ──────────────────────────────────────────────────────────
    user = relationship("User", back_populates="notifications")
    security_event = relationship("SecurityEvent", back_populates="notifications")

    def __repr__(self) -> str:
        return f"<Notification type={self.notification_type} status={self.status}>"


class NotificationPreference(Base):
    """Per-user opt-in flags for notification categories."""
    __tablename__ = "notification_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    security_alerts = Column(Boolean, nullable=False, default=True)
    recovery_alerts = Column(Boolean, nullable=False, default=True)
    backup_notifications = Column(Boolean, nullable=False, default=True)
    integrity_alerts = Column(Boolean, nullable=False, default=True)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(tz=timezone.utc),
        onupdate=lambda: datetime.now(tz=timezone.utc),
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    user = relationship("User", back_populates="notification_preferences")

    def __repr__(self) -> str:
        return f"<NotificationPreference user={self.user_id}>"
