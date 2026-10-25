import os, sys
sys.path.append(os.path.abspath('.'))
from app.core.database import get_db
from app.models.user import User
from sqlalchemy import select

def main():
    # Retrieve all ADMIN users
    db = next(get_db())
    stmt = select(User).where(User.role == 'ADMIN')
    admins = db.execute(stmt).scalars().all()
    for admin in admins:
        # Print username and role only (no secrets)
        print(f"ADMIN username: {admin.username}, role: {admin.role}")
    db.close()

if __name__ == "__main__":
    main()
