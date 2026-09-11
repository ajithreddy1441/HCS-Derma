import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { money } from '../../utils/format';
import Skeleton from '../../components/ui/Skeleton';

const COLORS = ['#1a4d2e', '#2d6a4f', '#f59e0b', '#ef4444', '#40916c', '#d97706'];

function Card({ label, value, to, warn }) {
  const inner = (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${warn ? 'border-orange-200' : 'border-emerald-100'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${warn ? 'text-orange-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function Welcome({ name, role }) {
  return (
    <div className="rounded-2xl bg-brand-600 px-6 py-7 text-white shadow-sm">
      <h1 className="text-2xl font-semibold">Welcome back, {name?.split(' ')[0] || 'team'}</h1>
      <p className="mt-1 max-w-2xl text-sm text-white/80">HCS DERMA CRM — leads, orders, payments, QR units and delivery in one place. Role: {role}.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/orders/new" className="rounded-full border border-white/40 px-4 py-2 text-sm font-semibold">Open orders</Link>
        <Link to="/inventory" className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-brand-700">View stock</Link>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState('');

  useEffect(() => {
    const path = user.role === 'accountant' ? '/dashboard/accountant' : user.role === 'telecaller' ? '/dashboard/telecaller' : '/dashboard/admin';
    api.get(path).then(({ data: d }) => setData(d.data)).catch((e) => setErr(e.response?.data?.message || 'Failed to load'));
  }, [user]);

  if (err) return <div className="rounded-2xl bg-rose-50 p-6 text-rose-700">{err} <button className="underline" onClick={() => location.reload()}>Retry</button></div>;
  if (!data) return <Skeleton rows={8} />;

  if (user.role === 'telecaller') {
    const c = data.cards;
    return (
      <div>
        <Welcome name={user.employee_name} role="Telecaller" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white" to="/leads">New Lead</Link>
          <Link className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold" to="/customers">New Customer</Link>
          <Link className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold" to="/orders/new">New Order</Link>
          <Link className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold" to="/followups">Follow-up</Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card label="Today's follow-ups" value={c.todays_followups} to="/followups" />
          <Card label="Overdue" value={c.overdue_followups} to="/followups" warn />
          <Card label="Upcoming" value={c.upcoming_followups} />
          <Card label="New leads" value={c.new_leads} to="/leads" />
          <Card label="My customers" value={c.my_customers} to="/customers" />
          <Card label="My orders" value={c.my_orders} to="/orders" />
          <Card label="Payment pending" value={c.payment_pending} to="/payments" />
          <Card label="Payment approved" value={c.payment_approved} />
          <Card label="Approved orders" value={c.approved_orders} />
          <Card label="Reorder customers" value={c.reorder_customers} to="/reorders" />
        </div>
        <section className="mt-6 rounded-2xl border border-orange-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Overdue follow-ups</h2>
              <p className="text-sm text-slate-500">These details can be sent to admin as a notification.</p>
            </div>
            <button
              className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
              onClick={async () => {
                const { data: d } = await api.post('/followups/alert-admin');
                setSent(`Sent ${d.data.count} overdue record(s) to admin`);
              }}
            >
              Send overdue to admin
            </button>
          </div>
          {sent && <p className="mt-2 text-sm text-emerald-700">{sent}</p>}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400"><tr><th className="py-2">Name</th><th>Mobile</th><th>Due</th><th>Reason</th></tr></thead>
              <tbody>
                {(data.overdue || []).map((o) => (
                  <tr key={o.id} className="border-t border-slate-100">
                    <td className="py-2 font-medium">{o.party_name}</td>
                    <td>{o.mobile}</td>
                    <td>{String(o.followup_date).slice(0, 10)}</td>
                    <td>{o.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.overdue?.length && <p className="py-6 text-center text-sm text-slate-400">No overdue follow-ups</p>}
          </div>
        </section>
      </div>
    );
  }

  if (user.role === 'accountant') {
    const c = data.cards;
    return (
      <div>
        <Welcome name={user.employee_name} role="Accountant" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card label="Today's payments" value={c.todays_payments} />
          <Card label="Pending verification" value={c.pending_verification} to="/approvals" warn />
          <Card label="Approved" value={c.approved_payments} />
          <Card label="Rejected" value={c.rejected_payments} />
          <Card label="Mismatch" value={c.payment_mismatch} to="/approvals" warn />
          <Card label="Total collection" value={money(c.total_collection)} />
          <Card label="Confirmed orders" value={c.confirmed_orders} />
          <Card label="Cancelled" value={c.cancelled_orders} />
          <Card label="Refunds" value={money(c.refunds)} />
        </div>
        <section className="mt-6 rounded-2xl border border-orange-200 bg-white p-5">
          <h2 className="text-lg font-semibold">QR scan notes — not packed</h2>
          <p className="text-sm text-slate-500">When a product is scanned but packing is incomplete, the note appears here.</p>
          <div className="mt-4 space-y-2">
            {(data.scan_issues || []).map((s) => (
              <div key={s.id} className="rounded-xl bg-orange-50 px-4 py-3 text-sm">
                <p className="font-semibold">QR {s.qr_number} · {s.product_name || 'Product'} · {s.order_code || 'Unassigned'}</p>
                <p className="text-slate-600">{s.note}</p>
                <p className="text-xs text-slate-400">{s.created_at}</p>
              </div>
            ))}
            {!data.scan_issues?.length && <p className="py-4 text-sm text-slate-400">No packing issues logged.</p>}
          </div>
        </section>
        <div className="mt-6 h-72 rounded-2xl border border-emerald-100 bg-white p-4">
          <p className="mb-2 text-sm font-semibold">Payment mode breakdown</p>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={data.modes || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#1a4d2e" radius={6} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  const c = data.cards;
  const s = data.sales;
  const charts = data.charts;
  return (
    <div>
      <Welcome name={user.employee_name} role="Admin" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Today's sales" value={money(s.today)} />
        <Card label="This week" value={money(s.week)} />
        <Card label="This month" value={money(s.month)} />
        <Card label="This year" value={money(s.year)} />
        <Card label="Total sales" value={money(s.total)} />
        <Card label="Total orders" value={s.orders} />
        <Card label="Avg order value" value={money(s.aov)} />
        <Card label="Overdue follow-ups" value={c.overdue_followups} warn />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {Object.entries({
          'New leads': c.new_leads, 'New customers': c.new_customers, 'New orders': c.new_orders,
          'Pending payments': c.pending_payments, 'Approved payments': c.approved_payments,
          'Rejected payments': c.rejected_payments, 'Payment mismatch': c.payment_mismatch,
          Processing: c.processing_orders, Dispatched: c.dispatched_orders, 'In transit': c.in_transit,
          Delivered: c.delivered_orders, Cancelled: c.cancelled_orders, Returned: c.returned_orders,
          "Today's follow-ups": c.todays_followups, Reorders: c.reorder_followups,
          'Low stock': c.low_stock, 'Out of stock': c.out_of_stock,
        }).map(([k, v]) => (
          <Card key={k} label={k} value={v} />
        ))}
      </div>
      {(data.overdue || []).length > 0 && (
        <section className="mt-6 rounded-2xl border border-orange-200 bg-white p-5">
          <h2 className="font-semibold">Overdue from telecallers</h2>
          <div className="mt-3 overflow-x-auto text-sm">
            <table className="w-full text-left">
              <thead className="text-xs uppercase text-slate-400"><tr><th className="py-2">Customer</th><th>Mobile</th><th>Due</th><th>Telecaller</th></tr></thead>
              <tbody>
                {data.overdue.map((o, i) => (
                  <tr key={o.public_id || i} className="border-t">
                    <td className="py-2">{o.party_name}</td>
                    <td>{o.mobile}</td>
                    <td>{String(o.followup_date).slice(0, 10)}</td>
                    <td>{o.telecaller_name} {o.employee_code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <ChartCard title="Purchase vs sales style — daily sales">
          <BarChart data={charts.daily}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="d" hide />
            <YAxis />
            <Tooltip />
            <Bar dataKey="sales" fill="#1a4d2e" radius={4} />
          </BarChart>
        </ChartCard>
        <ChartCard title="Sales trend — monthly">
          <BarChart data={charts.monthly}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="m" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="sales" fill="#40916c" radius={4} />
          </BarChart>
        </ChartCard>
        <ChartCard title="Order status">
          <PieChart>
            <Pie data={charts.orderStatus} dataKey="value" nameKey="name" outerRadius={90}>
              {(charts.orderStatus || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ChartCard>
        <ChartCard title="Payment status">
          <PieChart>
            <Pie data={charts.paymentStatus} dataKey="value" nameKey="name" outerRadius={90}>
              {(charts.paymentStatus || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="h-80 rounded-2xl border border-emerald-100 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-600">Chart</span>
      </div>
      <ResponsiveContainer width="100%" height="85%">{children}</ResponsiveContainer>
    </div>
  );
}
