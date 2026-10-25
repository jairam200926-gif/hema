import sys, os
sys.path.append(os.path.abspath('.'))
from app.core.database import SessionLocal
from app.models.user import User
session = SessionLocal()
users = session.query(User).all()
for u in users:
    print('User', u.id, u.email, u.role)
