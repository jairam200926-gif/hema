"""
VaultGuard — Authentication Service
Handles user registration, login, and token issuance.
"""
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token
from app.crypto.hashing import hash_password, verify_password
from app.models.audit import Notification, NotificationPreference, SecurityEvent
from app.models.user import User
from app.schemas.auth import UserRegisterRequest, UserLoginRequest, TokenResponse
from app.services.audit_service import record_security_event

settings = get_settings()


def register_user(db: Session, payload: UserRegisterRequest) -> User:
    """
    Register a new user.
    - Validates username/email uniqueness (case-insensitive).
    - Hashes the password with Argon2id.
    - Strictly assigns role='USER' (cannot self-register as ADMIN).
    - Creates default NotificationPreferences.
    - Records USER_REGISTERED security event.
    """
    # ── Uniqueness checks ──────────────────────────────────────────────────────
    if db.query(User).filter(func.lower(User.username) == payload.username.lower()).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username is already taken.",
        )
    if db.query(User).filter(func.lower(User.email) == str(payload.email).lower()).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # ── Create user (Enforce USER role for public registrations) ───────────────
    user = User(
        username=payload.username,
        email=str(payload.email),
        password_hash=hash_password(payload.password),
        role="USER",
    )
    db.add(user)
    db.flush()   # Get UUID before commit

    # ── Default notification preferences ──────────────────────────────────────
    prefs = NotificationPreference(user_id=user.id)
    db.add(prefs)

    # ── Audit event ───────────────────────────────────────────────────────────
    db.commit()
    db.refresh(user)

    record_security_event(
        db=db,
        event_type="USER_REGISTERED",
        result="SUCCESS",
        user_id=user.id,
        metadata={"username": user.username, "role": user.role},
        commit=True,
    )

    return user


def login_user(db: Session, payload: UserLoginRequest) -> TokenResponse:
    """
    Authenticate a user and return a signed JWT.
    Uses constant-time Argon2id verification to prevent timing attacks.
    Always records a security event (SUCCESS or FAILURE).
    """
    clean_identifier = payload.username.strip().lower()
    user = (
        db.query(User)
        .filter(
            (func.lower(User.username) == clean_identifier)
            | (func.lower(User.email) == clean_identifier)
        )
        .first()
    )

    # Always run verify_password even if user is None (timing attack mitigation)
    dummy_hash = "$argon2id$v=19$m=65536,t=3,p=1$dummysalt12345678901234$dummyhash1234567890123456789012345678901234"
    stored_hash = user.password_hash if user else dummy_hash
    password_ok = verify_password(payload.password, stored_hash)

    if not user or not password_ok or not user.is_active:
        # Persist security event reliably before raising HTTPException
        record_security_event(
            db=db,
            event_type="USER_LOGIN_FAILED",
            result="FAILURE",
            user_id=user.id if user else None,
            metadata={"username": payload.username, "reason": "invalid_credentials_or_inactive"},
            commit=True,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ── Issue token ────────────────────────────────────────────────────────────
    token = create_access_token(subject=str(user.id), role=user.role)

    # ── Audit success ──────────────────────────────────────────────────────────
    record_security_event(
        db=db,
        event_type="USER_LOGIN",
        result="SUCCESS",
        user_id=user.id,
        metadata={"username": user.username, "role": user.role},
        commit=True,
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
