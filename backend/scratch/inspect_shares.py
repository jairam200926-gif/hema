import sys
import os
sys.path.append(os.path.abspath('.'))
from app.core.database import SessionLocal
from app.models.backup import Backup
from app.models.share import Share
from app.models.custodian import Custodian
session = SessionLocal()
backup_id = '38228abc-597f-4b09-b5de-a4cedb1a0907'
backup = session.query(Backup).filter(Backup.id == backup_id).first()
if not backup:
    print('Backup not found')
    sys.exit(1)
print('Backup:', backup.id, backup.name, backup.threshold, backup.total_shares, backup.secret_verification_digest)
shares = session.query(Share).filter(Share.backup_id == backup.id).order_by(Share.share_index).all()
print('Shares count:', len(shares))
for s in shares:
    cust = session.query(Custodian).filter(Custodian.id == s.custodian_id).first()
    print(f'Share index {s.share_index}, share_id {s.id}, custodian_id {s.custodian_id}, custodian name {cust.name if cust else None}, status {s.status}')
