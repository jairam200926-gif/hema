"""
VaultGuard — SQLAlchemy ORM Models package.
Importing this package registers all model subclasses with Base.metadata.
"""
from app.models.user import User
from app.models.custodian import Custodian
from app.models.backup import Backup
from app.models.share import Share
from app.models.recovery import RecoveryAttempt
from app.models.audit import SecurityEvent, IntegrityCheck, Notification, NotificationPreference

__all__ = [
    "User",
    "Custodian",
    "Backup",
    "Share",
    "RecoveryAttempt",
    "SecurityEvent",
    "IntegrityCheck",
    "Notification",
    "NotificationPreference",
]
