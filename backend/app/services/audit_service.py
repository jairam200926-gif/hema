"""
VaultGuard — Audit Service & Tamper-Evident Hash Chain Engine

Provides cryptographically verifiable append-only audit logging:
1. Every event stores SHA-256(canonical(event_payload || previous_hash)).
2. Forms a verifiable tamper-evident hash chain from the genesis event to the head.
3. Automated verification detects inserted, deleted, reordered, or modified rows.
"""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit import SecurityEvent

GENESIS_HASH = "0" * 64


def _canonical_utc_iso(dt: datetime) -> str:
    """
    Produce a canonical UTC ISO-8601 timestamp string that is stable across
    database round-trips.

    SQLite's DateTime(timezone=True) column stores values as ISO strings but
    may strip timezone offset information on reload, returning naive datetime
    objects.  Re-attaching UTC and reformatting to a fixed format ensures the
    hash input is identical between the initial write and any subsequent
    verification read.
    """
    if dt is None:
        return ""
    # If SQLite returns a naive datetime, treat it as UTC.
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    # Canonical format: always +00:00, microseconds included
    return dt.astimezone(timezone.utc).isoformat()


def canonical_event_repr(
    previous_hash: str,
    event_id: str,
    created_at_iso: str,
    event_type: str,
    result: str,
    user_id: str | None,
    backup_id: str | None,
    share_id: str | None,
    request_id: str | None,
    metadata: dict[str, Any] | None,
) -> str:
    """Produce deterministic, sorted JSON representation of an audit event."""
    payload = {
        "backup_id": backup_id,
        "created_at": created_at_iso,
        "event_id": event_id,
        "event_type": event_type,
        "metadata": metadata or {},
        "previous_hash": previous_hash,
        "request_id": request_id,
        "result": result,
        "share_id": share_id,
        "user_id": user_id,
    }
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def compute_event_hash(
    previous_hash: str,
    event_id: str,
    created_at_iso: str,
    event_type: str,
    result: str,
    user_id: str | None = None,
    backup_id: str | None = None,
    share_id: str | None = None,
    request_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> str:
    """Compute SHA-256 digest of canonical audit event representation."""
    canonical_str = canonical_event_repr(
        previous_hash=previous_hash,
        event_id=str(event_id),
        created_at_iso=created_at_iso,
        event_type=str(event_type),
        result=str(result),
        user_id=str(user_id) if user_id else None,
        backup_id=str(backup_id) if backup_id else None,
        share_id=str(share_id) if share_id else None,
        request_id=str(request_id) if request_id else None,
        metadata=metadata,
    )
    return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()


def record_security_event(
    db: Session,
    event_type: str,
    result: str = "INFO",
    user_id: Optional[UUID] = None,
    backup_id: Optional[UUID] = None,
    share_id: Optional[UUID] = None,
    recovery_attempt_id: Optional[UUID] = None,
    request_id: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    commit: bool = True,
) -> SecurityEvent:
    """
    Append an immutable, hash-chained security event to the audit ledger.
    Ensures that even if subsequent endpoint operations raise an exception,
    the event can be committed independently.
    """
    # Find latest event in chain to get previous_hash
    last_event = (
        db.query(SecurityEvent)
        .order_by(SecurityEvent.created_at.desc(), SecurityEvent.id.desc())
        .first()
    )
    previous_hash = last_event.event_hash if (last_event and last_event.event_hash) else GENESIS_HASH

    event_id = uuid.uuid4()
    now = datetime.now(tz=timezone.utc)
    now_iso = _canonical_utc_iso(now)

    event_hash = compute_event_hash(
        previous_hash=previous_hash,
        event_id=str(event_id),
        created_at_iso=now_iso,
        event_type=event_type,
        result=result,
        user_id=str(user_id) if user_id else None,
        backup_id=str(backup_id) if backup_id else None,
        share_id=str(share_id) if share_id else None,
        request_id=request_id,
        metadata=metadata,
    )

    event = SecurityEvent(
        id=event_id,
        event_type=event_type,
        user_id=user_id,
        backup_id=backup_id,
        share_id=share_id,
        recovery_attempt_id=recovery_attempt_id,
        request_id=request_id,
        result=result,
        previous_hash=previous_hash,
        event_hash=event_hash,
        metadata_=metadata or {},
        ip_address=ip_address,
        created_at=now,
    )

    db.add(event)
    if commit:
        try:
            db.commit()
            db.refresh(event)
        except Exception:
            db.rollback()
            raise
    else:
        db.flush()

    return event


def verify_audit_hash_chain(db: Session) -> dict[str, Any]:
    """
    Traverse the entire audit trail and mathematically verify:
    1. Continuous hash chaining (event[i].previous_hash == event[i-1].event_hash).
    2. Data integrity (SHA256(canonical(event[i])) == event[i].event_hash).
    """
    events = (
        db.query(SecurityEvent)
        .order_by(SecurityEvent.created_at.asc(), SecurityEvent.id.asc())
        .all()
    )

    if not events:
        return {
            "valid": True,
            "total_events": 0,
            "verified_events": 0,
            "broken_at_index": None,
            "head_hash": GENESIS_HASH,
            "message": "Audit ledger is currently empty. Genesis anchor intact.",
        }

    expected_prev = GENESIS_HASH

    for idx, event in enumerate(events):
        # Legacy rows without hash chain
        if not event.event_hash:
            return {
                "valid": False,
                "total_events": len(events),
                "verified_events": idx,
                "broken_at_index": idx,
                "head_hash": None,
                "message": f"Event at index {idx} ({event.id}) lacks cryptographic event_hash.",
            }

        # Check chain link
        if event.previous_hash != expected_prev:
            return {
                "valid": False,
                "total_events": len(events),
                "verified_events": idx,
                "broken_at_index": idx,
                "head_hash": event.event_hash,
                "message": (
                    f"Hash chain broken at index {idx} (event ID {event.id}): "
                    f"expected previous_hash '{expected_prev}', got '{event.previous_hash}'."
                ),
            }

        # Recompute digest from canonical fields
        # Use _canonical_utc_iso to handle SQLite naive datetime round-trips
        now_iso = _canonical_utc_iso(event.created_at)
        computed_hash = compute_event_hash(
            previous_hash=event.previous_hash or GENESIS_HASH,
            event_id=str(event.id),
            created_at_iso=now_iso,
            event_type=event.event_type,
            result=event.result,
            user_id=str(event.user_id) if event.user_id else None,
            backup_id=str(event.backup_id) if event.backup_id else None,
            share_id=str(event.share_id) if event.share_id else None,
            request_id=event.request_id,
            metadata=event.metadata_,
        )

        if computed_hash != event.event_hash:
            return {
                "valid": False,
                "total_events": len(events),
                "verified_events": idx,
                "broken_at_index": idx,
                "head_hash": event.event_hash,
                "message": (
                    f"Data tampering detected at index {idx} (event ID {event.id}): "
                    f"computed hash '{computed_hash}' does not match recorded event_hash '{event.event_hash}'."
                ),
            }

        expected_prev = event.event_hash

    return {
        "valid": True,
        "total_events": len(events),
        "verified_events": len(events),
        "broken_at_index": None,
        "head_hash": expected_prev,
        "message": f"Audit ledger integrity verified across all {len(events)} events.",
    }
