"""
VaultGuard — Custodians API Router
Endpoints:
  GET    /api/custodians          List all custodians
  POST   /api/custodians          Create a custodian (ADMIN only)
  GET    /api/custodians/{id}     Get custodian details
  DELETE /api/custodians/{id}     Revoke a custodian (ADMIN only)
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.custodian import Custodian
from app.schemas.custodian import CustodianCreate, CustodianResponse

router = APIRouter(prefix="/custodians", tags=["Custodians"])


@router.get("", response_model=list[CustodianResponse], summary="List all custodians")
def list_custodians(
    _current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Custodian).all()


@router.post(
    "",
    response_model=CustodianResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a custodian (ADMIN only)",
)
def create_custodian(
    payload: CustodianCreate,
    admin=Depends(require_role("ADMIN")),
    db: Session = Depends(get_db),
):
    from app.services.audit_service import record_security_event
    custodian = Custodian(**payload.model_dump())
    db.add(custodian)
    db.commit()
    db.refresh(custodian)

    record_security_event(
        db=db,
        event_type="CUSTODIAN_CREATED",
        result="SUCCESS",
        user_id=admin.id,
        metadata={"custodian_id": str(custodian.id), "name": custodian.name, "type": custodian.type},
        commit=True,
    )
    return custodian


@router.get("/{custodian_id}", response_model=CustodianResponse, summary="Get custodian by ID")
def get_custodian(
    custodian_id: UUID,
    _current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = db.query(Custodian).filter(Custodian.id == custodian_id).first()
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custodian not found.")
    return c


@router.delete(
    "/{custodian_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke a custodian (ADMIN only)",
)
def revoke_custodian(
    custodian_id: UUID,
    admin=Depends(require_role("ADMIN")),
    db: Session = Depends(get_db),
):
    from app.services.audit_service import record_security_event
    c = db.query(Custodian).filter(Custodian.id == custodian_id).first()
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custodian not found.")
    c.status = "REVOKED"
    db.commit()

    record_security_event(
        db=db,
        event_type="CUSTODIAN_REVOKED",
        result="SUCCESS",
        user_id=admin.id,
        metadata={"custodian_id": str(c.id), "name": c.name},
        commit=True,
    )
    return None
