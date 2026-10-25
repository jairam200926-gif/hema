"""
VaultGuard — Backups API

Creates protected backups using:
1. SHA-256 for secret verification
2. Shamir Secret Sharing over GF(256)
3. AES-256-GCM encryption for stored shares
4. PostgreSQL for persistent storage

The original secret is never stored.
"""

from __future__ import annotations

import hashlib
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.crypto.aes_gcm import encrypt_share, compute_share_aad
from app.crypto.hashing import compute_secret_verification_digest
from app.crypto.shamir import split_secret
from app.models.backup import Backup
from app.models.custodian import Custodian
from app.models.share import Share
from app.models.user import User
from app.schemas.backup import (
    BackupCreateRequest,
    BackupListItem,
    BackupResponse,
)
from app.services.audit_service import record_security_event

router = APIRouter(prefix="/backups", tags=["Backups"])


@router.get(
    "",
    response_model=list[BackupListItem],
    summary="List backups visible to the authenticated user",
)
def list_backups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "ADMIN":
        backups = db.query(Backup).all()
    else:
        backups = (
            db.query(Backup)
            .filter(Backup.owner_id == current_user.id)
            .all()
        )

    return backups


@router.get(
    "/{backup_id}",
    response_model=BackupResponse,
    summary="Get backup details",
)
def get_backup(
    backup_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    backup = (
        db.query(Backup)
        .filter(Backup.id == backup_id)
        .first()
    )

    if not backup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup not found.",
        )

    if (
        current_user.role != "ADMIN"
        and backup.owner_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied.",
        )

    return backup


@router.post(
    "",
    response_model=BackupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a secure Shamir backup",
)
def create_backup(
    payload: BackupCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # ---------------------------------------------------------
    # 1. Validate the threshold configuration
    # ---------------------------------------------------------

    if payload.threshold > payload.total_shares:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Threshold cannot exceed total shares.",
        )

    if len(payload.custodian_ids) != payload.total_shares:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Number of custodians must equal total shares.",
        )

    if len(set(payload.custodian_ids)) != len(payload.custodian_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate custodians are not allowed.",
        )

    # ---------------------------------------------------------
    # 2. Load and validate custodians
    # ---------------------------------------------------------

    custodians = (
        db.query(Custodian)
        .filter(Custodian.id.in_(payload.custodian_ids))
        .all()
    )

    if len(custodians) != payload.total_shares:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more custodians were not found.",
        )

    inactive_custodians = [
        custodian
        for custodian in custodians
        if custodian.status != "ACTIVE"
    ]

    if inactive_custodians:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All selected custodians must be ACTIVE.",
        )

    # ---------------------------------------------------------
    # 3. Convert the supplied secret to bytes
    # ---------------------------------------------------------

    secret_bytes = payload.secret.encode("utf-8")

    if not secret_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Secret cannot be empty.",
        )

    # ---------------------------------------------------------
    # 4. Create a protected verification digest.
    #
    # The original secret itself is NEVER stored.
    # Uses keyed HMAC-SHA256 to prevent dictionary attacks on low-entropy secrets.
    # ---------------------------------------------------------

    secret_digest, algo = compute_secret_verification_digest(secret_bytes, algorithm="SHAMIR_GF256_HMAC")

    # ---------------------------------------------------------
    # 5. Create the backup record first.
    # ---------------------------------------------------------

    backup = Backup(
        owner_id=current_user.id,
        name=payload.name,
        description=payload.description,
        threshold=payload.threshold,
        total_shares=payload.total_shares,
        algorithm=algo,
        status="ACTIVE",
        secret_verification_digest=secret_digest,
    )

    db.add(backup)
    db.flush()

    # ---------------------------------------------------------
    # 6. Split the secret using Shamir Secret Sharing.
    # ---------------------------------------------------------

    try:
        generated_shares = split_secret(
            secret=secret_bytes,
            threshold=payload.threshold,
            total_shares=payload.total_shares,
        )
    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    # ---------------------------------------------------------
    # 7. Encrypt and store every generated share.
    # ---------------------------------------------------------

    # Keep custodian order exactly aligned with share order.
    custodians_by_id = {
        custodian.id: custodian
        for custodian in custodians
    }

    for generated_share, custodian_id in zip(
        generated_shares,
        payload.custodian_ids,
    ):
        custodian = custodians_by_id[custodian_id]

        # Bind the encrypted share to this exact backup/share via canonical AAD.
        aad = compute_share_aad(backup.id, generated_share.index)

        encrypted_share, nonce, auth_tag = encrypt_share(
            generated_share.value,
            aad=aad,
        )

        integrity_hash = hashlib.sha256(
            generated_share.value
        ).hexdigest()

        share = Share(
            backup_id=backup.id,
            custodian_id=custodian.id,
            share_index=generated_share.index,
            encrypted_share=encrypted_share,
            nonce=nonce,
            auth_tag=auth_tag,
            share_integrity_hash=integrity_hash,
            status="HEALTHY",
        )

        db.add(share)

    # ---------------------------------------------------------
    # 8. Commit the complete backup ceremony.
    # ---------------------------------------------------------

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(backup)

    record_security_event(
        db=db,
        event_type="BACKUP_CREATED",
        result="SUCCESS",
        user_id=current_user.id,
        backup_id=backup.id,
        metadata={
            "name": backup.name,
            "threshold": backup.threshold,
            "total_shares": backup.total_shares,
            "algorithm": backup.algorithm,
        },
        commit=True,
    )

    return backup


@router.delete(
    "/{backup_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archive a backup",
)
def archive_backup(
    backup_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    backup = (
        db.query(Backup)
        .filter(Backup.id == backup_id)
        .first()
    )

    if not backup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup not found.",
        )

    if (
        current_user.role != "ADMIN"
        and backup.owner_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied.",
        )

    backup.status = "ARCHIVED"
    db.commit()

    record_security_event(
        db=db,
        event_type="BACKUP_ARCHIVED",
        result="SUCCESS",
        user_id=current_user.id,
        backup_id=backup.id,
        metadata={"name": backup.name},
        commit=True,
    )

    return None