import os, sys, pathlib, json, requests

# Add project root for imports if needed
sys.path.append(str(pathlib.Path('.').resolve()))

BASE = 'http://127.0.0.1:8001'
USERNAME = 'admin'
PASSWORD = 'TestPass123!'

def login():
    r = requests.post(f'{BASE}/api/auth/login', json={'username': USERNAME, 'password': PASSWORD})
    r.raise_for_status()
    return r.json()['access_token']

def init_recovery(token):
    hdr = {'Authorization': f'Bearer {token}'}
    r = requests.post(f'{BASE}/api/recovery/init', json={'backup_id': '38228abc-597f-4b09-b5de-a4cedb1a0907'}, headers=hdr)
    r.raise_for_status()
    return r.json()['request_id']

def submit(token, request_id, shares):
    hdr = {'Authorization': f'Bearer {token}'}
    payload = {'request_id': request_id, 'shares': shares}
    r = requests.post(f'{BASE}/api/recovery/submit', json=payload, headers=hdr)
    return r.status_code, r.json() if r.content else {}

# Share metadata (from inspection)
SHARES = [
    {"share_index": 1, "custodian_id": "a6fb1dcd-c725-4d9f-b2f2-caffd4c8147c"},
    {"share_index": 2, "custodian_id": "13e63826-ecb6-41ca-bc88-726937b48ad1"},
    {"share_index": 3, "custodian_id": "a891530b-9a4e-4976-9acc-8e19160e0594"},
]

if __name__ == '__main__':
    token = login()
    results = {}

    # 1. Duplicate share indexes (share 1 twice, share 3)
    req_id = init_recovery(token)
    dup_payload = [
        {"share_index": 1, "custodian_id": SHARES[0]["custodian_id"]},
        {"share_index": 1, "custodian_id": SHARES[0]["custodian_id"]},
        {"share_index": 3, "custodian_id": SHARES[2]["custodian_id"]},
    ]
    results['duplicate'] = submit(token, req_id, dup_payload)

    # 2. Wrong custodian ID for a valid share index
    req_id = init_recovery(token)
    wrong_payload = [
        {"share_index": 1, "custodian_id": "00000000-0000-0000-0000-000000000000"},
        SHARES[1],
        SHARES[2],
    ]
    results['wrong_custodian'] = submit(token, req_id, wrong_payload)

    # 3. Insufficient shares (only two valid)
    req_id = init_recovery(token)
    insufficient_payload = SHARES[:2]
    results['insufficient'] = submit(token, req_id, insufficient_payload)

    # 4. Replay protection – reuse a successful request
    # First obtain a successful request
    req_id = init_recovery(token)
    success_status, success_data = submit(token, req_id, SHARES)
    results['success'] = (success_status, success_data)
    # Replay the same request
    results['replay'] = submit(token, req_id, SHARES)

    print(json.dumps(results, indent=2))
