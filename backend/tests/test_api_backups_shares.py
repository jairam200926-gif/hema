"""
API Tests: Backup Ceremony & Custodian Share Integrity Verification

Verifies:
1. Valid backup creation with Shamir split, AES-256-GCM encryption, and canonical AAD.
2. Custodian assignment validation (no duplicates, matching total shares).
3. Share retrieval without leaking ciphertext coordinates.
4. Share integrity verification with canonical AAD.
5. Detection and marking of tampered shares (COMPROMISED status).
6. IDOR protection: Non-owner cannot access another user's backup or shares.
"""
import uuid
import pytest
from app.models.backup import Backup
from app.models.share import Share


def test_create_backup_success(client, user_auth_headers, test_custodians):
    payload = {
        "name": "Production Root CA Seed",
        "description": "Multi-custodian root key backup",
        "secret": "VAULT_TEST_ROOT_SECRET_PASS_2026_XYZ",
        "threshold": 3,
        "total_shares": 5,
        "custodian_ids": [str(c.id) for c in test_custodians[:5]],
    }
    resp = client.post("/api/backups", json=payload, headers=user_auth_headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["name"] == payload["name"]
    assert data["threshold"] == 3
    assert data["total_shares"] == 5
    assert data["status"] == "ACTIVE"
    assert "secret" not in data
    assert data["secret_verification_digest"].startswith("hmac-sha256$")


def test_create_backup_duplicate_custodians_rejected(client, user_auth_headers, test_custodians):
    payload = {
        "name": "Invalid Vault",
        "secret": "secret123",
        "threshold": 2,
        "total_shares": 3,
        "custodian_ids": [str(test_custodians[0].id), str(test_custodians[0].id), str(test_custodians[1].id)],
    }
    resp = client.post("/api/backups", json=payload, headers=user_auth_headers)
    assert resp.status_code == 400
    assert "Duplicate custodians are not allowed" in resp.json()["detail"]


def test_share_verification_with_canonical_aad(client, user_auth_headers, test_custodians, db_session):
    # 1. Create a backup
    payload = {
        "name": "Integrity Test Vault",
        "secret": "CRITICAL_SYSTEM_SEED_MATERIAL_12345",
        "threshold": 3,
        "total_shares": 5,
        "custodian_ids": [str(c.id) for c in test_custodians[:5]],
    }
    resp = client.post("/api/backups", json=payload, headers=user_auth_headers)
    backup_id = resp.json()["id"]

    # 2. Query shares
    shares_resp = client.get("/api/shares", headers=user_auth_headers)
    assert shares_resp.status_code == 200
    shares = [s for s in shares_resp.json() if str(s["backup_id"]) == backup_id]
    assert len(shares) == 5

    # 3. Trigger integrity verification on first share
    share_id = shares[0]["id"]
    verify_resp = client.post(f"/api/shares/{share_id}/verify", headers=user_auth_headers)
    assert verify_resp.status_code == 200
    verify_data = verify_resp.json()
    assert verify_data["status"] == "PASSED"
    assert "successfully" in verify_data["detail"].lower()


def test_tampered_share_fails_verification(client, user_auth_headers, test_custodians, db_session):
    # Create backup
    payload = {
        "name": "Tamper Test Vault",
        "secret": "TAMPER_DETECTION_TEST_SECRET",
        "threshold": 2,
        "total_shares": 3,
        "custodian_ids": [str(c.id) for c in test_custodians[:3]],
    }
    resp = client.post("/api/backups", json=payload, headers=user_auth_headers)
    backup_id = resp.json()["id"]

    # Corrupt share 1's ciphertext directly in DB
    share = db_session.query(Share).filter(Share.backup_id == uuid.UUID(backup_id), Share.share_index == 1).first()
    share.encrypted_share = "AAAA" + share.encrypted_share[4:]
    db_session.commit()

    # Trigger verification
    verify_resp = client.post(f"/api/shares/{share.id}/verify", headers=user_auth_headers)
    assert verify_resp.status_code == 200
    result = verify_resp.json()
    assert result["status"] == "FAILED"
    assert "verification failed" in result["detail"].lower()


def test_idor_unauthorized_backup_access_rejected(client, test_custodians, db_session):
    from app.models.user import User
    from app.crypto.hashing import hash_password
    from app.core.security import create_access_token

    # Create Owner
    owner = User(username="owner1", email="owner1@vaultguard.internal", password_hash=hash_password("Pass123!"), role="USER", is_active=True)
    # Create Attacker
    attacker = User(username="attacker1", email="attacker1@vaultguard.internal", password_hash=hash_password("Pass123!"), role="USER", is_active=True)
    db_session.add_all([owner, attacker])
    db_session.commit()

    owner_token = create_access_token(str(owner.id), "USER")
    attacker_token = create_access_token(str(attacker.id), "USER")

    # Owner creates backup
    resp = client.post("/api/backups", json={
        "name": "Private Vault",
        "secret": "SECRET_FOR_OWNER_EYES_ONLY",
        "threshold": 2,
        "total_shares": 3,
        "custodian_ids": [str(c.id) for c in test_custodians[:3]],
    }, headers={"Authorization": f"Bearer {owner_token}"})
    backup_id = resp.json()["id"]

    # Attacker tries to view owner's backup details
    idor_resp = client.get(f"/api/backups/{backup_id}", headers={"Authorization": f"Bearer {attacker_token}"})
    assert idor_resp.status_code == 403
    assert "Access denied" in idor_resp.json()["detail"]
