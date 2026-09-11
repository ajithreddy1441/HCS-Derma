import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/client';
import Badge from '../../components/ui/Badge';
import Timeline from '../../components/ui/Timeline';
import { money, dt } from '../../utils/format';
import Skeleton from '../../components/ui/Skeleton';
import { inputClass } from '../../components/ui/Field';

const TABS = ['Overview', 'Orders', 'Payments', 'Delivery', 'Follow-ups', 'Notes', 'Reorders', 'Returns', 'Activity History'];

export default function CustomerDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('Overview');
  const [note, setNote] = useState('');

  function load() {
    api.get(`/customers/${id}`).then(({ data: d }) => setData(d.data));
  }
  useEffect(load, [id]);

  if (!data) return <Skeleton />;
  const { customer: c, stats } = data;

  return (
    <div>
      <h1 className="text-2xl font-semibold">{c.name}</h1>
      <p className="text-sm text-slate-500">{c.public_id} · {c.mobile} · {c.telecaller_name} ({c.employee_code})</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ['Total orders', stats.total_orders],
          ['Total sales', money(stats.total_sales)],
          ['Payments', money(stats.total_payments)],
          ['Pending', money(stats.pending_payments)],
          ['Delivered', stats.delivered_orders],
          ['Cancelled', stats.cancelled_orders],
          ['Returned', stats.returned_orders],
          ['Last order', dt(stats.last_order_date)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-400">{k}</p>
            <p className="mt-1 font-semibold">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${tab === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{t}</button>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        {tab === 'Overview' && (
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            {['store_name', 'email', 'address', 'city', 'state', 'pincode', 'status'].map((k) => (
              <div key={k}><dt className="text-slate-400">{k}</dt><dd className="font-medium">{c[k] || '—'}</dd></div>
            ))}
          </dl>
        )}
        {tab === 'Orders' && data.orders.map((o) => <Row key={o.id} a={o.public_id} b={money(o.total)} c={<Badge status={o.order_status} />} />)}
        {tab === 'Payments' && data.payments.map((p) => <Row key={p.id} a={p.public_id} b={money(p.amount)} c={<Badge status={p.status} />} />)}
        {tab === 'Delivery' && data.deliveries.map((s) => <Row key={s.id} a={s.order_code} b={s.awb_number} c={<Badge status={s.tracking_status} />} />)}
        {tab === 'Follow-ups' && data.followups.map((f) => <Row key={f.id} a={f.public_id} b={f.followup_date} c={<Badge status={f.status} />} />)}
        {tab === 'Reorders' && data.reorders.map((r) => <Row key={r.id} a={r.public_id} b={r.due_date} c={<Badge status={r.status} />} />)}
        {tab === 'Returns' && data.returns.map((r) => <Row key={r.id} a={r.public_id} b={r.reason} c={<Badge status={r.status} />} />)}
        {tab === 'Activity History' && <Timeline items={data.activity} />}
        {tab === 'Notes' && (
          <div>
            <form
              className="mb-4 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                await api.post(`/customers/${id}/notes`, { note });
                setNote('');
                load();
              }}
            >
              <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add note" />
              <button className="rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white">Add</button>
            </form>
            {data.notes.map((n) => (
              <p key={n.id} className="border-t border-slate-100 py-2 text-sm"><span className="font-medium">{n.employee_name}</span> · {n.note}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ a, b, c }) {
  return <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm"><span>{a}</span><span>{b}</span><span>{c}</span></div>;
}
