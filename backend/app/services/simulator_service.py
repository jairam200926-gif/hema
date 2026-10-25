"""
VaultGuard — Disaster Recovery Simulator & Live Drill Engine (Innovation 2)

Allows operators to simulate share losses, custodian outages, bit-flip corruption,
and threshold variations. Operates strictly in an isolated sandbox or on designated
test backups with zero risk of mutating production data.
"""
from __future__ import annotations

import hashlib
import time
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.crypto.shamir import split_secret, reconstruct_secret, ShamirShare
from app.crypto.aes_gcm import encrypt_share, decrypt_share, compute_share_aad
from app.models.backup import Backup
from app.models.share import Share


def evaluate_synthetic_scenario(
    threshold_k: int,
    total_shares_n: int,
    offline_shares: list[int],
    corrupted_shares: list[int],
    simulated_expired: bool = False,
) -> dict[str, Any]:
    """
    Evaluate arbitrary hypothetical (k, n) catastrophe scenarios purely mathematically.
    Operates in memory with synthetic shares to show operators threshold resilience.
    """
    if threshold_k < 2 or total_shares_n < threshold_k or total_shares_n > 255:
        raise ValueError("Invalid parameters: threshold must satisfy 2 <= k <= n <= 255.")

    offline_set = set(offline_shares)
    corrupted_set = set(corrupted_shares)
    all_shares = set(range(1, total_shares_n + 1))

    # Calculate surviving healthy shares
    healthy_set = all_shares - offline_set - corrupted_set
    healthy_count = len(healthy_set)
    loss_tolerance = healthy_count - threshold_k
    can_recover = (healthy_count >= threshold_k) and not simulated_expired

    # Perform actual synthetic Shamir test to verify mathematical property
    synthetic_secret = b"VAULTGUARD_SYNTHETIC_SIMULATED_TEST_SECRET_2026"
    test_shares = split_secret(synthetic_secret, threshold=threshold_k, total_shares=total_shares_n)
    
    # Select available healthy shares up to threshold if recoverable
    test_reconstruction_passed = False
    reconstructed_match = False
    
    if healthy_count >= threshold_k and not simulated_expired:
        available_subset = [s for s in test_shares if s.index in healthy_set][:threshold_k]
        try:
            rec = reconstruct_secret(available_subset)
            test_reconstruction_passed = (rec == synthetic_secret)
            reconstructed_match = test_reconstruction_passed
        except Exception:
            test_reconstruction_passed = False

    explanation_points = []
    if simulated_expired:
        explanation_points.append("Session is marked EXPIRED (TTL elapsed). Recovery rejected.")
    if len(offline_set) > 0:
        explanation_points.append(f"{len(offline_set)} shares unreachable due to custodian outages: {sorted(list(offline_set))}.")
    if len(corrupted_set) > 0:
        explanation_points.append(f"{len(corrupted_set)} shares rejected due to AEAD tag failure: {sorted(list(corrupted_set))}.")
    
    if can_recover:
        explanation_points.append(
            f"Recovery SUCCESSFUL: {healthy_count} healthy shares exceed threshold {threshold_k}. "
            f"Margin allows losing up to {max(0, loss_tolerance)} more shares."
        )
    else:
        missing_needed = threshold_k - healthy_count
        explanation_points.append(
            f"Recovery IMPOSSIBLE: Only {healthy_count} healthy shares remain; requires at least {missing_needed} more valid share(s)."
        )

    return {
        "mode": "SYNTHETIC_SANDBOX",
        "threshold_k": threshold_k,
        "total_shares_n": total_shares_n,
        "simulated_offline": sorted(list(offline_set)),
        "simulated_corrupted": sorted(list(corrupted_set)),
        "healthy_shares_count": healthy_count,
        "healthy_share_indexes": sorted(list(healthy_set)),
        "loss_tolerance": loss_tolerance,
        "can_recover": can_recover,
        "simulated_expired": simulated_expired,
        "cryptographic_verification_passed": test_reconstruction_passed,
        "explanation": " ".join(explanation_points),
    }


def execute_controlled_drill(
    backup_id: UUID,
    db: Session,
    shares_to_simulate_fail: list[int],
) -> dict[str, Any]:
    """
    Execute a non-destructive live drill against an existing backup.
    Verifies actual AES-GCM decryptions and Lagrange interpolation without
    mutating database rows or storing recovered plaintext.
    """
    backup = db.query(Backup).filter(Backup.id == backup_id).first()
    if not backup:
        raise ValueError("Backup not found.")

    shares = db.query(Share).filter(Share.backup_id == backup.id).all()
    failed_indexes = set(shares_to_simulate_fail)

    start_time = time.perf_counter()
    tested_shares = []
    decrypted_valid_shares = []

    for s in shares:
        if s.share_index in failed_indexes:
            tested_shares.append({
                "share_index": s.share_index,
                "status": "SIMULATED_FAILURE",
                "reason": "Simulated hardware custodian outage",
            })
            continue

        # Real AES-GCM decryption with canonical AAD
        aad = compute_share_aad(backup.id, s.share_index)
        try:
            pt = decrypt_share(s.encrypted_share, s.nonce, s.auth_tag, aad=aad)
            calc_hash = hashlib.sha256(pt).hexdigest()
            if calc_hash == s.share_integrity_hash:
                decrypted_valid_shares.append(ShamirShare(index=s.share_index, value=pt))
                tested_shares.append({
                    "share_index": s.share_index,
                    "status": "VERIFIED_HEALTHY",
                    "reason": "AES-256-GCM authenticated & SHA-256 matched",
                })
            else:
                tested_shares.append({
                    "share_index": s.share_index,
                    "status": "INTEGRITY_MISMATCH",
                    "reason": "Decrypted share hash mismatched stored anchor",
                })
        except Exception as exc:
            tested_shares.append({
                "share_index": s.share_index,
                "status": "AUTH_FAILED",
                "reason": f"AEAD tag verification failed: {exc}",
            })

    # Test reconstruction if threshold met
    can_reconstruct = len(decrypted_valid_shares) >= backup.threshold
    reconstruction_verified = False

    if can_reconstruct:
        try:
            subset = decrypted_valid_shares[:backup.threshold]
            recovered_bytes = reconstruct_secret(subset)
            from app.crypto.hashing import verify_secret_digest
            reconstruction_verified = verify_secret_digest(
                recovered_bytes,
                backup.secret_verification_digest,
                backup.algorithm,
            )
            # Immediate zeroization of test secret buffer
            if isinstance(recovered_bytes, bytearray):
                for i in range(len(recovered_bytes)):
                    recovered_bytes[i] = 0
        except Exception:
            reconstruction_verified = False

    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return {
        "drill_type": "CONTROLLED_LIVE_VAULT_DRILL",
        "backup_id": str(backup.id),
        "backup_name": backup.name,
        "threshold_k": backup.threshold,
        "total_shares_n": backup.total_shares,
        "tested_shares": tested_shares,
        "valid_shares_count": len(decrypted_valid_shares),
        "threshold_satisfied": can_reconstruct,
        "cryptographic_reconstruction_verified": reconstruction_verified,
        "drill_outcome": "PASSED" if reconstruction_verified else "FAILED",
        "duration_ms": duration_ms,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
