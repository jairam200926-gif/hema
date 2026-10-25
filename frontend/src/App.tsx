import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { BackupsPage } from './pages/BackupsPage';
import { CreateBackupPage } from './pages/CreateBackupPage';
import { SharesPage } from './pages/SharesPage';
import { RecoveryPage } from './pages/RecoveryPage';
import { RecoverySimulatorPage } from './pages/RecoverySimulatorPage';
import { SecurityTestsPage } from './pages/SecurityTestsPage';
import { AuditPage } from './pages/AuditPage';
import { CustodiansPage } from './pages/CustodiansPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AboutPage } from './pages/AboutPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Authentication */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/backups" element={<BackupsPage />} />
          <Route path="/backups/new" element={<CreateBackupPage />} />
          <Route path="/shares" element={<SharesPage />} />
          <Route path="/recovery" element={<RecoveryPage />} />
          <Route path="/simulator" element={<RecoverySimulatorPage />} />
          <Route path="/security-tests" element={<SecurityTestsPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/custodians" element={<CustodiansPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
