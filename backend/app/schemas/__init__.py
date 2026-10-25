"""VaultGuard — Pydantic schemas package."""
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    UserResponse,
    UserMeResponse,
)
from app.schemas.backup import (
    BackupCreateRequest,
    BackupResponse,
    BackupListItem,
)
from app.schemas.share import ShareResponse
from app.schemas.recovery import (
    RecoveryInitRequest,
    RecoveryInitResponse,
    RecoverySubmitRequest,
    RecoverySubmitResponse,
)
from app.schemas.custodian import CustodianCreate, CustodianResponse
from app.schemas.audit import SecurityEventResponse, NotificationResponse

__all__ = [
    "UserRegisterRequest", "UserLoginRequest", "TokenResponse",
    "UserResponse", "UserMeResponse",
    "BackupCreateRequest", "BackupResponse", "BackupListItem",
    "ShareResponse",
    "RecoveryInitRequest", "RecoveryInitResponse",
    "RecoverySubmitRequest", "RecoverySubmitResponse",
    "CustodianCreate", "CustodianResponse",
    "SecurityEventResponse", "NotificationResponse",
]
