import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  HiOutlineHome, HiOutlineUsers, HiOutlinePhone, HiOutlineShoppingCart, HiOutlineCreditCard,
  HiOutlineClipboardCheck, HiOutlineCalendar, HiOutlineCube, HiOutlineArchive, HiOutlineQrcode,
  HiOutlineTruck, HiOutlineRefresh, HiOutlineReply, HiOutlineIdentification, HiOutlineFlag,
  HiOutlineCash, HiOutlineChartBar, HiOutlineClock, HiOutlineCog, HiOutlineBell, HiOutlineLogout,
  HiOutlineMenu, HiOutlineSearch,
} from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import api from '../api/client';

const NAV = [
  { to: '/', label: 'Dashboard', icon: HiOutlineHome, roles: ['admin', 'telecaller', 'accountant'] },
  { to: '/customers', label: 'Customers', icon: HiOutlineUsers, perm: 'customers.view' },
  { to: '/leads', label: 'Leads', icon: HiOutlinePhone, perm: 'leads.view' },
  { to: '/orders', label: 'Orders', icon: HiOutlineShoppingCart, perm: 'orders.view' },
  { to: '/payments', label: 'Payments', icon: HiOutlineCreditCard, perm: 'payments.view' },
  { to: '/approvals', label: 'Payment Approvals', icon: HiOutlineClipboardCheck, perm: 'payments.approve' },
  { to: '/followups', label: 'Follow-ups', icon: HiOutlineCalendar, perm: 'followups.view' },
  { to: '/products', label: 'Products', icon: HiOutlineCube, perm: 'products.view' },
  { to: '/inventory', label: 'Inventory', icon: HiOutlineArchive, perm: 'inventory.view' },
  { to: '/qr', label: 'QR Generator', icon: HiOutlineQrcode, perm: 'qr.manage' },
  { to: '/scanner', label: 'Scan Product', icon: HiOutlineQrcode, roles: ['admin', 'telecaller', 'accountant'] },
  { to: '/shipping', label: 'Delivery & Tracking', icon: HiOutlineTruck, perm: 'shipments.view' },
  { to: '/returns', label: 'Returns', icon: HiOutlineReply, perm: 'returns.view' },
  { to: '/reorders', label: 'Reorders', icon: HiOutlineRefresh, perm: 'reorders.view' },
  { to: '/employees', label: 'Employees', icon: HiOutlineIdentification, perm: 'employees.view' },
  { to: '/targets', label: 'Targets', icon: HiOutlineFlag, perm: 'targets.manage' },
  { to: '/my-target', label: 'My Target', icon: HiOutlineFlag, roles: ['telecaller', 'admin'] },
  { to: '/payroll', label: 'Payroll', icon: HiOutlineCash, perm: 'payroll.manage' },
  { to: '/reports', label: 'Reports', icon: HiOutlineChartBar, perm: 'reports.view' },
  { to: '/activity', label: 'Activity Log', icon: HiOutlineClock, perm: 'activity.view' },
  { to: '/settings', label: 'Settings', icon: HiOutlineCog, perm: 'settings.manage' },
];

const ROUTES = {
  customer: '/customers/', lead: '/leads', order: '/orders/', payment: '/payments',
  employee: '/employees', product: '/products', shipment: '/shipping', qr: '/qr', unit: '/scanner',
};

export default function AppLayout({ children }) {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [results, setResults] = useState([]);
  const [notes, setNotes] = useState([]);
  const [unread, setUnread] = useState(0);
  const [bell, setBell] = useState(false);
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const initials = (user?.employee_name || 'U').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const items = useMemo(
    () => NAV.filter((n) => (n.perm ? can(n.perm) : n.roles?.includes(user?.role))),
    [user, can]
  );

  useEffect(() => {
    if (dq.length < 2) { setResults([]); return; }
    api.get('/search', { params: { q: dq } }).then(({ data }) => setResults(data.data.items || [])).catch(() => setResults([]));
  }, [dq]);

  useEffect(() => {
    api.get('/notifications').then(({ data }) => {
      setNotes(data.data.items || []);
      setUnread(data.data.unread || 0);
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#f3f6f4]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-brand-600 text-white transition md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xs font-bold text-brand-600">HCS</div>
          <div>
            <p className="text-sm font-semibold leading-tight">HCS DERMA</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/70">CRM suite</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {items.map((n) => {
            const Icon = n.icon;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-full px-3 py-2.5 text-sm ${isActive ? 'bg-white/20 font-semibold text-white' : 'text-white/80 hover:bg-white/10'}`
                }
              >
                <Icon className="h-5 w-5" />
                {n.label}
              </NavLink>
            );
          })}
        </nav>
        <button
          onClick={() => logout().then(() => navigate('/login'))}
          className="m-3 flex items-center gap-3 rounded-full px-3 py-2.5 text-sm text-white/90 hover:bg-white/10"
        >
          <HiOutlineLogout className="h-5 w-5" /> Logout
        </button>
      </aside>

      <div className="md:pl-[260px]">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-emerald-100 bg-white/95 px-4 py-3 backdrop-blur">
          <button className="rounded-lg p-2 text-brand-600 md:hidden" onClick={() => setOpen(true)}>
            <HiOutlineMenu className="h-6 w-6" />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-600">HCS DERMA</p>
            <p className="text-xs text-slate-400">{today}</p>
          </div>
          <div className="relative min-w-[10rem] flex-1">
            <HiOutlineSearch className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search invoice, customer, phone, QR…"
              className="w-full rounded-full border border-slate-200 bg-[#f3f6f4] py-2 pl-10 pr-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-brand-500"
            />
            {results.length > 0 && (
              <div className="absolute mt-1 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                {results.map((r, i) => (
                  <button
                    key={`${r.type}-${r.id}-${i}`}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-emerald-50"
                    onClick={() => {
                      const base = ROUTES[r.type] || '/';
                      navigate(base.endsWith('/') ? `${base}${r.id}` : base);
                      setQ('');
                      setResults([]);
                    }}
                  >
                    <span className="font-medium">{r.title}</span>
                    <span className="text-xs uppercase text-slate-400">{r.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {can('orders.create') && (
            <button onClick={() => navigate('/orders/new')} className="hidden rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 sm:inline-flex">
              + New Order
            </button>
          )}
          <div className="relative">
            <button onClick={() => setBell(!bell)} className="relative rounded-full p-2 hover:bg-emerald-50">
              <HiOutlineBell className="h-6 w-6 text-slate-600" />
              {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />}
            </button>
            {bell && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                {notes.slice(0, 8).map((n) => (
                  <div key={n.id} className="rounded-xl px-3 py-2 text-sm hover:bg-emerald-50">
                    <p className="font-medium">{n.title}</p>
                    <p className="text-xs text-slate-500">{n.body}</p>
                  </div>
                ))}
                {!notes.length && <p className="px-3 py-6 text-center text-sm text-slate-400">No notifications</p>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">{user?.employee_name}</p>
              <p className="text-xs capitalize text-slate-500">{user?.role}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{initials}</div>
          </div>
        </header>
        <main className="p-4 md:p-6">{children}</main>
      </div>
      {open && <button className="fixed inset-0 z-30 bg-slate-900/40 md:hidden" onClick={() => setOpen(false)} />}
    </div>
  );
}
