import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import SessionLocal
from app.models.user import User
from app.crypto.hashing import hash_password

def reset_admin_password(username: str, new_password: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            print(f'User {username} not found')
            return
        if user.role.name != 'ADMIN':
            print(f'User {username} is not admin (role={user.role})')
            return
        user.password_hash = hash_password(new_password)
        db.commit()
        print(f'Password reset for {username}')
    finally:
        db.close()

if __name__ == '__main__':
    # Example usage: python reset_admin_script.py vaultadmin MyNewPass123!
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('username', help='admin username')
    parser.add_argument('password', help='new password')
    args = parser.parse_args()
    reset_admin_password(args.username, args.password)
