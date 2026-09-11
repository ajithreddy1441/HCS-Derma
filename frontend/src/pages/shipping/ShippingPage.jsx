import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import Badge from '../../components/ui/Badge';
import { inputClass } from '../../components/ui/Field';
import Skeleton from '../../components/ui/Skeleton';

export default function ShippingPage() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    api.get('/shipments').then(({ data }) => setRows(data.data.items)).catch(() => setRows([]));
  }, []);
  if (rows == null) return <Skeleton />;
  return (
    <div>
      <h1 className="mb-5 text-2xl font-semibold">Delivery & tracking</h1>
      <div className="space-y-3">
        {rows.map((s) => (
          <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link className="font-semibold text-brand-600" to={`/orders/${s.order_code}`}>{s.order_code}</Link>
              <Badge status={s.tracking_status} />
            </div>
            <p className="text-sm text-slate-500">{s.customer_name} · {s.courier_partner || 'Courier TBD'} · AWB {s.awb_number || '—'}</p>
            <p className="text-xs text-slate-400">Expected {s.expected_delivery_date || '—'} · Last update {s.updated_at}</p>
            <form className="mt-3 flex flex-wrap gap-2" onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              await api.put(`/shipments/${s.id}/status`, Object.fromEntries(fd));
              location.reload();
            }}>
              <select name="tracking_status" className={inputClass} defaultValue={s.tracking_status}>
                {['processing', 'ready_to_dispatch', 'dispatched', 'in_transit', 'out_for_delivery', 'delivered', 'delivery_failed', 'returned', 'rto'].map((x) => <option key={x}>{x}</option>)}
              </select>
              <input name="awb_number" placeholder="AWB" className={inputClass} defaultValue={s.awb_number || ''} />
              <input name="courier_partner" placeholder="Courier" className={inputClass} defaultValue={s.courier_partner || ''} />
              <button className="rounded-xl bg-slate-900 px-3 text-sm text-white">Update</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
