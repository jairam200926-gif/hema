import sys
from pathlib import Path

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import SessionLocal
from app.models.user import User

def check_user(username: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if user:
            print(f"Found user: {user.username}, role={user.role}, active={user.is_active}")
        else:
            print("User not found")
    finally:
        db.close()

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('username', help='username to check')
    args = parser.parse_args()
    check_user(args.username)
