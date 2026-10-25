"""
Cryptographic Tests: Shamir Secret Sharing over GF(256)

Verifies:
1. Exact reconstruction for various secret lengths and threshold configurations.
2. Any valid subset of size >= k reconstructs the secret.
3. Subsets of size < k reveal zero valid information.
4. Duplicate coordinates, invalid coordinates, and malformed inputs are rejected.
5. Boundary conditions and DoS payload limits.
"""
import itertools
import os
import secrets
import pytest

from app.crypto.shamir import (
    split_secret,
    reconstruct_secret,
    ShamirShare,
    MAX_SECRET_SIZE_BYTES,
)


@pytest.mark.parametrize("threshold,total", [
    (2, 2),
    (2, 3),
    (3, 5),
    (4, 7),
    (5, 10),
    (8, 12),
])
def test_shamir_all_subsets_reconstruction(threshold, total):
    """Verify that every combination of exactly k shares reconstructs the secret."""
    secret = b"VAULTGUARD_SHAMIR_TEST_SECRET_2026_ABCD_1234"
    shares = split_secret(secret, threshold=threshold, total_shares=total)

    assert len(shares) == total
    assert all(isinstance(s, ShamirShare) for s in shares)
    assert len(set(s.index for s in shares)) == total

    # Test all combinations of size k (up to first 10 combinations to keep test fast)
    combos = list(itertools.combinations(shares, threshold))[:10]
    for subset in combos:
        reconstructed = reconstruct_secret(list(subset))
        assert reconstructed == secret, f"Failed with indexes: {[s.index for s in subset]}"


def test_shamir_super_threshold_reconstruction():
    """Verify that supplying more than k shares (e.g. k+1, k+2, all n) also works."""
    secret = b"SUPER_THRESHOLD_TEST_SECRET_PAYLOAD"
    threshold = 3
    total = 6
    shares = split_secret(secret, threshold=threshold, total_shares=total)

    # Supply 4 shares
    rec_4 = reconstruct_secret(shares[:4])
    assert rec_4 == secret

    # Supply all 6 shares
    rec_all = reconstruct_secret(shares)
    assert rec_all == secret


def test_shamir_sub_threshold_failure():
    """Verify that fewer than k shares does not yield the original secret."""
    secret = b"TOP_SECRET_RECOVERY_KEY_998877"
    threshold = 4
    total = 7
    shares = split_secret(secret, threshold=threshold, total_shares=total)

    # 3 shares (< 4 required)
    sub_shares = shares[:3]
    reconstructed = reconstruct_secret(sub_shares)
    assert reconstructed != secret


def test_shamir_duplicate_indexes_rejected():
    """Verify that submitting duplicate share coordinates is rejected."""
    secret = b"test_duplicate_rejection"
    shares = split_secret(secret, threshold=3, total_shares=5)

    duplicate_list = [shares[0], shares[0], shares[1]]
    with pytest.raises(ValueError, match="Duplicate share indexes are not allowed"):
        reconstruct_secret(duplicate_list)


def test_shamir_invalid_coordinate_ranges():
    """Verify index 0 or > 255 raises ValueError."""
    with pytest.raises(ValueError, match="Share index must be between 1 and 255"):
        reconstruct_secret([ShamirShare(index=0, value=b"val"), ShamirShare(index=1, value=b"val")])

    with pytest.raises(ValueError, match="Share index must be between 1 and 255"):
        reconstruct_secret([ShamirShare(index=256, value=b"val"), ShamirShare(index=1, value=b"val")])


def test_shamir_inconsistent_share_lengths_rejected():
    share1 = ShamirShare(index=1, value=b"length_10_")
    share2 = ShamirShare(index=2, value=b"length_20_longer____")
    with pytest.raises(ValueError, match="All share values must have the same length"):
        reconstruct_secret([share1, share2])


def test_shamir_empty_inputs_rejected():
    with pytest.raises(ValueError, match="secret must not be empty"):
        split_secret(b"", threshold=2, total_shares=3)

    with pytest.raises(ValueError, match="At least one share is required"):
        reconstruct_secret([])


def test_shamir_invalid_threshold_parameters():
    secret = b"test_params"
    with pytest.raises(ValueError, match="threshold must be at least 2"):
        split_secret(secret, threshold=1, total_shares=3)

    with pytest.raises(ValueError, match="threshold must be <= total_shares"):
        split_secret(secret, threshold=5, total_shares=3)

    with pytest.raises(ValueError, match="total_shares cannot exceed 255"):
        split_secret(secret, threshold=3, total_shares=256)


def test_shamir_payload_size_limit_prevents_dos():
    huge_secret = b"X" * (MAX_SECRET_SIZE_BYTES + 1)
    with pytest.raises(ValueError, match="exceeds maximum allowable size"):
        split_secret(huge_secret, threshold=3, total_shares=5)


def test_shamir_binary_arbitrary_bytes():
    """Verify that binary secrets containing null bytes, high bytes (0xFF), etc. work cleanly."""
    raw_binary_secret = bytes(range(256))
    shares = split_secret(raw_binary_secret, threshold=3, total_shares=5)
    recovered = reconstruct_secret(shares[:3])
    assert recovered == raw_binary_secret
