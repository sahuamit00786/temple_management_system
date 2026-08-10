import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './auth/AppContext.jsx';
import { getAccessToken } from './api/client.js';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Pos from './pages/Pos.jsx';
import Bookings from './pages/Bookings.jsx';
import Devotees from './pages/Devotees.jsx';
import DevoteeDetail from './pages/DevoteeDetail.jsx';
import Reports from './pages/Reports.jsx';
import Lookups from './pages/Lookups.jsx';
import Users from './pages/Users.jsx';
import Settings from './pages/Settings.jsx';
import TempleConfig from './pages/TempleConfig.jsx';
import Payments from './pages/Payments.jsx';

function Guard({ menuKey, children }) {
  const { booted, can } = useApp();
  if (!booted) return null;
  // Token is the source of truth for "logged in" — only logout() clears it.
  // Screen stays up on token alone even if /auth/me can't be reached offline.
  if (!getAccessToken()) return <Navigate to="/login" replace />;
  if (menuKey && !can(menuKey, 'view')) return <p className="text-center text-ink-600 py-16">You don't have access to this page. Ask your admin to grant it in Menu Permissions.</p>;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route element={<Guard><Layout /></Guard>}>
          <Route path="/" element={<Guard menuKey="dashboard"><Dashboard /></Guard>} />
          <Route path="/pos" element={<Guard menuKey="pos"><Pos /></Guard>} />
          <Route path="/bookings" element={<Guard menuKey="bookings"><Bookings /></Guard>} />
          <Route path="/devotees" element={<Guard menuKey="devotees"><Devotees /></Guard>} />
          <Route path="/devotees/:id" element={<Guard menuKey="devotees"><DevoteeDetail /></Guard>} />
          <Route path="/reports" element={<Guard menuKey="reports"><Reports /></Guard>} />
          <Route path="/lookups" element={<Guard menuKey="lookups"><Lookups /></Guard>} />
          <Route path="/users" element={<Guard menuKey="users"><Users /></Guard>} />
          <Route path="/settings" element={<Guard menuKey="settings"><Settings /></Guard>} />
          <Route path="/temple-config" element={<Guard menuKey="temple-config"><TempleConfig /></Guard>} />
          <Route path="/payments" element={<Guard menuKey="payments"><Payments /></Guard>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
