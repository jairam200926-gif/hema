"""
VaultGuard Test Configuration & Shared Fixtures
"""
import os
import tempfile
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Point to SQLite test database before importing app
_test_db_fd, _test_db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_test_db_path.replace(os.sep, '/')}"
os.environ["ENVIRONMENT"] = "development"
os.environ["AES_MASTER_KEY_HEX"] = "4f9e8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f"
os.environ["JWT_SECRET_KEY"] = "test_jwt_secret_key_at_least_32_bytes_long_random_value"

from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.crypto.hashing import hash_password
from app.main import app
from app.models.custodian import Custodian
from app.models.user import User

test_engine = create_engine(
    f"sqlite:///{_test_db_path.replace(os.sep, '/')}",
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    try:
        os.close(_test_db_fd)
        os.unlink(_test_db_path)
    except Exception:
        pass


@pytest.fixture
def db_session():
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db_session) -> User:
    user = User(
        id=uuid.uuid4(),
        username=f"testuser_{uuid.uuid4().hex[:6]}",
        email=f"user_{uuid.uuid4().hex[:6]}@vaultguard.internal",
        password_hash=hash_password("ValidPassword123!"),
        role="USER",
        is_active=True,
        email_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_admin(db_session) -> User:
    admin = User(
        id=uuid.uuid4(),
        username=f"admin_{uuid.uuid4().hex[:6]}",
        email=f"admin_{uuid.uuid4().hex[:6]}@vaultguard.internal",
        password_hash=hash_password("AdminPass123!"),
        role="ADMIN",
        is_active=True,
        email_verified=True,
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


@pytest.fixture
def user_auth_headers(test_user) -> dict[str, str]:
    token = create_access_token(subject=str(test_user.id), role=test_user.role)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_auth_headers(test_admin) -> dict[str, str]:
    token = create_access_token(subject=str(test_admin.id), role=test_admin.role)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def test_custodians(db_session) -> list[Custodian]:
    custodians = []
    for i in range(1, 6):
        c = Custodian(
            id=uuid.uuid4(),
            name=f"Custodian Unit {i}",
            type="TRUSTED_HUMAN" if i % 2 == 1 else "CLOUD_KMS",
            status="ACTIVE",
            email=f"custodian{i}@vaultguard.internal",
        )
        db_session.add(c)
        custodians.append(c)
    db_session.commit()
    for c in custodians:
        db_session.refresh(c)
    return custodians
