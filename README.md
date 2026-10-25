# VaultGuard — Threshold Cryptography Backup & Recovery System

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-009688.svg)](https://fastapi.tiangolo.com)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646cff.svg)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-42%20Passed-emerald.svg)](https://docs.pytest.org/)
[![Security](https://img.shields.io/badge/Crypto-Shamir%20GF(256)%20%7C%20AES--256--GCM-blueviolet.svg)](#cryptographic-architecture)

**VaultGuard** is an enterprise-grade key escrow and disaster recovery platform engineered with information-theoretic threshold cryptography, authenticated symmetric encryption (AEAD), memory-hard password hashing, and tamper-evident audit logging.

It guarantees that sensitive master secrets (such as crypto seed phrases, private keys, database master credentials, and root certificates) can be split into $n$ distributed custodian shares, requiring a strict threshold $k$ ($k \le n$) of valid shares to reconstruct. Any coalition of fewer than $k$ shares reveals **zero Shannon information** about the secret.

---

## Table of Contents
1. [Core Features](#core-features)
2. [Cryptographic Architecture](#cryptographic-architecture)
3. [Project Structure](#project-structure)
4. [Quick Start & Installation](#quick-start--installation)
5. [Automated Verification & Test Execution](#automated-verification--test-execution)
6. [Security Test Center (Live Attack Vectors)](#security-test-center-live-attack-vectors)
7. [Disaster Recovery Simulator & Controlled Drills](#disaster-recovery-simulator--controlled-drills)
8. [Threat Model & Security Boundaries](#threat-model--security-boundaries)
9. [API Specification](#api-specification)

---

## Core Features

- **Shamir's Secret Sharing over $\text{GF}(2^8)$**: Constant-time Galois Field arithmetic with byte-by-byte Lagrange polynomial interpolation at $x = 0$.
- **AES-256-GCM Share Encryption**: Every share at rest is encrypted with standard 12-byte nonces and 16-byte authentication tags bound to unique canonical Additional Authenticated Data (AAD).
- **Canonical AAD Binding**: Format `vaultguard:v1:backup:{backup_id}:share:{index}` prevents cross-vault share confusion and index-swapping attacks.
- **HMAC-SHA256 Secret Verification**: Verifies reconstructed secret integrity without persisting the plaintext secret or creating an offline brute-force oracle.
- **Tamper-Evident Hash-Chained Audit Ledger**: Every security, authentication, and recovery ceremony is sealed into a SHA-256 linear hash chain verifying genesis, sequence, timestamps, and payload immutability.
- **Argon2id Key Derivation**: High-entropy memory-hard password hashing (RFC 9106) protecting credentials against GPU/ASIC dictionary attacks.
- **Time-Bounded Single-Use Recovery**: Recovery requests enforce strict time-to-live (TTL), state machines (`PENDING` $\to$ `COMPLETED` / `EXPIRED`), single-use enforcement, and replay attack rejection.
- **Real Security Test Center**: Executes live cryptographic and authorization attack vectors against real endpoints and services with zero simulated timeouts or randomized results.
- **Disaster Recovery Simulator**: Features an interactive synthetic $(k,n)$ sandbox modeling hardware outages and bit-flip corruptions, paired with non-destructive live vault drills.

---

## Cryptographic Architecture

```
                    ┌───────────────────────────┐
                    │       Master Secret       │
                    │   (Seed / Key / Token)    │
                    └─────────────┬─────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         │                                                 │
         ▼                                                 ▼
┌─────────────────────────────────┐            ┌───────────────────────┐
│ Shamir Secret Sharing GF(2⁸)   │            │ HMAC-SHA256 Digest    │
│ Threshold Polynomial f(x)       │            │ Keyed with Master Key │
│ Degree: k - 1                   │            └───────────┬───────────┘
└────────┬──────────────┬─────────┘                        │
         │              │                                  │
   Share 1 (x=1)   Share 2 (x=2) ... Share n (x=n)         │
         │              │                                  │
         ▼              ▼                                  │
┌─────────────────────────────────┐                        │
│ AES-256-GCM Encryption          │                        │
│ AAD: vaultguard:v1:backup:{id}: │                        │
│      share:{index}              │                        │
└────────┬──────────────┬─────────┘                        │
         │              │                                  │
         ▼              ▼                                  ▼
┌──────────────────────────────────────────────────────────────┐
│                   VaultGuard Storage Engine                  │
│       - Encrypted Custodian Shares (Ciphertext, Nonce, Tag)  │
│       - Secret Verification Digest                           │
│       - SHA-256 Tamper-Evident Hash-Chained Audit Events     │
└──────────────────────────────────────────────────────────────┘
```

### 1. Shamir's Secret Sharing Formulation
For a $(k, n)$ scheme with secret $S \in \text{GF}(2^8)^L$:
1. A random polynomial $f(x) = a_0 + a_1 x + a_2 x^2 + \dots + a_{k-1} x^{k-1}$ is constructed for each byte of $S$, where $a_0 = S$ and $a_1, \dots, a_{k-1} \stackrel{\$}{\leftarrow} \text{GF}(2^8)$ via OS CSPRNG (`secrets.token_bytes`).
2. Shares $(i, f(i))$ are evaluated for $i \in \{1, 2, \dots, n\}$.
3. Given any subset of $k$ distinct coordinates $\{(x_j, y_j)\}_{j=1}^k$:
   $$S = f(0) = \sum_{j=1}^k y_j \prod_{\substack{m=1 \\ m \ne j}}^k \frac{-x_m}{x_j - x_m} \pmod{\text{GF}(2^8)}$$
   Field division is executed via precomputed exponent/logarithm tables with generator polynomial $x^8 + x^4 + x^3 + x + 1$ (0x11B / Rijndael field).

### 2. Share Encryption & Canonical AAD Binding
Each share coordinate $(i, y_i)$ is serialized to bytes and encrypted:
- **Cipher**: AES-256-GCM.
- **Key**: 256-bit AES Master Key (`AES_MASTER_KEY_HEX`).
- **Nonce**: 96-bit cryptographically secure random nonce per share.
- **Tag**: 128-bit authentication tag.
- **AAD**: `vaultguard:v1:backup:{backup_uuid}:share:{index}`.

If an attacker alters the ciphertext, changes the nonce, flips a bit in the tag, or swaps shares between backup vaults, AES-GCM authentication verification fails immediately with `InvalidTag` and decrypts nothing.

### 3. Hash-Chained Audit Ledger
Every state modification logs an event record:
$$\text{EventHash}_i = \text{SHA-256}\Big(\text{EventHash}_{i-1} \parallel \text{CanonicalJSON}\big(\text{event}_i\big)\Big)$$
- Timestamps are strictly normalized to UTC ISO-8601 strings (`YYYY-MM-DDTHH:MM:SSZ`) before hashing, ensuring that database persistence and reloads on SQLite and PostgreSQL produce byte-identical canonical strings.
- Re-ordering, insertion, deletion, or bit alteration in any past audit event breaks the chain at that exact index during linear verification (`GET /api/audit/verify-chain`).

---

## Project Structure

```
VaultGaurd-main/
├── backend/
│   ├── app/
│   │   ├── api/               # FastAPI REST Routers
│   │   │   ├── auth.py            # User authentication & token generation
│   │   │   ├── backups.py         # Backup creation ceremony & listing
│   │   │   ├── shares.py          # Share retrieval & integrity checks
│   │   │   ├── recovery.py        # Request init & Lagrange reconstruction
│   │   │   ├── audit.py           # Audit trail querying & chain verification
│   │   │   ├── custodians.py      # Custodian management
│   │   │   ├── notifications.py   # Preference management & dev mailbox
│   │   │   ├── resilience.py      # Fleet health & readiness metrics
│   │   │   ├── simulator.py       # DR simulation & non-destructive drills
│   │   │   └── security_tests.py  # 8 live cryptographic attack vector tests
│   │   ├── core/              # Config, database engine, JWT security
│   │   ├── crypto/            # Cryptographic primitives (GF(256), AES-GCM, Argon2id)
│   │   ├── models/            # SQLAlchemy database models
│   │   └── services/          # Business logic, audit chain, notification queue
│   └── tests/                 # Automated pytest suite (42 tests)
├── frontend/
│   ├── src/
│   │   ├── api/client.ts      # Fetch API client with Bearer token injection
│   │   ├── contexts/          # AuthContext (JWT management & session state)
│   │   ├── components/        # Layout, Navbar, Sidebar, ProtectedRoute
│   │   └── pages/             # All UI console pages
│   │       ├── DashboardPage.tsx       # Live health, share integrity, activity
│   │       ├── BackupsPage.tsx         # Vault listing & archiving
│   │       ├── CreateBackupPage.tsx    # SSS threshold & custodian assignment
│   │       ├── SharesPage.tsx          # Real share status & cryptographic verify
│   │       ├── RecoveryPage.tsx        # Threshold assembly & secret release
│   │       ├── RecoverySimulatorPage.tsx # Synthetic DR sandbox & live drills
│   │       ├── SecurityTestsPage.tsx   # Real cryptographic attack test console
│   │       ├── AuditPage.tsx           # Audit log & linear hash-chain verifier
│   │       ├── CustodiansPage.tsx      # Custodian node registry
│   │       ├── NotificationsPage.tsx   # Security alerts & dev mailbox
│   │       ├── SettingsPage.tsx        # UI & notification preferences
│   │       └── AboutPage.tsx           # Cryptographic specifications & formulas
├── .env.example               # Secure environment template
└── README.md                  # System documentation
```

---

## Quick Start & Installation

### Prerequisites
- **Python**: 3.11 or higher
- **Node.js**: 18.0 or higher
- **npm**: 9.0 or higher

### 1. Backend Setup

```bash
cd backend

# Create and activate a virtual environment (optional but recommended)
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
# source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Create .env from template
cp ../.env.example .env
```

Ensure your `.env` has valid cryptographic keys. You can generate fresh keys using:
```bash
python -c "import secrets; print('AES_MASTER_KEY_HEX=' + secrets.token_hex(32))"
python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(32))"
```

Start the FastAPI backend server:
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The backend API is now running at `http://127.0.0.1:8000` (API documentation at `http://127.0.0.1:8000/docs`).

### 2. Frontend Setup

In a new terminal window:
```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```
The frontend is available at `http://localhost:5173`. API requests to `/api/*` are automatically proxied to `http://127.0.0.1:8000`.

### 3. Default Credentials
The application seeds an administrative operator account upon first launch:
- **Username**: `admin`
- **Password**: `VaultAdmin2026!`

---

## Automated Verification & Test Execution

### 1. Backend Pytest Suite
Run the full automated test suite covering GF(256) arithmetic, AES-GCM canonical AAD, threshold reconstruction, replay attacks, cross-user IDOR, and audit hash-chain integrity:

```bash
cd backend
python -m pytest tests/ -v
```

**Test Execution Results:**
```
tests/test_api_backups_shares.py::test_create_backup_success PASSED
tests/test_api_backups_shares.py::test_create_backup_duplicate_custodians_rejected PASSED
tests/test_api_backups_shares.py::test_share_verification_with_canonical_aad PASSED
tests/test_api_backups_shares.py::test_tampered_share_fails_verification PASSED
tests/test_api_backups_shares.py::test_idor_unauthorized_backup_access_rejected PASSED
tests/test_api_recovery.py::test_successful_recovery_first_subset PASSED
tests/test_api_recovery.py::test_successful_recovery_different_subset PASSED
tests/test_api_recovery.py::test_sub_threshold_rejection PASSED
tests/test_api_recovery.py::test_replay_attack_rejected PASSED
tests/test_api_recovery.py::test_duplicate_share_rejected PASSED
tests/test_api_recovery.py::test_expired_request_rejected PASSED
tests/test_api_recovery.py::test_cross_user_unauthorized_recovery_rejected PASSED
tests/test_audit_hash_chain.py::test_audit_hash_chain_creation_and_verification PASSED
tests/test_audit_hash_chain.py::test_audit_chain_tamper_detection PASSED
tests/test_audit_hash_chain.py::test_failed_login_persists_security_event PASSED
tests/test_crypto_aes_gcm.py::test_canonical_aad_generation PASSED
tests/test_crypto_aes_gcm.py::test_canonical_aad_rejects_none PASSED
tests/test_crypto_aes_gcm.py::test_aes_gcm_round_trip PASSED
tests/test_crypto_aes_gcm.py::test_regression_missing_aad_fails PASSED
tests/test_crypto_aes_gcm.py::test_mismatched_backup_id_in_aad_fails PASSED
tests/test_crypto_aes_gcm.py::test_mismatched_share_index_in_aad_fails PASSED
tests/test_crypto_aes_gcm.py::test_tampered_ciphertext_fails PASSED
tests/test_crypto_aes_gcm.py::test_tampered_auth_tag_fails PASSED
tests/test_crypto_aes_gcm.py::test_tampered_nonce_fails PASSED
tests/test_crypto_aes_gcm.py::test_invalid_nonce_length_fails PASSED
tests/test_crypto_aes_gcm.py::test_invalid_tag_length_fails PASSED
tests/test_crypto_aes_gcm.py::test_wrong_encryption_key_fails PASSED
tests/test_crypto_shamir.py::test_shamir_all_subsets_reconstruction[2-2] PASSED
tests/test_crypto_shamir.py::test_shamir_all_subsets_reconstruction[2-3] PASSED
tests/test_crypto_shamir.py::test_shamir_all_subsets_reconstruction[3-5] PASSED
tests/test_crypto_shamir.py::test_shamir_all_subsets_reconstruction[4-7] PASSED
tests/test_crypto_shamir.py::test_shamir_all_subsets_reconstruction[5-10] PASSED
tests/test_crypto_shamir.py::test_shamir_all_subsets_reconstruction[8-12] PASSED
tests/test_crypto_shamir.py::test_shamir_super_threshold_reconstruction PASSED
tests/test_crypto_shamir.py::test_shamir_sub_threshold_failure PASSED
tests/test_crypto_shamir.py::test_shamir_duplicate_indexes_rejected PASSED
tests/test_crypto_shamir.py::test_shamir_invalid_coordinate_ranges PASSED
tests/test_crypto_shamir.py::test_shamir_inconsistent_share_lengths_rejected PASSED
tests/test_crypto_shamir.py::test_shamir_empty_inputs_rejected PASSED
tests/test_crypto_shamir.py::test_shamir_invalid_threshold_parameters PASSED
tests/test_crypto_shamir.py::test_shamir_payload_size_limit_prevents_dos PASSED
tests/test_crypto_shamir.py::test_shamir_binary_arbitrary_bytes PASSED

42 passed, 0 failed, 0 errors in 6.40s
```

### 2. Frontend Production Build & Lint
```bash
cd frontend
npm run lint    # oxlint: 0 errors
npm run build   # tsc -b && vite build: 0 errors
```

---

## Security Test Center (Live Attack Vectors)

The **Security Test Center** (`/security-tests`) allows administrators to execute genuine cryptographic attack scenarios directly against the live backend services:

| Test ID | Name | Attack Vector / Methodology | Expected Outcome |
| :--- | :--- | :--- | :--- |
| `ST-01` | **Sub-Threshold Coalition** | Submitting $k-1$ shares to the recovery ceremony | Rejected: `400 Bad Request` with information leakage = 0 |
| `ST-02` | **Valid Threshold Reconstruction** | Submitting exactly $k$ valid shares | Approved: `200 OK` with secret matching SHA-256 HMAC digest |
| `ST-03` | **AES-GCM Ciphertext Tampering** | Bit-flipping encrypted share byte in transit | Rejected: `400 Bad Request`, AES-GCM authentication tag mismatch |
| `ST-04` | **Cross-Vault AAD Injection** | Replaying a valid share from Backup A against Backup B | Rejected: `400 Bad Request`, canonical AAD binding mismatch |
| `ST-05` | **Duplicate Share Sybil Attack** | Submitting duplicate share indexes to reach threshold | Rejected: `400 Bad Request`, non-distinct index rejection |
| `ST-06` | **Recovery Replay Attack** | Submitting shares against an already `COMPLETED` request | Rejected: `400 Bad Request`, request state invalid for execution |
| `ST-07` | **IDOR / Cross-User Access** | User B attempts to access or reconstruct User A's vault | Rejected: `404 / 403 Forbidden`, ownership boundary enforced |
| `ST-08` | **Audit Hash-Chain Tampering** | Simulates modification of an historical event payload | Chain broken: `verify-chain` detects sequence break at target index |

Every test displays the genuine response payload, execution latency in milliseconds, and formal cryptographic assertions.

---

## Disaster Recovery Simulator & Controlled Drills

VaultGuard features a **Disaster Recovery Simulator** (`/simulator`) providing dual-mode resilience evaluation:

### 1. Synthetic Sandbox Mode
- Configure theoretical schemes: $k \in [2, 20]$, $n \in [k, 255]$.
- Inject simulated custodian outages (hardware failures, network partitions).
- Inject simulated AES-GCM authentication tag corruptions (bit-flips, bit-rot).
- Simulate time-to-live expiration.
- The backend dynamically verifies polynomial Lagrange interpolation on synthetic memory secrets, outputting health states:
  - **Optimal Recoverability**: Available healthy shares $> k$.
  - **Degraded State (Zero Margin)**: Available healthy shares $= k$.
  - **Unrecoverable Disaster State**: Available healthy shares $< k$.

### 2. Controlled Live Vault Drills
- Select an active production vault from the registry.
- Designate specific share indexes to simulate as unreachable.
- The backend executes real AES-256-GCM decryptions and Lagrange interpolation over the remaining shares.
- **Zero-Knowledge Principle**: The reconstructed secret is verified against the stored SHA-256 digest and immediately wiped from memory. It is **never logged, persisted, or returned to the client**.

---

## Threat Model & Security Boundaries

An honest assessment of the system's security boundaries:

### What VaultGuard Protects Against
- **Custodian Collusion ($< k$)**: Any coalition of fewer than $k$ custodians cannot infer a single bit of the secret.
- **Passive Database Theft**: All stored shares at rest are AES-256-GCM encrypted. An attacker with raw access to the SQL database without `AES_MASTER_KEY_HEX` cannot read shares.
- **Cross-Vault Share Substitution**: Canonical AAD strictly binds ciphertexts to their backup UUID and index.
- **Share Tampering / Bit-Rot**: Any alteration to stored ciphertext or tags causes decryption failure before Lagrange interpolation is attempted.
- **Offline Secret Guessing**: Master secret digests are keyed using HMAC-SHA256 with the master key, preventing dictionary attacks on low-to-medium entropy secrets if the database is leaked without the key.
- **Audit Log Modification**: An attacker altering individual event records will fail linear chain verification (`hash != sha256(prev_hash + canonical_event)`).

### What VaultGuard Does NOT Protect Against (Anti-Theater)
- **Host Compromise / Root Access**: If an attacker obtains root access to the application host, they can read `AES_MASTER_KEY_HEX` from the environment or scrape decrypted shares from Python memory during a recovery ceremony.
- **Full Database Recomputation**: If an attacker with direct SQL write access alters an event and has sufficient compute to rewrite all subsequent `previous_hash` values, the local hash chain will appear valid. (True immutability requires external RFC 3161 timestamps or blockchain anchoring).
- **Physical Custodian Independence**: In the default single-server deployment, custodians are logical database entities. To achieve true Byzantine fault tolerance, custodian endpoints must be deployed on physically independent, isolated networks.

---

## API Specification

Interactive OpenAPI documentation is generated automatically at `http://127.0.0.1:8000/docs`.

### Primary Endpoints:
- `POST /api/auth/login` — Authenticate and receive JWT bearer token.
- `GET  /api/auth/me` — Retrieve authenticated user profile and roles.
- `GET  /api/backups` — List backups owned by the authenticated user.
- `POST /api/backups` — Split secret into $n$ shares with threshold $k$, encrypt, and store.
- `DELETE /api/backups/{id}` — Archive an active backup vault.
- `GET  /api/shares` — Retrieve encrypted share metadata.
- `POST /api/shares/{id}/verify` — Verify share ciphertext authenticity against AEAD tag and AAD.
- `POST /api/recovery/init` — Initiate a time-bounded recovery ceremony.
- `POST /api/recovery/submit` — Submit threshold shares for Lagrange reconstruction and digest validation.
- `GET  /api/audit/events` — Retrieve paginated audit event timeline.
- `GET  /api/audit/verify-chain` — Execute linear SHA-256 traversal across the entire audit ledger.
- `POST /api/simulator/evaluate` — Evaluate synthetic $(k, n)$ disaster scenarios.
- `POST /api/simulator/run-drill` — Non-destructive controlled recovery drill against an active vault.
- `GET  /api/security-tests/cases` — Retrieve catalog of executable cryptographic attack tests.
- `POST /api/security-tests/run` — Execute real attack scenario against application services.

---

## License & Compliance
This software is developed strictly for research, testing, and operational key recovery under cryptographic compliance standards (NIST SP 800-38D, RFC 9106, RFC 7519).
#   h e m a  
 #   h e m a  
 