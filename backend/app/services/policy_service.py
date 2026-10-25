"""
VaultGuard — Cryptographic Recovery Policy Engine (Innovation 5)

Enforces strict defense-in-depth rules prior to secret material release:
1. Minimum Threshold Rule: len(valid_shares) >= backup.threshold
2. Request Non-Expiration Rule: now <= attempt.expires_at
3. Replay Prevention Rule: attempt.result == 'PENDING'
4. Access Authorization Rule: request_user.id == backup.owner_id or request_user.role == 'ADMIN'
5. Share Integrity Rule: 100% of submitted shares pass AES-GCM + canonical AAD authentication
6. Custodian Independence Rule: no duplicate custodians or share indexes
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from app.models.backup import Backup
from app.models.recovery import RecoveryAttempt
from app.models.user import User


@dataclass
class PolicyCheckResult:
    rule_name: str
    passed: bool
    detail: str
    critical: bool = True


@dataclass
class RecoveryPolicyEvaluation:
    is_allowed: bool
    checks: list[PolicyCheckResult] = field(default_factory=list)
    rejection_reason: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "is_allowed": self.is_allowed,
            "rejection_reason": self.rejection_reason,
            "checks": [
                {
                    "rule": c.rule_name,
                    "passed": c.passed,
                    "detail": c.detail,
                    "critical": c.critical,
                }
                for c in self.checks
            ],
        }


def evaluate_recovery_policy(
    user: User,
    backup: Backup,
    attempt: RecoveryAttempt,
    valid_shares_count: int,
    total_submitted_count: int,
    duplicate_indexes_found: bool = False,
    reauth_passed: bool = True,
) -> RecoveryPolicyEvaluation:
    """Evaluate full set of recovery policy rules."""
    checks: list[PolicyCheckResult] = []
    now = datetime.now(tz=timezone.utc)

    # 1. Authorization
    is_owner_or_admin = (backup.owner_id == user.id) or (user.role == "ADMIN")
    checks.append(PolicyCheckResult(
        rule_name="AUTHORIZATION_RULE",
        passed=is_owner_or_admin,
        detail="Requester possesses ownership or administrative recovery rights." if is_owner_or_admin else "Access denied: User is not backup owner or admin.",
    ))

    # 2. Status & Replay Prevention
    is_pending = (attempt.result == "PENDING")
    checks.append(PolicyCheckResult(
        rule_name="REPLAY_PREVENTION_RULE",
        passed=is_pending,
        detail="Recovery request is in active PENDING state." if is_pending else f"Replay detected: request status is {attempt.result}.",
    ))

    # 3. TTL Expiry
    is_not_expired = True
    if attempt.expires_at:
        is_not_expired = (now <= attempt.expires_at)
    checks.append(PolicyCheckResult(
        rule_name="TTL_EXPIRATION_RULE",
        passed=is_not_expired,
        detail="Request received within valid time-to-live window." if is_not_expired else "Request exceeded maximum session TTL.",
    ))

    # 4. Threshold Requirement
    threshold_met = (valid_shares_count >= backup.threshold)
    checks.append(PolicyCheckResult(
        rule_name="THRESHOLD_SATISFACTION_RULE",
        passed=threshold_met,
        detail=f"Threshold satisfied: {valid_shares_count} valid shares >= {backup.threshold} required." if threshold_met else f"Threshold unsatisfied: only {valid_shares_count} valid shares for requirement of {backup.threshold}.",
    ))

    # 5. Share Integrity
    integrity_met = (valid_shares_count == total_submitted_count) and (valid_shares_count > 0)
    checks.append(PolicyCheckResult(
        rule_name="SHARE_AUTHENTICITY_RULE",
        passed=integrity_met,
        detail="All submitted shares passed AES-256-GCM AEAD and SHA-256 integrity verification." if integrity_met else f"{total_submitted_count - valid_shares_count} submitted share(s) failed cryptographic verification.",
    ))

    # 6. Duplicate / Sybil Protection
    checks.append(PolicyCheckResult(
        rule_name="COORDINATE_UNIQUENESS_RULE",
        passed=not duplicate_indexes_found,
        detail="All share coordinates are distinct." if not duplicate_indexes_found else "Duplicate share coordinates detected in submission.",
    ))

    # 7. Reauthentication Confirmation
    checks.append(PolicyCheckResult(
        rule_name="OPERATOR_CONFIRMATION_RULE",
        passed=reauth_passed,
        detail="Operator reauthentication confirmed." if reauth_passed else "Operator confirmation check failed.",
    ))

    critical_failures = [c for c in checks if c.critical and not c.passed]
    is_allowed = len(critical_failures) == 0
    rejection_reason = critical_failures[0].detail if critical_failures else None

    return RecoveryPolicyEvaluation(
        is_allowed=is_allowed,
        checks=checks,
        rejection_reason=rejection_reason,
    )
