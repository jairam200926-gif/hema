"""
VaultGuard — Authentication API Router
Endpoints:
  POST /api/auth/register
  POST /api/auth/login
  GET  /api/auth/me
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    UserMeResponse,
)
from app.services.auth_service import register_user, login_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserMeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
    description=(
        "Creates a new user with Argon2id-hashed password. "
        "Returns the created user profile (no password field)."
    ),
)
def register(payload: UserRegisterRequest, db: Session = Depends(get_db)):
    user = register_user(db=db, payload=payload)
    return user


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and receive a JWT",
    description=(
        "Validates credentials using constant-time Argon2id verification. "
        "Returns a signed HS256 JWT valid for 30 minutes."
    ),
)
def login(payload: UserLoginRequest, db: Session = Depends(get_db)):
    return login_user(db=db, payload=payload)


@router.get(
    "/me",
    response_model=UserMeResponse,
    summary="Get the authenticated user's profile",
)
def me(current_user=Depends(get_current_user)):
    return current_user
