export type Role = 'ADMIN' | 'USER' | 'CUSTODIAN';

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
}

export interface Custodian {
  id: string;
  name: string;
  type: string;
  status: 'ACTIVE' | 'OFFLINE' | 'SUSPENDED';
  assignedSharesCount: number;
  createdAt: string;
}

export interface Backup {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  threshold: number;
  totalShares: number;
  algorithm: 'SHAMIR_GF256_AES_GCM';
  status: 'ACTIVE' | 'ARCHIVED' | 'COMPROMISED';
  secretVerificationDigest: string; // SHA-256 fingerprint
  createdAt: string;
  updatedAt: string;
}

export interface Share {
  id: string;
  backupId: string;
  backupName: string;
  custodianId: string;
  custodianName: string;
  shareIndex: number;
  encryptedSharePreview: string; // Masked / truncated ciphertext
  nonce: string;
  authTag: string;
  shareIntegrityHash: string; // SHA-256
  status: 'HEALTHY' | 'COMPROMISED' | 'REVOKED';
  createdAt: string;
  lastVerifiedAt: string;
}

export type SecurityEventType = 
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'BACKUP_CREATED'
  | 'SHARES_GENERATED'
  | 'SHARE_VERIFIED'
  | 'SHARE_INTEGRITY_FAILURE'
  | 'RECOVERY_ATTEMPT'
  | 'RECOVERY_SUCCESS'
  | 'RECOVERY_FAILED'
  | 'UNAUTHORIZED_ATTEMPT'
  | 'REPLAY_ATTEMPT'
  | 'INVALID_SHARE'
  | 'DUPLICATE_SHARE'
  | 'PASSWORD_CHANGED'
  | 'EMAIL_VERIFIED';

export interface SecurityEvent {
  id: string;
  eventType: SecurityEventType;
  userId?: string;
  username?: string;
  backupId?: string;
  backupName?: string;
  shareId?: string;
  requestId?: string;
  result: 'SUCCESS' | 'REJECTED' | 'FAILURE' | 'BLOCKED';
  details: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface RecoveryAttempt {
  id: string;
  backupId: string;
  backupName: string;
  userId: string;
  username: string;
  requestId: string;
  sharesRequested: number;
  validShares: number;
  thresholdRequired: number;
  result: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REJECTED';
  failureReason?: string;
  createdAt: string;
  completedAt?: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  securityEventId?: string;
  recipient: string;
  notificationType: 'SECURITY_ALERT' | 'RECOVERY_ALERT' | 'BACKUP_NOTICE' | 'INTEGRITY_ALERT';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  subject: string;
  body: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  createdAt: string;
  sentAt?: string;
  failureReason?: string;
}

export interface DashboardMetrics {
  totalBackups: number;
  totalShares: number;
  healthyShares: number;
  compromisedShares: number;
  activeCustodians: number;
  recoveryAttempts: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  integrityFailures: number;
  unauthorizedAttempts: number;
  notificationsSent: number;
  notificationFailures: number;
  systemHealthPercentage: number;
}
