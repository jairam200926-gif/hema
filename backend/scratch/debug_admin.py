import sys
from pathlib import Path
# Add backend root to sys.path
BASE = Path(__file__).resolve().parents[2]
sys.path.append(str(BASE))

from app.core.database import SessionLocal
from app.models.user import User
from app.crypto.hashing import verify_password

def main():
    with SessionLocal() as db:
        admin = db.query(User).filter(User.username == 'admin').first()
        if not admin:
            print('Admin user not found')
            return
        print('Admin user details:')
        print('username:', admin.username)
        print('role:', admin.role)
        print('is_active:', admin.is_active)
        # Attempt verification with common test password
        test_pwd = 'TestPass123!'
        ok = verify_password(test_pwd, admin.password_hash)
        print('Password verification for TestPass123! ->', ok)

if __name__ == '__main__':
    main()
