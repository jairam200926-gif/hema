"""
VaultGuard — Recovery API

Handles the complete cryptographic threshold recovery ceremony:
1. Request initialization with unique non-reusable token and TTL expiry.
2. Custodian share verification using canonical AAD and AES-256-GCM.
3. Anti-replay, anti-Sybil, and duplicate share prevention.
4. Lagrange interpolation reconstruction over GF(256).
5. Protected secret verification digest validation (supports keyed HMAC and legacy SHA-256).
6. Tamper-evident audit logging for all outcomes.
7. Temporary secret material zeroization.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from cryptography.exceptions import InvalidTag
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.crypto.aes_gcm import decrypt_share, compute_share_aad
from app.crypto.hashing import verify_secret_digest, verify_password
from app.crypto.shamir import ShamirShare, reconstruct_secret
from app.models.backup import Backup
from app.models.recovery import RecoveryAttempt
from app.models.share import Share
from app.models.user import User
from app.schemas.recovery import (
    RecoveryInitRequest,
    RecoveryInitResponse,
    RecoverySubmitRequest,
    RecoverySubmitResponse,
)
from app.services.audit_service import record_security_event

settings = get_settings()

router = APIRouter(
    prefix="/recovery",
    tags=["Recovery"],
)


@router.get(
    "/attempts",
    summary="List recovery attempts for authenticated user",
)
def list_recovery_attempts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "ADMIN":
        attempts = db.query(RecoveryAttempt).order_by(RecoveryAttempt.created_at.desc()).all()
    else:
        attempts = (
            db.query(RecoveryAttempt)
            .filter(RecoveryAttempt.user_id == current_user.id)
            .order_by(RecoveryAttempt.created_at.desc())
            .all()
        )
    return [
        {
            "id": str(att.id),
            "backup_id": str(att.backup_id),
            "user_id": str(att.user_id),
            "request_id": att.request_id,
            "shares_requested": att.shares_requested,
            "valid_shares": att.valid_shares,
            "threshold_required": att.threshold_required,
            "result": att.result,
            "failure_reason": att.failure_reason,
            "created_at": att.created_at.isoformat() if att.created_at else None,
            "expires_at": att.expires_at.isoformat() if att.expires_at else None,
            "completed_at": att.completed_at.isoformat() if att.completed_at else None,
        }
        for att in attempts
    ]


@router.post(
    "/init",
    response_model=RecoveryInitResponse,
    summary="Initialize a time-limited recovery ceremony",
)
def initialize_recovery(
    payload: RecoveryInitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    backup = (
        db.query(Backup)
        .filter(Backup.id == payload.backup_id)
        .first()
    )

    if not backup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup not found.",
        )

    # Authorization: Owner or ADMIN
    if backup.owner_id != current_user.id and getattr(current_user, "role", None) != "ADMIN":
        record_security_event(
            db=db,
            event_type="UNAUTHORIZED_ATTEMPT",
            result="FAILURE",
            user_id=current_user.id,
            backup_id=backup.id,
            metadata={"action": "recovery_init_denied", "reason": "not_owner"},
            commit=True,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to recover this backup.",
        )

    if backup.status == "ARCHIVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archived backups cannot be recovered.",
        )

    request_id = secrets.token_urlsafe(32)
    now = datetime.now(tz=timezone.utc)
    expires_at = now + timedelta(minutes=settings.RECOVERY_REQUEST_TTL_MINUTES)

    attempt = RecoveryAttempt(
        backup_id=backup.id,
        user_id=current_user.id,
        request_id=request_id,
        shares_requested=backup.total_shares,
        valid_shares=0,
        threshold_required=backup.threshold,
        result="PENDING",
        created_at=now,
        expires_at=expires_at,
    )

    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    # Audit event
    record_security_event(
        db=db,
        event_type="RECOVERY_INITIATED",
        result="SUCCESS",
        user_id=current_user.id,
        backup_id=backup.id,
        recovery_attempt_id=attempt.id,
        request_id=request_id,
        metadata={
            "threshold": backup.threshold,
            "total_shares": backup.total_shares,
            "expires_at": expires_at.isoformat(),
        },
        commit=True,
    )

    return RecoveryInitResponse(
        request_id=request_id,
        backup_id=backup.id,
        threshold=backup.threshold,
        total_shares=backup.total_shares,
        expires_at=expires_at.isoformat(),
        message=f"Recovery initialized. {backup.threshold} valid shares are required before expiry.",
    )


@router.post(
    "/submit",
    response_model=RecoverySubmitResponse,
    summary="Submit custodian shares and reconstruct verified secret",
)
def submit_recovery_shares(
    payload: RecoverySubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Lock the recovery attempt row
    attempt = (
        db.query(RecoveryAttempt)
        .filter(RecoveryAttempt.request_id == payload.request_id)
        .with_for_update()
        .first()
    )

    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recovery request not found.",
        )

    now = datetime.now(tz=timezone.utc)

    # Anti-Replay: Prevent reuse of completed or failed recovery requests
    if attempt.result != "PENDING":
        record_security_event(
            db=db,
            event_type="REPLAY_ATTEMPT",
            result="FAILURE",
            user_id=current_user.id,
            backup_id=attempt.backup_id,
            recovery_attempt_id=attempt.id,
            request_id=payload.request_id,
            metadata={"status": attempt.result, "attempted_reuse": True},
            commit=True,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Recovery request cannot be reused. Current status: {attempt.result}",
        )

    # TTL Expiry check
    # SQLite may return naive datetimes — normalize to UTC-aware before comparison.
    expires_at = attempt.expires_at
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at and now > expires_at:
        attempt.result = "EXPIRED"
        attempt.failure_reason = "Recovery request has expired. Please initiate a new recovery session."
        attempt.completed_at = now
        db.commit()

        record_security_event(
            db=db,
            event_type="RECOVERY_FAILED",
            result="FAILURE",
            user_id=current_user.id,
            backup_id=attempt.backup_id,
            recovery_attempt_id=attempt.id,
            request_id=payload.request_id,
            metadata={"reason": "request_ttl_expired"},
            commit=True,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recovery request has expired. Please initiate a new recovery session.",
        )

    # Authorization Check
    if attempt.user_id != current_user.id and getattr(current_user, "role", None) != "ADMIN":
        record_security_event(
            db=db,
            event_type="UNAUTHORIZED_ATTEMPT",
            result="FAILURE",
            user_id=current_user.id,
            backup_id=attempt.backup_id,
            recovery_attempt_id=attempt.id,
            request_id=payload.request_id,
            metadata={"reason": "initiator_mismatch"},
            commit=True,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this recovery request.",
        )

    # Optional Reauthentication verification
    if payload.confirmation_password:
        if not verify_password(payload.confirmation_password, current_user.password_hash):
            record_security_event(
                db=db,
                event_type="RECOVERY_FAILED",
                result="FAILURE",
                user_id=current_user.id,
                backup_id=attempt.backup_id,
                recovery_attempt_id=attempt.id,
                request_id=payload.request_id,
                metadata={"reason": "invalid_reauthentication_password"},
                commit=True,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Reauthentication confirmation password failed.",
            )

    backup = (
        db.query(Backup)
        .filter(Backup.id == attempt.backup_id)
        .first()
    )

    if not backup:
        attempt.result = "FAILED"
        attempt.failure_reason = "Backup not found."
        attempt.completed_at = now
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup not found.",
        )

    submitted_indexes = set()
    valid_shares: list[ShamirShare] = []
    duplicate_detected = False

    # Process each submitted share
    for submitted in payload.shares:
        if submitted.share_index in submitted_indexes:
            duplicate_detected = True
            continue

        submitted_indexes.add(submitted.share_index)

        stored_share = (
            db.query(Share)
            .filter(
                Share.backup_id == backup.id,
                Share.custodian_id == submitted.custodian_id,
                Share.share_index == submitted.share_index,
            )
            .first()
        )

        if not stored_share:
            continue

        # Derive canonical Associated Authenticated Data
        aad = compute_share_aad(backup.id, stored_share.share_index)

        # Authenticated AES-256-GCM Decryption
        try:
            plaintext_share = decrypt_share(
                stored_share.encrypted_share,
                stored_share.nonce,
                stored_share.auth_tag,
                aad=aad,
            )
        except (InvalidTag, ValueError, TypeError):
            continue

        # Verify pre-encryption SHA-256 integrity anchor
        calculated_hash = hashlib.sha256(plaintext_share).hexdigest()
        if calculated_hash != stored_share.share_integrity_hash:
            continue

        valid_shares.append(
            ShamirShare(
                index=stored_share.share_index,
                value=plaintext_share,
            )
        )

    if duplicate_detected:
        record_security_event(
            db=db,
            event_type="DUPLICATE_SHARE",
            result="WARNING",
            user_id=current_user.id,
            backup_id=backup.id,
            recovery_attempt_id=attempt.id,
            request_id=payload.request_id,
            metadata={"message": "Duplicate share indexes detected in submission and rejected."},
            commit=True,
        )

    attempt.valid_shares = len(valid_shares)

    # Threshold Check
    if len(valid_shares) < backup.threshold:
        attempt.result = "FAILED"
        attempt.failure_reason = (
            f"Insufficient valid shares: {len(valid_shares)} provided, "
            f"{backup.threshold} required."
        )
        attempt.completed_at = now
        db.commit()

        record_security_event(
            db=db,
            event_type="INVALID_THRESHOLD",
            result="FAILURE",
            user_id=current_user.id,
            backup_id=backup.id,
            recovery_attempt_id=attempt.id,
            request_id=payload.request_id,
            metadata={
                "provided_shares": len(valid_shares),
                "threshold_required": backup.threshold,
            },
            commit=True,
        )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient shares. {backup.threshold} valid shares are required.",
        )

    # Reconstruct Secret using Lagrange Interpolation over GF(256)
    try:
        recovered_secret_bytes = reconstruct_secret(valid_shares)
    except (ValueError, TypeError) as exc:
        attempt.result = "FAILED"
        attempt.failure_reason = f"Shamir secret reconstruction failed: {exc}"
        attempt.completed_at = now
        db.commit()

        record_security_event(
            db=db,
            event_type="RECOVERY_FAILED",
            result="FAILURE",
            user_id=current_user.id,
            backup_id=backup.id,
            recovery_attempt_id=attempt.id,
            request_id=payload.request_id,
            metadata={"reason": "lagrange_interpolation_error", "detail": str(exc)},
            commit=True,
        )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Secret reconstruction failed.",
        )

    # Reconstructed Secret Verification against Protected Digest
    verification_passed = verify_secret_digest(
        recovered_secret=recovered_secret_bytes,
        stored_digest=backup.secret_verification_digest,
        algorithm=backup.algorithm,
    )

    if not verification_passed:
        attempt.result = "FAILED"
        attempt.failure_reason = "Recovered secret failed cryptographic verification."
        attempt.completed_at = now
        db.commit()

        record_security_event(
            db=db,
            event_type="RECOVERY_FAILED",
            result="FAILURE",
            user_id=current_user.id,
            backup_id=backup.id,
            recovery_attempt_id=attempt.id,
            request_id=payload.request_id,
            metadata={"reason": "digest_verification_failed"},
            commit=True,
        )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recovered secret failed cryptographic verification.",
        )

    # Success
    backup.status = "RECOVERED"
    attempt.result = "SUCCESS"
    attempt.failure_reason = None
    attempt.completed_at = now
    db.commit()

    record_security_event(
        db=db,
        event_type="RECOVERY_SUCCESS",
        result="SUCCESS",
        user_id=current_user.id,
        backup_id=backup.id,
        recovery_attempt_id=attempt.id,
        request_id=payload.request_id,
        metadata={
            "valid_shares_used": len(valid_shares),
            "threshold_required": backup.threshold,
            "verification_status": "VERIFIED",
        },
        commit=True,
    )

    # Parse string representation
    try:
        recovered_secret_str = recovered_secret_bytes.decode("utf-8")
    except UnicodeDecodeError:
        recovered_secret_str = recovered_secret_bytes.hex()

    # Zeroize temporary secret byte buffers in memory where practical
    if isinstance(recovered_secret_bytes, bytearray):
        for i in range(len(recovered_secret_bytes)):
            recovered_secret_bytes[i] = 0

    return RecoverySubmitResponse(
        request_id=payload.request_id,
        result="SUCCESS",
        valid_shares=len(valid_shares),
        threshold_required=backup.threshold,
        recovered_secret=recovered_secret_str,
        verification_digest=backup.secret_verification_digest,
        message="Secret recovered and cryptographically verified.",
    )