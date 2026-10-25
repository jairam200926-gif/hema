"""
VaultGuard — User ORM Model
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Enum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(320), unique=True, nullable=False, index=True)
    password_hash = Column(String(1024), nullable=False)   # Argon2id PHC string
    role = Column(
        Enum("ADMIN", "USER", "CUSTODIAN", name="user_role_enum"),
        nullable=False,
        default="USER",
    )
    is_active = Column(Boolean, nullable=False, default=True)
    email_verified = Column(Boolean, nullable=False, default=False)
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
    backups = relationship("Backup", back_populates="owner", cascade="all, delete-orphan")
    recovery_attempts = relationship("RecoveryAttempt", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    notification_preferences = relationship(
        "NotificationPreference", back_populates="user", uselist=False
    )
    security_events = relationship("SecurityEvent", back_populates="user")

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username!r} role={self.role}>"
