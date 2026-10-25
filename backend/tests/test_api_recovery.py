"""
API Tests: Cryptographic Threshold Recovery Ceremony

Verifies:
1. End-to-end recovery workflow with subset of valid shares.
2. Independent recovery using distinct valid subsets.
3. Sub-threshold submission denial (fewer than k shares).
4. Replay attack rejection on completed requests.
5. Coordinate duplication (Sybil) rejection.
6. Expired recovery request rejection.
7. Unauthorized cross-user recovery rejection.
"""
from datetime import datetime, timedelta, timezone
import uuid
import pytest
from app.models.recovery import RecoveryAttempt
from app.models.share import Share


@pytest.fixture
def test_vault(client, user_auth_headers, test_custodians, db_session):
    secret_text = "AUTHENTIC_ENTERPRISE_ROOT_SEED_VALUE_992211"
    resp = client.post(
        "/api/backups",
        json={
            "name": "Recovery Ceremony Target Vault",
            "secret": secret_text,
            "threshold": 3,
            "total_shares": 5,
            "custodian_ids": [str(c.id) for c in test_custodians[:5]],
        },
        headers=user_auth_headers,
    )
    assert resp.status_code == 201
    backup_data = resp.json()
    backup_id = uuid.UUID(backup_data["id"])

    shares = db_session.query(Share).filter(Share.backup_id == backup_id).order_by(Share.share_index.asc()).all()
    return {
        "backup_id": backup_id,
        "secret": secret_text,
        "threshold": 3,
        "shares": shares,
    }


def test_successful_recovery_first_subset(client, user_auth_headers, test_vault):
    backup_id = test_vault["backup_id"]
    shares = test_vault["shares"]

    # 1. Initialize recovery
    init_resp = client.post("/api/recovery/init", json={"backup_id": str(backup_id)}, headers=user_auth_headers)
    assert init_resp.status_code == 200
    request_id = init_resp.json()["request_id"]

    # 2. Submit shares 1, 2, 3
    payload = {
        "request_id": request_id,
        "shares": [
            {"custodian_id": str(s.custodian_id), "share_index": s.share_index}
            for s in shares[:3]
        ],
        "confirm_release": True,
    }
    submit_resp = client.post("/api/recovery/submit", json=payload, headers=user_auth_headers)
    assert submit_resp.status_code == 200
    data = submit_resp.json()
    assert data["result"] == "SUCCESS"
    assert data["recovered_secret"] == test_vault["secret"]
    assert data["valid_shares"] == 3


def test_successful_recovery_different_subset(client, user_auth_headers, test_vault):
    """Verify that a completely different valid subset (e.g. shares 2, 4, 5) recovers the secret."""
    backup_id = test_vault["backup_id"]
    shares = test_vault["shares"]

    # Initialize fresh recovery session
    init_resp = client.post("/api/recovery/init", json={"backup_id": str(backup_id)}, headers=user_auth_headers)
    request_id = init_resp.json()["request_id"]

    # Submit shares 2, 4, 5
    selected = [shares[1], shares[3], shares[4]]
    payload = {
        "request_id": request_id,
        "shares": [
            {"custodian_id": str(s.custodian_id), "share_index": s.share_index}
            for s in selected
        ],
    }
    submit_resp = client.post("/api/recovery/submit", json=payload, headers=user_auth_headers)
    assert submit_resp.status_code == 200
    assert submit_resp.json()["recovered_secret"] == test_vault["secret"]


def test_sub_threshold_rejection(client, user_auth_headers, test_vault):
    backup_id = test_vault["backup_id"]
    shares = test_vault["shares"]

    init_resp = client.post("/api/recovery/init", json={"backup_id": str(backup_id)}, headers=user_auth_headers)
    request_id = init_resp.json()["request_id"]

    # Submit only 2 shares for 3-of-5 scheme
    payload = {
        "request_id": request_id,
        "shares": [
            {"custodian_id": str(s.custodian_id), "share_index": s.share_index}
            for s in shares[:2]
        ],
    }
    resp = client.post("/api/recovery/submit", json=payload, headers=user_auth_headers)
    assert resp.status_code == 400
    assert "Insufficient shares" in resp.json()["detail"]


def test_replay_attack_rejected(client, user_auth_headers, test_vault):
    backup_id = test_vault["backup_id"]
    shares = test_vault["shares"]

    init_resp = client.post("/api/recovery/init", json={"backup_id": str(backup_id)}, headers=user_auth_headers)
    request_id = init_resp.json()["request_id"]

    payload = {
        "request_id": request_id,
        "shares": [
            {"custodian_id": str(s.custodian_id), "share_index": s.share_index}
            for s in shares[:3]
        ],
    }
    # First submit succeeds
    first_resp = client.post("/api/recovery/submit", json=payload, headers=user_auth_headers)
    assert first_resp.status_code == 200

    # Second submit (replay) must be rejected
    replay_resp = client.post("/api/recovery/submit", json=payload, headers=user_auth_headers)
    assert replay_resp.status_code == 400
    assert "cannot be reused" in replay_resp.json()["detail"]


def test_duplicate_share_rejected(client, user_auth_headers, test_vault):
    backup_id = test_vault["backup_id"]
    shares = test_vault["shares"]

    init_resp = client.post("/api/recovery/init", json={"backup_id": str(backup_id)}, headers=user_auth_headers)
    request_id = init_resp.json()["request_id"]

    # Submit Share #1 twice + Share #2
    payload = {
        "request_id": request_id,
        "shares": [
            {"custodian_id": str(shares[0].custodian_id), "share_index": 1},
            {"custodian_id": str(shares[0].custodian_id), "share_index": 1},
            {"custodian_id": str(shares[1].custodian_id), "share_index": 2},
        ],
    }
    resp = client.post("/api/recovery/submit", json=payload, headers=user_auth_headers)
    assert resp.status_code == 400
    assert "Insufficient shares" in resp.json()["detail"]


def test_expired_request_rejected(client, user_auth_headers, test_vault, db_session):
    backup_id = test_vault["backup_id"]
    shares = test_vault["shares"]

    init_resp = client.post("/api/recovery/init", json={"backup_id": str(backup_id)}, headers=user_auth_headers)
    request_id = init_resp.json()["request_id"]

    # Artificially expire the attempt in DB
    attempt = db_session.query(RecoveryAttempt).filter(RecoveryAttempt.request_id == request_id).first()
    attempt.expires_at = datetime.now(tz=timezone.utc) - timedelta(minutes=1)
    db_session.commit()

    payload = {
        "request_id": request_id,
        "shares": [
            {"custodian_id": str(s.custodian_id), "share_index": s.share_index}
            for s in shares[:3]
        ],
    }
    resp = client.post("/api/recovery/submit", json=payload, headers=user_auth_headers)
    assert resp.status_code == 400
    assert "expired" in resp.json()["detail"].lower()


def test_cross_user_unauthorized_recovery_rejected(client, test_vault, db_session):
    from app.models.user import User
    from app.crypto.hashing import hash_password
    from app.core.security import create_access_token

    attacker = User(username="attacker_rec", email="att_rec@vaultguard.internal", password_hash=hash_password("Pass123!"), role="USER", is_active=True)
    db_session.add(attacker)
    db_session.commit()
    attacker_token = create_access_token(str(attacker.id), "USER")

    # Attacker tries to initialize recovery of victim's vault
    resp = client.post(
        "/api/recovery/init",
        json={"backup_id": str(test_vault["backup_id"])},
        headers={"Authorization": f"Bearer {attacker_token}"},
    )
    assert resp.status_code == 403
    assert "permission" in resp.json()["detail"].lower()
