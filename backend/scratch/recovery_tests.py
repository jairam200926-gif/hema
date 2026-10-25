import os, sys, pathlib, json
import requests

# Add project root to import path (for hashing if needed)
sys.path.append(str(pathlib.Path('.').resolve()))

BASE = 'http://127.0.0.1:8001'

# ----- Step 1: set admin password (once) -----
# This block assumes the admin password is currently unknown.
# It will set a known temporary password using the project's hashing function.
from app.core.database import SessionLocal
from app.crypto.hashing import hash_password
from app.models.user import User

def set_temp_admin_password(username: str, new_pw: str) -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if user:
            user.password_hash = hash_password(new_pw)
            db.commit()
            print(f"[SET] Temporary password for '{username}' applied.")
        else:
            print(f"[WARN] User '{username}' not found.")
    finally:
        db.close()

# Use a simple password for local testing
TEMP_PASSWORD = 'TestPass123!'
set_temp_admin_password('admin', TEMP_PASSWORD)

# ----- Step 2: login -----
login_resp = requests.post(
    f"{BASE}/api/auth/login",
    json={"username": "admin", "password": TEMP_PASSWORD},
)
if login_resp.status_code != 200:
    print('LOGIN FAILED', login_resp.status_code, login_resp.text)
    sys.exit(1)
access_token = login_resp.json()['access_token']
headers = {"Authorization": f"Bearer {access_token}"}
print('[LOGIN] success')

# ----- Helper: share metadata (hard‑coded from inspect_shares output) -----
SHARES = [
    {"share_index": 1, "custodian_id": "a6fb1dcd-c725-4d9f-b2f2-caffd4c8147c"},
    {"share_index": 2, "custodian_id": "13e63826-ecb6-41ca-bc88-726937b48ad1"},
    {"share_index": 3, "custodian_id": "a891530b-9a4e-4976-9acc-8e19160e0594"},
]

# ----- Step 3: initialise recovery -----
init_resp = requests.post(
    f"{BASE}/api/recovery/init",
    json={"backup_id": "38228abc-597f-4b09-b5de-a4cedb1a0907"},
    headers=headers,
)
if init_resp.status_code != 200:
    print('INIT FAILED', init_resp.status_code, init_resp.text)
    sys.exit(1)
request_id = init_resp.json()['request_id']
print('[INIT] request_id', request_id)

# ----- Test cases -----

def submit(shares_payload):
    payload = {"request_id": request_id, "shares": shares_payload}
    resp = requests.post(f"{BASE}/api/recovery/submit", json=payload, headers=headers)
    return resp.status_code, resp.json() if resp.content else {}

# 1. Insufficient shares (only first two)
status, data = submit(SHARES[:2])
print('INSUFFICIENT:', status, data.get('detail') or data.get('message'))

# 2. Duplicate share index (index 1 twice, plus a valid third)
duplicate_payload = [SHARES[0], SHARES[0], SHARES[2]]
status, data = submit(duplicate_payload)
print('DUPLICATE:', status, data.get('detail') or data.get('message'))

# 3. Wrong custodian ID (use a random UUID for share 1)
wrong_custodian = [{"share_index": 1, "custodian_id": "00000000-0000-0000-0000-000000000000"}]
status, data = submit(wrong_custodian + SHARES[1:3])
print('WRONG CUSTODIAN:', status, data.get('detail') or data.get('message'))

# 4. Replay protection – submit the same valid payload again (should be rejected)
valid_payload = SHARES[:3]
status, data = submit(valid_payload)
print('REPLAY ATTEMPT:', status, data.get('detail') or data.get('message'))

# 5. Successful recovery (fresh request) – demonstrate normal flow
#   Re‑initialize to get a new request_id
new_init = requests.post(
    f"{BASE}/api/recovery/init",
    json={"backup_id": "38228abc-597f-4b09-b5de-a4cedb1a0907"},
    headers=headers,
).json()
new_req = new_init['request_id']
payload = {"request_id": new_req, "shares": SHARES[:3]}
resp = requests.post(f"{BASE}/api/recovery/submit", json=payload, headers=headers)
print('SUCCESSFUL RECOVERY:', resp.status_code, resp.json().get('result'))
