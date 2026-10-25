"""
VaultGuard — Rate Limiting & Brute-Force Throttling Engine

Provides sliding-window in-memory throttling to protect sensitive endpoints:
- Authentication endpoints (/api/auth/login)
- Recovery submission endpoints (/api/recovery/submit)
- Share verification triggers (/api/shares/{id}/verify)
"""
from __future__ import annotations

import time
from collections import defaultdict
from typing import Dict, List, Tuple
from fastapi import Request, HTTPException, status

# Sliding window request history: key -> list of timestamps
_REQUEST_HISTORY: Dict[str, List[float]] = defaultdict(list)
# Lockouts: key -> unlock_timestamp
_LOCKOUTS: Dict[str, float] = {}

# Rules: path_prefix -> (max_requests, window_seconds, lockout_seconds)
RATE_LIMIT_RULES: Dict[str, Tuple[int, int, int]] = {
    "/api/auth/login": (10, 60, 300),          # 10 attempts per minute -> 5m lockout
    "/api/recovery/submit": (10, 60, 300),      # 10 attempts per minute -> 5m lockout
    "/api/shares/": (60, 60, 60),               # 60 verification triggers per minute
}


def get_client_identifier(request: Request) -> str:
    """Extract client IP address or proxy header."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


def check_rate_limit(request: Request) -> None:
    """Enforce sliding-window rate limit and lockouts."""
    path = request.url.path
    matched_rule = None
    for prefix, rule in RATE_LIMIT_RULES.items():
        if path.startswith(prefix):
            matched_rule = rule
            break

    if not matched_rule:
        return

    max_requests, window_seconds, lockout_seconds = matched_rule
    client_ip = get_client_identifier(request)
    key = f"{client_ip}:{path}"
    now = time.time()

    # Check if currently locked out
    if key in _LOCKOUTS:
        unlock_time = _LOCKOUTS[key]
        if now < unlock_time:
            remaining = int(unlock_time - now)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Temporary cooldown active. Retry in {remaining} seconds.",
                headers={"Retry-After": str(remaining)},
            )
        else:
            del _LOCKOUTS[key]

    # Clean old requests outside window
    cutoff = now - window_seconds
    _REQUEST_HISTORY[key] = [t for t in _REQUEST_HISTORY[key] if t > cutoff]

    # Check request count
    if len(_REQUEST_HISTORY[key]) >= max_requests:
        _LOCKOUTS[key] = now + lockout_seconds
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many requests. Temporary security lockout enforced for {lockout_seconds} seconds.",
            headers={"Retry-After": str(lockout_seconds)},
        )

    _REQUEST_HISTORY[key].append(now)
