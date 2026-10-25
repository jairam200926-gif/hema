"""
VaultGuard — Notifications API Router
Endpoints:
  GET /api/notifications          List inbox notifications
  GET /api/notifications/preferences  Get preferences
  PUT /api/notifications/preferences  Update preferences (JSON body)
"""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.audit import Notification, NotificationPreference
from app.models.user import User
from app.schemas.audit import NotificationResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class PreferenceUpdateRequest(BaseModel):
    security_alerts: bool = True
    recovery_alerts: bool = True
    backup_notifications: bool = True
    integrity_alerts: bool = True


@router.get("", response_model=list[NotificationResponse], summary="List user notification inbox")
def list_notifications(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/preferences", summary="Get notification preferences")
def get_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prefs = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == current_user.id
    ).first()
    if not prefs:
        return {"security_alerts": True, "recovery_alerts": True,
                "backup_notifications": True, "integrity_alerts": True}
    return {
        "security_alerts": prefs.security_alerts,
        "recovery_alerts": prefs.recovery_alerts,
        "backup_notifications": prefs.backup_notifications,
        "integrity_alerts": prefs.integrity_alerts,
    }


@router.put("/preferences", summary="Update notification preferences (JSON body)")
def update_preferences(
    payload: PreferenceUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prefs = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == current_user.id
    ).first()
    if not prefs:
        prefs = NotificationPreference(user_id=current_user.id)
        db.add(prefs)
    prefs.security_alerts = payload.security_alerts
    prefs.recovery_alerts = payload.recovery_alerts
    prefs.backup_notifications = payload.backup_notifications
    prefs.integrity_alerts = payload.integrity_alerts
    db.commit()
    return {
        "updated": True,
        "security_alerts": prefs.security_alerts,
        "recovery_alerts": prefs.recovery_alerts,
        "backup_notifications": prefs.backup_notifications,
        "integrity_alerts": prefs.integrity_alerts,
    }
