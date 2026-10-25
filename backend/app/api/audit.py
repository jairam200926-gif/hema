"""
VaultGuard — Audit / Security Events API Router
Endpoints:
  GET /api/audit          Query security events (paginated)
  GET /api/audit/stats    Aggregate event statistics
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.audit import SecurityEvent
from app.models.user import User
from app.schemas.audit import SecurityEventResponse

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("", response_model=list[SecurityEventResponse], summary="Query security events")
def list_events(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    event_type: Optional[str] = Query(None),
    result: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(SecurityEvent)
    if current_user.role != "ADMIN":
        query = query.filter(SecurityEvent.user_id == current_user.id)
    if event_type:
        query = query.filter(SecurityEvent.event_type == event_type)
    if result:
        query = query.filter(SecurityEvent.result == result)
    events = (
        query.order_by(SecurityEvent.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return events


@router.get("/stats", summary="Aggregate security event counts")
def audit_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from sqlalchemy import func
    query = db.query(SecurityEvent.event_type, func.count().label("count"))
    if current_user.role != "ADMIN":
        query = query.filter(SecurityEvent.user_id == current_user.id)
    rows = query.group_by(SecurityEvent.event_type).all()
    return {"stats": {row.event_type: row.count for row in rows}}


@router.get("/verify-chain", summary="Cryptographically verify tamper-evident audit hash chain")
def verify_chain(
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.audit_service import verify_audit_hash_chain
    return verify_audit_hash_chain(db)

