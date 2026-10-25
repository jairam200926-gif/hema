"""
Regression Tests: Resilience Service & Fleet Telemetry API

Verifies:
1. GET /api/resilience/fleet returns 200 without undefined variable error.
2. Fleet aggregation accurately computes total_shares, healthy_shares, and compromised_shares.
3. calculate_fleet_resilience service function contract and calculations.
"""
import uuid
import pytest
from app.models.backup import Backup
from app.models.share import Share
from app.services.resilience_service import calculate_fleet_resilience


def test_get_fleet_resilience_api(client, user_auth_headers, test_custodians, db_session):
    # Create a backup
    payload = {
        "name": "Fleet Resilience Test Vault",
        "description": "Testing fleet metrics",
        "secret": "SECRET_FOR_FLEET_RESILIENCE_TEST",
        "threshold": 2,
        "total_shares": 3,
        "custodian_ids": [str(c.id) for c in test_custodians[:3]],
    }
    create_resp = client.post("/api/backups", json=payload, headers=user_auth_headers)
    assert create_resp.status_code == 201, create_resp.text
    backup_id = create_resp.json()["id"]

    # Verify one share so it becomes HEALTHY, leave one UNVERIFIED, mark one COMPROMISED
    shares = db_session.query(Share).filter(Share.backup_id == uuid.UUID(backup_id)).all()
    assert len(shares) == 3

    # Share 0: Verify via API to make it HEALTHY
    client.post(f"/api/shares/{shares[0].id}/verify", headers=user_auth_headers)

    # Share 2: Mark COMPROMISED directly
    shares[2].status = "COMPROMISED"
    db_session.commit()

    # Call GET /api/resilience/fleet
    resp = client.get("/api/resilience/fleet", headers=user_auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["total_backups"] == 1
    assert data["total_shares"] == 3
    assert data["healthy_shares"] == 2
    assert data["compromised_shares"] == 1
    assert "system_health_percentage" in data
    assert "vaults" in data
    assert len(data["vaults"]) == 1


def test_calculate_fleet_resilience_empty(db_session, test_user):
    result = calculate_fleet_resilience(db=db_session, user_id=test_user.id, is_admin=False)
    assert result["total_backups"] == 0
    assert result["total_shares"] == 0
    assert result["healthy_shares"] == 0
    assert result["compromised_shares"] == 0
    assert result["system_health_percentage"] == 100.0
    assert result["vaults"] == []
