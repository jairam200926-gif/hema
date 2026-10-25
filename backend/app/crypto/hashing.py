"""
VaultGuard — Password Hashing (Argon2id, RFC 9106) & SHA-256 Digest Utilities
"""
import hashlib
import hmac

from argon2 import PasswordHasher, Type
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

from app.core.config import get_settings

settings = get_settings()

# ── Argon2id hasher (RFC 9106 parameters) ─────────────────────────────────────
_hasher = PasswordHasher(
    time_cost=settings.ARGON2_TIME_COST,
    memory_cost=settings.ARGON2_MEMORY_COST_KIB,
    parallelism=settings.ARGON2_PARALLELISM,
    hash_len=settings.ARGON2_HASH_LENGTH,
    type=Type.ID,   # Argon2id — combines Argon2d + Argon2i
)


def hash_password(password: str) -> str:
    """
    Returns the Argon2id PHC-encoded hash string for storage.
    The hash includes the salt; no separate salt column is needed.
    """
    return _hasher.hash(password)


def verify_password(plain_password: str, stored_hash: str) -> bool:
    """
    Constant-time comparison of a plaintext password against its stored Argon2id hash.
    Returns True on match; False otherwise (never raises to callers).
    """
    try:
        return _hasher.verify(stored_hash, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(stored_hash: str) -> bool:
    """Returns True if the stored hash uses outdated Argon2id parameters."""
    return _hasher.check_needs_rehash(stored_hash)


# ── SHA-256 Digest ─────────────────────────────────────────────────────────────

def sha256_hex(data: bytes | str) -> str:
    """
    Returns the hex-encoded SHA-256 digest of the input.
    Accepts bytes or str (UTF-8 encoded).
    Used for:
    - Secret verification digest (stored in 'backups.secret_verification_digest')
    - Share integrity hash (stored in 'shares.share_integrity_hash')
    """
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def constant_time_compare(a: str, b: str) -> bool:
    """
    Timing-attack-resistant string comparison via hmac.compare_digest.
    Used for share integrity hash verification.
    """
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


# ── Keyed Secret Verification Engine ──────────────────────────────────────────

def compute_secret_verification_digest(
    secret: bytes | str,
    algorithm: str = "SHAMIR_GF256_HMAC",
    salt: bytes | None = None,
) -> tuple[str, str]:
    """
    Compute a protected verification digest of the secret to enable reconstruction
    verification without persisting plaintext.
    
    Hardening:
    - For algorithm='SHAMIR_GF256_HMAC': Uses HMAC-SHA256 keyed with a master-key-derived
      salt binding to prevent offline dictionary attacks on low-entropy secrets.
      Format: 'hmac-sha256$<salt_hex>$<hmac_hex>'
    - For algorithm='SHAMIR_GF256' (legacy): SHA-256 hex digest.
    
    Returns:
        (digest_string, algorithm_name)
    """
    import secrets
    secret_bytes = secret.encode("utf-8") if isinstance(secret, str) else secret

    if algorithm == "SHAMIR_GF256":
        return hashlib.sha256(secret_bytes).hexdigest(), "SHAMIR_GF256"

    # Default to hardened keyed HMAC-SHA256
    salt_bytes = salt or secrets.token_bytes(16)
    # Derive verification key using master key and salt
    derived_vkey = hmac.new(settings.AES_MASTER_KEY, salt_bytes, hashlib.sha256).digest()
    digest_hex = hmac.new(derived_vkey, secret_bytes, hashlib.sha256).hexdigest()
    encoded = f"hmac-sha256${salt_bytes.hex()}${digest_hex}"
    return encoded, "SHAMIR_GF256_HMAC"


def verify_secret_digest(
    recovered_secret: bytes | str,
    stored_digest: str,
    algorithm: str = "SHAMIR_GF256",
) -> bool:
    """
    Verify recovered secret bytes against stored verification digest.
    Supports both hardened HMAC-SHA256 format and legacy plain SHA-256 digests.
    """
    secret_bytes = recovered_secret.encode("utf-8") if isinstance(recovered_secret, str) else recovered_secret

    if stored_digest.startswith("hmac-sha256$"):
        parts = stored_digest.split("$")
        if len(parts) == 3:
            try:
                salt_bytes = bytes.fromhex(parts[1])
                expected_hmac = parts[2]
                derived_vkey = hmac.new(settings.AES_MASTER_KEY, salt_bytes, hashlib.sha256).digest()
                computed_hmac = hmac.new(derived_vkey, secret_bytes, hashlib.sha256).hexdigest()
                return constant_time_compare(computed_hmac, expected_hmac)
            except Exception:
                return False

    # Legacy plain SHA-256 fallback
    computed_sha256 = hashlib.sha256(secret_bytes).hexdigest()
    return constant_time_compare(computed_sha256, stored_digest)

