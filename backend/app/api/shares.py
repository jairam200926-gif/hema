"""
VaultGuard — Shares API Router
Endpoints:
  GET /api/shares              List shares for current user's backups
  GET /api/shares/{id}         Get share metadata (no ciphertext exposed)
  POST /api/shares/{id}/verify Trigger share integrity verification
"""
from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.crypto.aes_gcm import decrypt_share, compute_share_aad
from app.crypto.hashing import sha256_hex, constant_time_compare
from app.models.audit import IntegrityCheck, SecurityEvent
from app.models.share import Share
from app.models.user import User
from app.schemas.share import ShareResponse

router = APIRouter(prefix="/shares", tags=["Shares"])


def _check_share_access(share: Share, user: User) -> None:
    """Ensure user has access to the share (owner or ADMIN)."""
    if user.role == "ADMIN":
        return
    if share.backup.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")


@router.get("", response_model=list[ShareResponse], summary="List shares accessible to current user")
def list_shares(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "ADMIN":
        shares = db.query(Share).all()
    else:
        from app.models.backup import Backup
        shares = (
            db.query(Share)
            .join(Backup)
            .filter(Backup.owner_id == current_user.id)
            .all()
        )
    return shares


@router.get("/{share_id}", response_model=ShareResponse, summary="Get share metadata")
def get_share(
    share_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    share = db.query(Share).filter(Share.id == share_id).first()
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share not found.")
    _check_share_access(share, current_user)
    return share


@router.post(
    "/{share_id}/verify",
    summary="Trigger AES-GCM + SHA-256 integrity verification for a share",
)
def verify_share_integrity(
    share_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    share = db.query(Share).filter(Share.id == share_id).first()
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share not found.")
    _check_share_access(share, current_user)

    result_status = "PASSED"
    failure_detail = None

    try:
        # 1. Derive canonical Associated Authenticated Data bound to this exact backup and share index
        aad = compute_share_aad(share.backup_id, share.share_index)

        # 2. AES-256-GCM authenticated decryption (detects ciphertext, nonce, tag, or AAD tampering)
        plaintext = decrypt_share(
            share.encrypted_share,
            share.nonce,
            share.auth_tag,
            aad=aad,
        )

        # 3. Verify format: must not be empty
        if not plaintext:
            result_status = "FAILED"
            failure_detail = "Decrypted share payload was unexpectedly empty."
        else:
            # 4. Recompute SHA-256 and constant-time compare against stored anchor
            calculated_hash = sha256_hex(plaintext)
            if not constant_time_compare(calculated_hash, share.share_integrity_hash):
                result_status = "FAILED"
                failure_detail = "SHA-256 integrity hash mismatch after AES-GCM decryption."
    except Exception as exc:
        result_status = "FAILED"
        failure_detail = f"Cryptographic integrity verification failed: {exc}"

    # 5. Record integrity check record
    check = IntegrityCheck(
        share_id=share.id,
        backup_id=share.backup_id,
        expected_hash=share.share_integrity_hash,
        calculated_hash=calculated_hash if result_status == "PASSED" else "N/A",
        status=result_status,
    )
    db.add(check)

    # 6. Update share status and last_verified_at
    share.status = "HEALTHY" if result_status == "PASSED" else "COMPROMISED"
    share.last_verified_at = datetime.now(tz=timezone.utc)

    # 7. Audit event
    event_type = "SHARE_INTEGRITY_VERIFIED" if result_status == "PASSED" else "SHARE_INTEGRITY_FAILURE"
    db.add(SecurityEvent(
        event_type=event_type,
        user_id=current_user.id,
        backup_id=share.backup_id,
        share_id=share.id,
        result="SUCCESS" if result_status == "PASSED" else "FAILURE",
        metadata_={"failure_detail": failure_detail},
    ))
    db.commit()

    return {
        "share_id": str(share.id),
        "status": result_status,
        "detail": failure_detail or "Integrity verified successfully.",
        "checked_at": check.checked_at.isoformat(),
    }
