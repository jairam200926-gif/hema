"""
VaultGuard — Resilience & Disaster Recovery Simulator API Router
Endpoints:
  GET  /api/resilience/fleet             Aggregated fleet resilience metrics
  GET  /api/resilience/vault/{id}        Detailed recovery readiness for a specific vault
  POST /api/simulator/evaluate           Evaluate arbitrary synthetic (k, n) catastrophe scenarios
  POST /api/simulator/run-drill          Execute a non-destructive controlled live drill
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.backup import Backup
from app.models.user import User
from app.services.resilience_service import calculate_backup_readiness, calculate_fleet_resilience
from app.services.simulator_service import evaluate_synthetic_scenario, execute_controlled_drill

router = APIRouter(tags=["Resilience & Simulation"])


class SyntheticScenarioRequest(BaseModel):
    threshold_k: int = Field(..., ge=2, le=255)
    total_shares_n: int = Field(..., ge=2, le=255)
    offline_shares: list[int] = Field(default_factory=list)
    corrupted_shares: list[int] = Field(default_factory=list)
    simulated_expired: bool = False


class LiveDrillRequest(BaseModel):
    backup_id: UUID
    shares_to_simulate_fail: list[int] = Field(default_factory=list)


@router.get("/resilience/fleet", summary="Get aggregated resilience telemetry across backups")
def get_fleet_resilience(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    is_admin = (current_user.role == "ADMIN")
    return calculate_fleet_resilience(db=db, user_id=current_user.id, is_admin=is_admin)


@router.get("/resilience/vault/{backup_id}", summary="Get detailed readiness report for a specific vault")
def get_vault_readiness(
    backup_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    backup = db.query(Backup).filter(Backup.id == backup_id).first()
    if not backup:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backup vault not found.")

    if current_user.role != "ADMIN" and backup.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    return calculate_backup_readiness(backup=backup, db=db)


@router.post("/simulator/evaluate", summary="Evaluate synthetic disaster recovery scenario")
def evaluate_disaster_scenario(
    payload: SyntheticScenarioRequest,
    _current_user: User = Depends(get_current_user),
):
    try:
        return evaluate_synthetic_scenario(
            threshold_k=payload.threshold_k,
            total_shares_n=payload.total_shares_n,
            offline_shares=payload.offline_shares,
            corrupted_shares=payload.corrupted_shares,
            simulated_expired=payload.simulated_expired,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/simulator/run-drill", summary="Run a non-destructive controlled live drill on a vault")
def run_live_drill(
    payload: LiveDrillRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    backup = db.query(Backup).filter(Backup.id == payload.backup_id).first()
    if not backup:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backup vault not found.")

    if current_user.role != "ADMIN" and backup.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    try:
        return execute_controlled_drill(
            backup_id=payload.backup_id,
            db=db,
            shares_to_simulate_fail=payload.shares_to_simulate_fail,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
