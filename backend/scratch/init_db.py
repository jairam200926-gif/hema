// init_db.py - initialize SQLite DB and ensure admin user exists
import sys
from pathlib import Path

# Ensure backend dir is in path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import engine, Base
from app.core.security import hash_password
from app.models.user import User
from sqlalchemy.orm import Session

# Create tables
Base.metadata.create_all(bind=engine)

# Insert admin if missing
session = Session(bind=engine)
admin_username = "vaultadmin"
admin_user = session.query(User).filter(User.username == admin_username).first()
if not admin_user:
    admin_user = User(
        username=admin_username,
        email="admin@example.com",
        password_hash=hash_password("admin123"),
        role="ADMIN",
        is_active=True,
        email_verified=True,
    )
    session.add(admin_user)
    session.commit()
    print("Admin user created with username 'vaultadmin' and password 'admin123'.")
else:
    print("Admin user already exists.")
session.close()
