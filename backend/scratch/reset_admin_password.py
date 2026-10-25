"""Temporary local admin password reset."""

import sys
from pathlib import Path
from getpass import getpass

# Add the backend directory to Python's import path.
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import SessionLocal
from app.crypto.hashing import hash_password
from app.models.user import User


def main():
    username = input("Admin username (admin/vaultadmin): ").strip()

    if username not in {"admin", "vaultadmin"}:
        print("Invalid username.")
        return

    password = getpass("New password: ")
    confirm = getpass("Confirm new password: ")

    if not password or password != confirm:
        print("Passwords are empty or do not match.")
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()

        if user is None:
            print("User not found.")
            return

        role = str(user.role).upper().split(".")[-1]
        if role != "ADMIN":
            print("Selected account is not an admin.")
            return

        user.password_hash = hash_password(password)
        db.commit()
        print(f"Password reset successfully for {username}.")

    except Exception as exc:
        db.rollback()
        print(f"Password reset failed: {type(exc).__name__}")
    finally:
        db.close()


if __name__ == "__main__":
    main()