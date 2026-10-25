"""
VaultGuard — Core Security Utilities
JWT encoding/decoding (HS256 only) and current-user FastAPI dependency.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db

settings = get_settings()

# ── HTTP Bearer token extractor ───────────────────────────────────────────────
bearer_scheme = HTTPBearer(auto_error=True)

# ── Allowed algorithms (explicit allowlist — rejects "none") ──────────────────
ALLOWED_ALGORITHMS = ["HS256"]


def create_access_token(
    subject: str,
    role: str,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """
    Mint a signed JWT.
    - sub  : User UUID string
    - role : ADMIN | USER | CUSTODIAN
    - jti  : Unique token ID (replay-mitigation reference)
    - exp  : UTC expiry (ACCESS_TOKEN_EXPIRE_MINUTES from now)
    - iat  : Issued-at timestamp
    """
    now = datetime.now(tz=timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: dict[str, Any] = {
        "sub": str(subject),
        "role": role,
        "jti": str(uuid.uuid4()),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Validate and decode a JWT.
    Raises HTTPException 401 on any failure (expired, wrong alg, tampered).
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=ALLOWED_ALGORITHMS,   # Explicit allowlist
            options={"require": ["sub", "exp", "iat", "jti", "role"]},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidAlgorithmError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token algorithm rejected.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token invalid: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    """
    FastAPI dependency — extracts & validates JWT, loads the user from DB.
    Raises 401 if token is invalid or user is inactive/deleted.

    NOTE: Normalizes JWT 'sub' claim to uuid.UUID before querying the
    UUID-typed column, which is required for SQLite compatibility
    (UUID(as_uuid=True) expects a uuid.UUID object, not a raw string).
    """
    from app.models.user import User  # late import to avoid circular deps

    payload = decode_access_token(credentials.credentials)
    user_id_str: str = payload.get("sub", "")

    # Normalize to uuid.UUID — reject malformed identifiers with 401
    try:
        user_uuid = uuid.UUID(user_id_str)
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject is not a valid user identifier.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_uuid, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_role(*allowed_roles: str):
    """
    FastAPI dependency factory — enforces RBAC.
    Usage: Depends(require_role("ADMIN")) or Depends(require_role("ADMIN", "USER"))
    """
    def _check(current_user=Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not permitted for this action.",
            )
        return current_user
    return _check
