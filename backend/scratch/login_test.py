import sys, os, json, requests
sys.path.append(os.path.abspath('.'))
from app.core.config import get_settings
settings = get_settings()
base_url = f'http://127.0.0.1:{8001}/api/auth/login'
users = [
    {'email':'admin@vaultguard.local','pw':'password'},
    {'email':'admin@vaultguard.local','pw':'admin'},
    {'email':'admin@vaultguard.local','pw':'admin123'},
    {'email':'vaultadmin@example.com','pw':'password'},
    {'email':'vaultadmin@example.com','pw':'admin'},
]
for u in users:
    resp = requests.post(base_url, json={'email':u['email'],'password':u['pw']})
    print('Attempt', u['email'], u['pw'], '=>', resp.status_code, resp.text)
