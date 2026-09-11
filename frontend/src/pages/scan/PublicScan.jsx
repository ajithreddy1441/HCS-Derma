import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import Badge from '../../components/ui/Badge';

const base = import.meta.env.VITE_API_URL || '/api';

export default function PublicScan() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    axios.get(`${base}/scan/${encodeURIComponent(token)}`).then(({ data: d }) => setData(d.data)).catch(() => setErr('QR not found or inactive'));
  }, [token]);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-[#f4f6fb] p-6">
      <p className="text-xs uppercase tracking-widest text-slate-400">HCS DERMA · Product status</p>
      {err && <p className="mt-6 rounded-2xl bg-rose-50 p-4 text-rose-700">{err}</p>}
      {data && (
        <div className="mt-6 space-y-4">
          {data.product && (
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-lg font-semibold">{data.product.name}</p>
              <p className="text-sm text-slate-500">{data.product.public_id} · {data.product.sku}</p>
            </div>
          )}
          {data.order && (
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="font-semibold">Order {data.order.public_id}</p>
              <Badge status={data.order.order_status} />
            </div>
          )}
          {data.delivery && (
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="font-semibold">Delivery</p>
              <Badge status={data.delivery.tracking_status} />
              <p className="mt-1 text-sm text-slate-500">{data.delivery.courier_partner} · {data.delivery.awb_number}</p>
              <p className="text-sm text-slate-500">ETA {data.delivery.expected_delivery_date || '—'}</p>
            </div>
          )}
          <p className="text-xs text-slate-400">Sensitive customer and payment details are hidden on this public page.</p>
        </div>
      )}
    </div>
  );
}
