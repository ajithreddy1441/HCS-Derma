import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';
import Login from './pages/auth/Login';
import Dashboard from './pages/dashboard/Dashboard';
import CustomersPage from './pages/customers/CustomersPage';
import CustomerDetail from './pages/customers/CustomerDetail';
import LeadsPage from './pages/leads/LeadsPage';
import LeadDetail from './pages/leads/LeadDetail';
import FollowupsPage from './pages/followups/FollowupsPage';
import ProductsPage from './pages/products/ProductsPage';
import InventoryPage from './pages/inventory/InventoryPage';
import OrdersPage from './pages/orders/OrdersPage';
import OrderForm from './pages/orders/OrderForm';
import OrderDetail from './pages/orders/OrderDetail';
import PaymentsPage from './pages/payments/PaymentsPage';
import ApprovalsPage from './pages/payments/ApprovalsPage';
import QrPage from './pages/qr/QrPage';
import ScannerPage from './pages/scanner/ScannerPage';
import PublicScan from './pages/scan/PublicScan';
import ShippingPage from './pages/shipping/ShippingPage';
import ReturnsPage from './pages/returns/ReturnsPage';
import ReordersPage from './pages/reorders/ReordersPage';
import EmployeesPage from './pages/employees/EmployeesPage';
import TargetsPage from './pages/targets/TargetsPage';
import MyTarget from './pages/targets/MyTarget';
import PayrollPage from './pages/payroll/PayrollPage';
import ReportsPage from './pages/reports/ReportsPage';
import ActivityPage from './pages/activity/ActivityPage';
import SettingsPage from './pages/settings/SettingsPage';

function Guard({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function Guest({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-slate-500">Loading…</div>;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/scan/:token" element={<PublicScan />} />
          <Route path="/login" element={<Guest><Login /></Guest>} />
          <Route path="/" element={<Guard><Dashboard /></Guard>} />
          <Route path="/customers" element={<Guard><CustomersPage /></Guard>} />
          <Route path="/customers/:id" element={<Guard><CustomerDetail /></Guard>} />
          <Route path="/leads" element={<Guard><LeadsPage /></Guard>} />
          <Route path="/leads/:id" element={<Guard><LeadDetail /></Guard>} />
          <Route path="/followups" element={<Guard><FollowupsPage /></Guard>} />
          <Route path="/products" element={<Guard><ProductsPage /></Guard>} />
          <Route path="/inventory" element={<Guard><InventoryPage /></Guard>} />
          <Route path="/orders" element={<Guard><OrdersPage /></Guard>} />
          <Route path="/orders/new" element={<Guard><OrderForm /></Guard>} />
          <Route path="/orders/:id" element={<Guard><OrderDetail /></Guard>} />
          <Route path="/payments" element={<Guard><PaymentsPage /></Guard>} />
          <Route path="/approvals" element={<Guard><ApprovalsPage /></Guard>} />
          <Route path="/qr" element={<Guard><QrPage /></Guard>} />
          <Route path="/scanner" element={<Guard><ScannerPage /></Guard>} />
          <Route path="/shipping" element={<Guard><ShippingPage /></Guard>} />
          <Route path="/returns" element={<Guard><ReturnsPage /></Guard>} />
          <Route path="/reorders" element={<Guard><ReordersPage /></Guard>} />
          <Route path="/employees" element={<Guard><EmployeesPage /></Guard>} />
          <Route path="/targets" element={<Guard><TargetsPage /></Guard>} />
          <Route path="/my-target" element={<Guard><MyTarget /></Guard>} />
          <Route path="/payroll" element={<Guard><PayrollPage /></Guard>} />
          <Route path="/reports" element={<Guard><ReportsPage /></Guard>} />
          <Route path="/activity" element={<Guard><ActivityPage /></Guard>} />
          <Route path="/settings" element={<Guard><SettingsPage /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
