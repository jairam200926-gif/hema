import sys
sys.path.insert(0, '.')

from app.core.config import get_settings
from app.core.security import create_access_token, decode_access_token
from app.crypto.hashing import hash_password, verify_password, sha256_hex
from app.crypto.aes_gcm import encrypt_share, decrypt_share
from app.models.user import User
from app.models.backup import Backup
from app.models.share import Share
from app.models.recovery import RecoveryAttempt
from app.models.audit import SecurityEvent

print("All imports OK")
s = get_settings()
print(f"Settings: JWT_ALG={s.JWT_ALGORITHM}, ARGON2 m={s.ARGON2_MEMORY_COST_KIB}KiB")

pw = "TestPass1!"
h = hash_password(pw)
print(f"Argon2id hash prefix: {h[:20]}...")
print(f"Verify correct: {verify_password(pw, h)}")
print(f"Verify wrong:   {verify_password('wrongpass', h)}")

digest = sha256_hex(b"hello world")
print(f"SHA-256: {digest}")

ct, nonce, tag = encrypt_share(b"share_data_test")
print(f"AES-256-GCM encrypt OK, nonce_len={len(nonce)}")
pt = decrypt_share(ct, nonce, tag)
print(f"AES-256-GCM decrypt OK: {pt}")

tok = create_access_token("test-uuid", "USER")
pl = decode_access_token(tok)
print(f"JWT round-trip OK: sub={pl['sub']}, role={pl['role']}")

print("\nALL CHECKS PASSED")
