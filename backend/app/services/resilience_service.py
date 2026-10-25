"""
VaultGuard — Recovery Readiness and Resilience Engine (Innovation 1 & 3)

Computes server-verified recovery readiness, loss tolerance, and custodian
diversity metrics from transactional database state.
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.backup import Backup
from app.models.share import Share
from app.models.recovery import RecoveryAttempt


def calculate_backup_readiness(backup: Backup, db: Session) -> dict[str, Any]:
    """
    Calculate real mathematical recovery readiness and resilience for a given backup.
    
    Formulae:
        Total Shares: n
        Threshold Required: k
        Healthy Shares: n_healthy
        Compromised / Missing: n_compromised
        Loss Tolerance: T_loss = n_healthy - k
        Readiness Score: max(0, min(100, (n_healthy / k) * 100)) if k > 0 else 0
    """
    shares = db.query(Share).filter(Share.backup_id == backup.id).all()
    n_total = backup.total_shares
    k_threshold = backup.threshold

    healthy_count = sum(1 for s in shares if s.status == "HEALTHY")
    unverified_count = sum(1 for s in shares if s.status == "UNVERIFIED")
    compromised_count = sum(1 for s in shares if s.status == "COMPROMISED")
    missing_count = sum(1 for s in shares if s.status == "MISSING")
    
    # Available = Healthy + Unverified (not yet verified but present)
    available_count = healthy_count + unverified_count

    # Loss tolerance: how many more shares can fail before recovery becomes impossible
    loss_tolerance = healthy_count - k_threshold

    # Unique custodians assigned
    custodian_ids = {s.custodian_id for s in shares if s.custodian_id is not None}
    custodian_diversity_score = (len(custodian_ids) / n_total * 100.0) if n_total > 0 else 0.0

    # Determine status
    if backup.status == "ARCHIVED":
        resilience_status = "ARCHIVED"
        status_label = "Archived"
        can_recover = False
    elif healthy_count >= k_threshold and loss_tolerance >= 1:
        resilience_status = "OPTIMAL"
        status_label = "Optimal Resilience"
        can_recover = True
    elif healthy_count >= k_threshold and loss_tolerance == 0:
        resilience_status = "DEGRADED"
        status_label = "Zero-Margin Tolerance (At Risk)"
        can_recover = True
    elif available_count >= k_threshold:
        resilience_status = "UNVERIFIED_MARGIN"
        status_label = "Unverified Shares Present"
        can_recover = True
    else:
        resilience_status = "UNRECOVERABLE"
        status_label = "Unrecoverable (Below Threshold)"
        can_recover = False

    readiness_percentage = round(min(100.0, (healthy_count / k_threshold) * 100.0), 1) if k_threshold > 0 else 0.0

    # Recent recovery requests
    active_requests = (
        db.query(RecoveryAttempt)
        .filter(RecoveryAttempt.backup_id == backup.id, RecoveryAttempt.result == "PENDING")
        .count()
    )

    return {
        "backup_id": str(backup.id),
        "backup_name": backup.name,
        "threshold_k": k_threshold,
        "total_shares_n": n_total,
        "healthy_shares": healthy_count,
        "unverified_shares": unverified_count,
        "compromised_shares": compromised_count,
        "missing_shares": missing_count,
        "available_shares": available_count,
        "loss_tolerance": loss_tolerance,
        "can_recover": can_recover,
        "readiness_percentage": readiness_percentage,
        "resilience_status": resilience_status,
        "status_label": status_label,
        "custodian_count": len(custodian_ids),
        "custodian_diversity_score": round(custodian_diversity_score, 1),
        "active_recovery_requests": active_requests,
        "explanation": (
            f"Requires {k_threshold} of {n_total} shares. Currently {healthy_count} verified healthy shares "
            f"are available. Remaining failure tolerance: {max(0, loss_tolerance)} share losses before recovery fails."
            if can_recover
            else f"CRITICAL: Only {healthy_count} verified shares available. Threshold {k_threshold} cannot be satisfied."
        ),
    }


def calculate_fleet_resilience(db: Session, user_id: UUID | None = None, is_admin: bool = False) -> dict[str, Any]:
    """Calculate aggregated resilience telemetry across user's vaults."""
    query = db.query(Backup)
    if not is_admin and user_id is not None:
        query = query.filter(Backup.owner_id == user_id)
    
    backups = query.all()
    reports = [calculate_backup_readiness(b, db) for b in backups]

    total_backups = len(reports)
    recoverable_count = sum(1 for r in reports if r["can_recover"])
    optimal_count = sum(1 for r in reports if r["resilience_status"] == "OPTIMAL")
    degraded_count = sum(1 for r in reports if r["resilience_status"] in ("DEGRADED", "UNVERIFIED_MARGIN"))
    unrecoverable_count = sum(1 for r in reports if not r["can_recover"])

    total_shares = sum(r["total_shares_n"] for r in reports)
    healthy_shares = sum(r["healthy_shares"] for r in reports)
    compromised_shares = sum(r["compromised_shares"] for r in reports)

    system_health_pct = round((healthy_shares / total_shares * 100.0), 1) if total_shares > 0 else 100.0

    return {
        "total_backups": total_backups,
        "recoverable_backups": recoverable_count,
        "optimal_backups": optimal_count,
        "degraded_backups": degraded_count,
        "unrecoverable_backups": unrecoverable_count,
        "total_shares": total_shares,
        "healthy_shares": healthy_shares,
        "compromised_shares": compromised_shares,
        "system_health_percentage": system_health_pct,
        "vaults": reports,
    }
