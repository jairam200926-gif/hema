"""
VaultGuard — FastAPI Application Entry Point

Architecture:
  - Zero Client Trust: all crypto operations execute here, never in the frontend.
  - No Plaintext Persistence: secrets are never written to disk or logged.
  - Real Cryptography, Zero Theater: NIST/RFC-compliant algorithms only.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.database import check_db_connection, create_tables

# ── API Routers ────────────────────────────────────────────────────────────────
from app.api.auth import router as auth_router
from app.api.backups import router as backups_router
from app.api.shares import router as shares_router
from app.api.custodians import router as custodians_router
from app.api.audit import router as audit_router
from app.api.notifications import router as notifications_router
from app.api.recovery import router as recovery_router
from app.api.resilience import router as resilience_router
from app.api.security_tests import router as security_tests_router


settings = get_settings()

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO
)

logger = logging.getLogger("vaultguard")


# ── Application Lifecycle ─────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: log settings, verify configuration, initialize database."""

    logger.info(
        "VaultGuard %s starting — environment: %s",
        settings.APP_VERSION,
        settings.ENVIRONMENT,
    )

    if settings.ENVIRONMENT == "development":
        try:
            create_tables()
            logger.info("Database tables verified / created.")

            # Seed default custodians if none exist
            from app.core.database import SessionLocal
            from app.models.custodian import Custodian
            from app.models.user import User
            from app.crypto.hashing import hash_password

            seed_db = SessionLocal()
            try:
                if seed_db.query(Custodian).count() == 0:
                    default_custodians = [
                        Custodian(name="Security Operations (SOC)", type="TRUSTED_HUMAN", status="ACTIVE", email="soc@vaultguard.internal", description="Primary operations security unit"),
                        Custodian(name="Cloud Enclave KMS", type="CLOUD_KMS", status="ACTIVE", email="enclave@vaultguard.internal", description="Hardware-isolated cloud HSM"),
                        Custodian(name="Compliance & Data Protection", type="INSTITUTION", status="ACTIVE", email="compliance@vaultguard.internal", description="Institutional governance trustee"),
                        Custodian(name="West Coast Vault Enclave", type="HARDWARE_TOKEN", status="ACTIVE", email="vault-west@vaultguard.internal", description="Air-gapped physical storage token"),
                        Custodian(name="East Coast Disaster Recovery", type="HARDWARE_TOKEN", status="ACTIVE", email="vault-east@vaultguard.internal", description="Geographically isolated standby token"),
                    ]
                    seed_db.add_all(default_custodians)
                    seed_db.commit()
                    logger.info("Initial custodian entities registered.")

                if not seed_db.query(User).filter(User.username == "admin").first():
                    admin_user = User(
                        username="admin",
                        email="admin@vaultguard.internal",
                        password_hash=hash_password("VaultAdmin2026!"),
                        role="ADMIN",
                        is_active=True,
                        email_verified=True,
                    )
                    seed_db.add(admin_user)
                    seed_db.commit()
                    logger.info("Initial development administrator account registered.")
            finally:
                seed_db.close()

        except Exception as exc:
            logger.warning(
                "Could not initialize startup database records: %s",
                exc,
            )

    yield

    logger.info("VaultGuard shutting down.")


# ── FastAPI Application ────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "**VaultGuard** — Threshold-Cryptography Backup & Recovery System.\n\n"
        "Academic prototype demonstrating Shamir Secret Sharing (GF(2⁸)), "
        "AES-256-GCM share encryption, Argon2id authentication, and "
        "cryptographic integrity verification."
    ),
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)


# ── CORS Middleware ────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
    ],
    expose_headers=["X-Request-ID"],
)


# ── Security Headers & Rate Limiting Middleware ──────────────────────────────
from app.core.rate_limit import check_rate_limit


@app.middleware("http")
async def add_security_headers_and_rate_limits(request: Request, call_next):
    if request.method != "OPTIONS":
        check_rate_limit(request)

    response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Cache-Control"] = "no-store"

    return response


# ── Global Exception Handlers ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
):
    logger.exception(
        "Unhandled exception on %s %s",
        request.method,
        request.url.path,
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An unexpected internal error occurred."
        },
    )


# ── Health Check ───────────────────────────────────────────────────────────────
@app.get(
    "/api/health",
    tags=["Health"],
    summary="Backend health & database connectivity check",
)
def health_check():
    db_ok = check_db_connection()

    return {
        "status": "healthy" if db_ok else "degraded",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "database": "connected" if db_ok else "unreachable",
    }


# ── Register All Routers ───────────────────────────────────────────────────────
API_PREFIX = "/api"

app.include_router(
    auth_router,
    prefix=API_PREFIX,
)

app.include_router(
    backups_router,
    prefix=API_PREFIX,
)

app.include_router(
    shares_router,
    prefix=API_PREFIX,
)

app.include_router(
    custodians_router,
    prefix=API_PREFIX,
)

app.include_router(
    audit_router,
    prefix=API_PREFIX,
)

app.include_router(
    notifications_router,
    prefix=API_PREFIX,
)

app.include_router(
    recovery_router,
    prefix=API_PREFIX,
)

app.include_router(
    resilience_router,
    prefix=API_PREFIX,
)

app.include_router(
    security_tests_router,
    prefix=API_PREFIX,
)


# ── Root Redirect ──────────────────────────────────────────────────────────────
@app.get(
    "/",
    include_in_schema=False,
)
def root():
    return {
        "message": (
            "VaultGuard API is running. "
            "Visit /api/docs for documentation."
        )
    }