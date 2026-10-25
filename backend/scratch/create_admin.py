import os
import sys
from pathlib import Path
# Ensure the backend package root is in PYTHONPATH
backend_root = Path(__file__).resolve().parents[1]
sys.path.append(str(backend_root))
# Ensure the SQLite DB URL is set for this script
os.environ.setdefault('DATABASE_URL', 'sqlite:///./vaultguard.db')

from app.core.database import create_tables, SessionLocal
from app.models.user import User
from app.crypto.hashing import hash_password

# Ensure tables exist
create_tables()

admin_username = 'vaultadmin'
admin_password = 'AdminPass123!'

with SessionLocal() as db:
    user = db.query(User).filter(User.username == admin_username).first()
    if user:
        print('Admin user already exists.')
    else:
        admin = User(
            username=admin_username,
            email='admin@example.com',
            password_hash=hash_password(admin_password),
            role='ADMIN',
            is_active=True,
            email_verified=True,
        )
        db.add(admin)
        db.commit()
        print('Admin user created with password:', admin_password)
