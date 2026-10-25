"""
VaultGuard — Shamir Secret Sharing over GF(256)

Implements byte-oriented Shamir Secret Sharing using the finite field GF(2^8).

Security properties:
- Cryptographically secure random polynomial coefficients.
- Supports k-of-n threshold sharing.
- Each share contains an x-coordinate and y-coordinate bytes.
- Fewer than k valid shares cannot reconstruct the secret.
- Duplicate x-coordinates are rejected.
- x-coordinates are restricted to 1..255.

Important:
Shamir Secret Sharing provides distribution/reconstruction of a secret.
It does NOT provide confidentiality for stored shares by itself.
VaultGuard encrypts the generated shares separately using AES-256-GCM.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass


MIN_X = 1
MAX_X = 255
MAX_SECRET_SIZE_BYTES = 65536  # 64 KB limit to prevent CPU/memory exhaustion DoS


@dataclass(frozen=True)
class ShamirShare:
    """One Shamir share."""

    index: int
    value: bytes


def _gf_mul(a: int, b: int) -> int:
    """Multiply two elements in GF(256) using the AES polynomial."""
    result = 0

    while b:
        if b & 1:
            result ^= a

        high_bit = a & 0x80
        a = (a << 1) & 0xFF

        if high_bit:
            # Irreducible polynomial:
            # x^8 + x^4 + x^3 + x + 1
            a ^= 0x1B

        b >>= 1

    return result


def _gf_pow(a: int, exponent: int) -> int:
    """Exponentiation in GF(256)."""
    result = 1

    while exponent:
        if exponent & 1:
            result = _gf_mul(result, a)

        a = _gf_mul(a, a)
        exponent >>= 1

    return result


def _gf_inverse(a: int) -> int:
    """Multiplicative inverse in GF(256)."""
    if a == 0:
        raise ValueError("Zero has no multiplicative inverse in GF(256).")

    # In GF(256), a^255 = 1 for every non-zero a.
    # Therefore a^-1 = a^254.
    return _gf_pow(a, 254)


def _evaluate_polynomial(coefficients: list[int], x: int) -> int:
    """
    Evaluate a polynomial at x using Horner's method.

    coefficients[0] is the secret/constant term.
    """
    result = 0

    for coefficient in reversed(coefficients):
        result = _gf_mul(result, x) ^ coefficient

    return result


def split_secret(
    secret: bytes,
    threshold: int,
    total_shares: int,
) -> list[ShamirShare]:
    """
    Split a secret into threshold-based Shamir shares.

    Args:
        secret: Secret bytes to split.
        threshold: Minimum number of shares required.
        total_shares: Total number of shares to generate.

    Returns:
        A list containing total_shares ShamirShare objects.

    Raises:
        ValueError: If the threshold/share configuration is invalid.
    """
    if not isinstance(secret, (bytes, bytearray)):
        raise TypeError("secret must be bytes or bytearray.")

    if not secret:
        raise ValueError("secret must not be empty.")

    if len(secret) > MAX_SECRET_SIZE_BYTES:
        raise ValueError(
            f"secret size ({len(secret)} bytes) exceeds maximum allowable size of {MAX_SECRET_SIZE_BYTES} bytes."
        )

    if threshold < 2:
        raise ValueError("threshold must be at least 2.")

    if total_shares < 2:
        raise ValueError("total_shares must be at least 2.")

    if threshold > total_shares:
        raise ValueError("threshold must be <= total_shares.")

    if total_shares > MAX_X:
        raise ValueError("total_shares cannot exceed 255.")

    shares = [
        bytearray(len(secret))
        for _ in range(total_shares)
    ]

    x_coordinates = list(range(1, total_shares + 1))

    for byte_position, secret_byte in enumerate(secret):
        # Polynomial degree = threshold - 1.
        #
        # coefficient[0] = secret byte
        # remaining coefficients = cryptographically random
        # polynomial coefficients.
        coefficients = [secret_byte]

        for _ in range(threshold - 1):
            coefficients.append(secrets.randbelow(256))

        for share_position, x in enumerate(x_coordinates):
            shares[share_position][byte_position] = (
                _evaluate_polynomial(coefficients, x)
            )

    return [
        ShamirShare(
            index=x,
            value=bytes(shares[position]),
        )
        for position, x in enumerate(x_coordinates)
    ]


def reconstruct_secret(shares: list[ShamirShare]) -> bytes:
    """
    Reconstruct a secret using Lagrange interpolation at x = 0.

    At least the original threshold number of shares must be supplied.

    Note:
        This function cannot determine the original threshold from shares
        alone. The caller must enforce the configured threshold before
        calling this function.
    """
    if not shares:
        raise ValueError("At least one share is required.")

    for share in shares:
        if (
            not hasattr(share, "index")
            or not hasattr(share, "value")
            or not isinstance(share.index, int)
            or not isinstance(share.value, (bytes, bytearray))
        ):
            raise TypeError("All items in shares must be ShamirShare with an integer index and bytes value.")

    indexes = [share.index for share in shares]

    if len(set(indexes)) != len(indexes):
        raise ValueError("Duplicate share indexes are not allowed.")

    if any(index < MIN_X or index > MAX_X for index in indexes):
        raise ValueError("Share index must be between 1 and 255.")

    secret_length = len(shares[0].value)

    if secret_length == 0:
        raise ValueError("Share values must not be empty.")

    if secret_length > MAX_SECRET_SIZE_BYTES:
        raise ValueError(
            f"Share length ({secret_length} bytes) exceeds maximum allowable size of {MAX_SECRET_SIZE_BYTES} bytes."
        )

    if any(len(share.value) != secret_length for share in shares):
        raise ValueError("All share values must have the same length.")

    result = bytearray(secret_length)

    for byte_position in range(secret_length):
        reconstructed_byte = 0

        for current_share in shares:
            x_i = current_share.index
            y_i = current_share.value[byte_position]

            # Lagrange basis polynomial evaluated at x = 0:
            #
            # L_i(0) =
            #   product(-x_j / (x_i - x_j))
            #
            # over all j != i.
            lagrange_coefficient = 1

            for other_share in shares:
                x_j = other_share.index

                if x_i == x_j:
                    continue

                numerator = x_j
                denominator = x_i ^ x_j

                lagrange_coefficient = _gf_mul(
                    lagrange_coefficient,
                    _gf_mul(
                        numerator,
                        _gf_inverse(denominator),
                    ),
                )

            reconstructed_byte ^= _gf_mul(
                y_i,
                lagrange_coefficient,
            )

        result[byte_position] = reconstructed_byte

    return bytes(result)