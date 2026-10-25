"""
Cryptographic Tests: AES-256-GCM AEAD & Canonical AAD Verification

Verifies:
1. Valid share encrypt/decrypt round trips.
2. Canonical AAD generator format and normalization.
3. Cryptographic failure on incorrect AAD (the exact bug fixed).
4. Cryptographic failure on tampered ciphertext, nonce, or tag.
5. Protection against cross-backup share confusion.
6. Protection against share-index coordinate swapping.
7. Safe error handling without leaking cryptographic internals.
"""
import base64
import secrets
import uuid
import pytest
from cryptography.exceptions import InvalidTag

from app.crypto.aes_gcm import (
    compute_share_aad,
    decrypt_share,
    encrypt_share,
    generate_nonce,
    NONCE_SIZE_BYTES,
    TAG_SIZE_BYTES,
)


def test_canonical_aad_generation():
    """Ensure compute_share_aad produces deterministic, lowercase-normalized byte output."""
    backup_uuid = uuid.UUID("38228abc-597f-4b09-b5de-a4cedb1a0907")
    aad1 = compute_share_aad(backup_uuid, 1)
    aad2 = compute_share_aad(str(backup_uuid).upper(), 1)
    
    expected = b"vaultguard:v1:backup:38228abc-597f-4b09-b5de-a4cedb1a0907:share:1"
    assert aad1 == expected
    assert aad2 == expected
    assert isinstance(aad1, bytes)


def test_canonical_aad_rejects_none():
    with pytest.raises(ValueError):
        compute_share_aad(None, 1)


def test_aes_gcm_round_trip():
    """Verify clean encrypt and decrypt round trip with canonical AAD."""
    plaintext = b"test_shamir_share_payload_bytes_coordinate_42"
    backup_id = uuid.uuid4()
    share_index = 2
    aad = compute_share_aad(backup_id, share_index)

    ct, nonce, tag = encrypt_share(plaintext, aad=aad)

    assert isinstance(ct, str)
    assert isinstance(nonce, str)
    assert isinstance(tag, str)

    decrypted = decrypt_share(ct, nonce, tag, aad=aad)
    assert decrypted == plaintext


def test_regression_missing_aad_fails():
    """
    REGRESSION TEST: The previous share verification bug decrypted shares
    without reproducing the AAD passed during encryption.
    Verify that decrypting without AAD raises InvalidTag.
    """
    plaintext = b"vulnerable_share_data"
    backup_id = uuid.uuid4()
    aad = compute_share_aad(backup_id, 1)

    ct, nonce, tag = encrypt_share(plaintext, aad=aad)

    # Attempt decryption with no AAD (the original defect)
    with pytest.raises(InvalidTag):
        decrypt_share(ct, nonce, tag, aad=None)


def test_mismatched_backup_id_in_aad_fails():
    """Verify that a share from Backup A cannot be accepted for Backup B (cross-vault confusion)."""
    plaintext = b"share_belonging_to_vault_alpha"
    vault_alpha = uuid.uuid4()
    vault_beta = uuid.uuid4()

    aad_alpha = compute_share_aad(vault_alpha, 1)
    aad_beta = compute_share_aad(vault_beta, 1)

    ct, nonce, tag = encrypt_share(plaintext, aad=aad_alpha)

    with pytest.raises(InvalidTag):
        decrypt_share(ct, nonce, tag, aad=aad_beta)


def test_mismatched_share_index_in_aad_fails():
    """Verify that Share #1 cannot masquerade as Share #2 (coordinate swapping)."""
    plaintext = b"share_1_coordinate"
    vault_id = uuid.uuid4()

    aad_share_1 = compute_share_aad(vault_id, 1)
    aad_share_2 = compute_share_aad(vault_id, 2)

    ct, nonce, tag = encrypt_share(plaintext, aad=aad_share_1)

    with pytest.raises(InvalidTag):
        decrypt_share(ct, nonce, tag, aad=aad_share_2)


def test_tampered_ciphertext_fails():
    """Verify that flipping a single bit in the ciphertext causes InvalidTag."""
    plaintext = b"unaltered_share_material"
    aad = compute_share_aad(uuid.uuid4(), 1)
    ct, nonce, tag = encrypt_share(plaintext, aad=aad)

    ct_bytes = bytearray(base64.b64decode(ct))
    ct_bytes[0] ^= 0x01  # Flip one bit
    tampered_ct = base64.b64encode(ct_bytes).decode("ascii")

    with pytest.raises(InvalidTag):
        decrypt_share(tampered_ct, nonce, tag, aad=aad)


def test_tampered_auth_tag_fails():
    """Verify that modifying the authentication tag causes InvalidTag."""
    plaintext = b"unaltered_share_material"
    aad = compute_share_aad(uuid.uuid4(), 1)
    ct, nonce, tag = encrypt_share(plaintext, aad=aad)

    tag_bytes = bytearray(base64.b64decode(tag))
    tag_bytes[-1] ^= 0x80  # Flip high bit
    tampered_tag = base64.b64encode(tag_bytes).decode("ascii")

    with pytest.raises(InvalidTag):
        decrypt_share(ct, nonce, tampered_tag, aad=aad)


def test_tampered_nonce_fails():
    """Verify that a modified nonce causes authentication failure."""
    plaintext = b"unaltered_share_material"
    aad = compute_share_aad(uuid.uuid4(), 1)
    ct, nonce, tag = encrypt_share(plaintext, aad=aad)

    nonce_bytes = bytearray(base64.b64decode(nonce))
    nonce_bytes[0] ^= 0xFF
    tampered_nonce = base64.b64encode(nonce_bytes).decode("ascii")

    with pytest.raises(InvalidTag):
        decrypt_share(ct, tampered_nonce, tag, aad=aad)


def test_invalid_nonce_length_fails():
    plaintext = b"test_payload"
    aad = compute_share_aad(uuid.uuid4(), 1)
    ct, _, tag = encrypt_share(plaintext, aad=aad)

    short_nonce = base64.b64encode(b"short").decode("ascii")
    with pytest.raises(ValueError, match="Invalid nonce length"):
        decrypt_share(ct, short_nonce, tag, aad=aad)


def test_invalid_tag_length_fails():
    plaintext = b"test_payload"
    aad = compute_share_aad(uuid.uuid4(), 1)
    ct, nonce, _ = encrypt_share(plaintext, aad=aad)

    short_tag = base64.b64encode(b"short_tag").decode("ascii")
    with pytest.raises(ValueError, match="Invalid authentication tag length"):
        decrypt_share(ct, nonce, short_tag, aad=aad)


def test_wrong_encryption_key_fails():
    """Verify that decryption with a different 32-byte key raises InvalidTag."""
    key1 = secrets.token_bytes(32)
    key2 = secrets.token_bytes(32)
    plaintext = b"classified_share"
    aad = compute_share_aad(uuid.uuid4(), 1)

    ct, nonce, tag = encrypt_share(plaintext, aad=aad, key=key1)

    with pytest.raises(InvalidTag):
        decrypt_share(ct, nonce, tag, aad=aad, key=key2)
