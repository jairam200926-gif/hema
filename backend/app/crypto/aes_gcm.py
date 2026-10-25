"""
VaultGuard — AES-256-GCM Authenticated Encryption
Uses cryptography library's hazmat AEAD primitives with canonical AAD binding.
"""
from __future__ import annotations

import base64
import binascii
import secrets
from typing import Union
from uuid import UUID

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import get_settings

settings = get_settings()

# Nonce size: 96 bits (12 bytes) per NIST SP 800-38D recommendation
NONCE_SIZE_BYTES = 12
# GCM tag size: 128 bits (16 bytes)
TAG_SIZE_BYTES = 16


def compute_share_aad(backup_id: Union[UUID, str], share_index: int) -> bytes:
    """
    Establish ONE canonical Associated Authenticated Data (AAD) generation function.
    Binds the AES-256-GCM ciphertext to the specific backup UUID and share index.
    
    This cryptographic binding prevents:
    1. Cross-backup share confusion (using a share from Backup A to fulfill Backup B).
    2. Share coordinate swapping (swapping Share 1 with Share 2 from the same backup).
    3. Tampering with share indexing metadata without triggering authentication failure.
    """
    if backup_id is None:
        raise ValueError("backup_id cannot be None for canonical AAD generation.")
    normalized_backup_id = str(backup_id).strip().lower()
    return f"vaultguard:v1:backup:{normalized_backup_id}:share:{int(share_index)}".encode("utf-8")


def generate_nonce() -> bytes:
    """Generate a cryptographically random 96-bit nonce. Never reuse under same key."""
    return secrets.token_bytes(NONCE_SIZE_BYTES)


def encrypt_share(
    plaintext: bytes,
    aad: bytes | None = None,
    key: bytes | None = None,
) -> tuple[str, str, str]:
    """
    Encrypt share material with AES-256-GCM.

    Args:
        plaintext: The raw share bytes to encrypt.
        aad:       Associated Authenticated Data (canonical byte binding).
        key:       Optional 32-byte key override (defaults to settings.AES_MASTER_KEY).

    Returns:
        (ciphertext_b64, nonce_b64, tag_b64)
    """
    if not isinstance(plaintext, (bytes, bytearray)):
        raise TypeError("plaintext must be bytes or bytearray.")
    if len(plaintext) == 0:
        raise ValueError("plaintext must not be empty.")

    active_key = key if key is not None else settings.AES_MASTER_KEY
    if len(active_key) != 32:
        raise ValueError("AES-256-GCM requires exactly a 32-byte key.")

    nonce = generate_nonce()
    aesgcm = AESGCM(active_key)

    ciphertext_with_tag = aesgcm.encrypt(nonce, bytes(plaintext), aad)

    ciphertext = ciphertext_with_tag[:-TAG_SIZE_BYTES]
    tag = ciphertext_with_tag[-TAG_SIZE_BYTES:]

    return (
        base64.b64encode(ciphertext).decode("ascii"),
        base64.b64encode(nonce).decode("ascii"),
        base64.b64encode(tag).decode("ascii"),
    )


def decrypt_share(
    ciphertext_b64: str,
    nonce_b64: str,
    tag_b64: str,
    aad: bytes | None = None,
    key: bytes | None = None,
) -> bytes:
    """
    Decrypt and authenticate a share.

    Args:
        ciphertext_b64: Base64-encoded ciphertext.
        nonce_b64:      Base64-encoded 96-bit nonce.
        tag_b64:        Base64-encoded 128-bit authentication tag.
        aad:            Canonical Associated Authenticated Data used during encryption.
        key:            Optional 32-byte key override.

    Raises:
        InvalidTag: If ciphertext, tag, nonce, or AAD was tampered with.
        ValueError: If base64 decoding fails or dimensions are invalid.
    """
    active_key = key if key is not None else settings.AES_MASTER_KEY
    if len(active_key) != 32:
        raise ValueError("AES-256-GCM requires exactly a 32-byte key.")

    try:
        ciphertext = base64.b64decode(ciphertext_b64, validate=True)
        nonce = base64.b64decode(nonce_b64, validate=True)
        tag = base64.b64decode(tag_b64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError(f"Malformed base64 cryptographic payload: {exc}") from exc

    if len(nonce) != NONCE_SIZE_BYTES:
        raise ValueError(f"Invalid nonce length: expected {NONCE_SIZE_BYTES} bytes, got {len(nonce)}.")
    if len(tag) != TAG_SIZE_BYTES:
        raise ValueError(f"Invalid authentication tag length: expected {TAG_SIZE_BYTES} bytes, got {len(tag)}.")

    aesgcm = AESGCM(active_key)
    ciphertext_with_tag = ciphertext + tag

    # AESGCM.decrypt raises cryptography.exceptions.InvalidTag on tamper or wrong AAD
    return aesgcm.decrypt(nonce, ciphertext_with_tag, aad)

