import { useEffect, useRef, useState } from 'react';
import api from '../../api/client';
import { fileUrl } from '../../api/client';
import Badge from '../../components/ui/Badge';
import { inputClass } from '../../components/ui/Field';

export default function ScannerPage() {
  const ref = useRef(null);
  const [value, setValue] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('Product scanned but not packed');
  const [saved, setSaved] = useState('');

  useEffect(() => { ref.current?.focus(); }, [data]);

  async function search(v) {
    const q = (v || value).trim();
    if (!q) return;
    setErr('');
    setSaved('');
    try {
      const { data: d } = await api.get(`/scan/${encodeURIComponent(q)}`);
      setData(d.data);
      setValue('');
    } catch {
      setData(null);
      setErr('Not found');
    }
    ref.current?.focus();
  }

  async function reportNotPacked() {
    const qr_number = data?.qr?.qr_number || data?.qr_number;
    await api.post('/scan/issue', {
      qr_number,
      note,
      issue_type: 'not_packed',
    });
    setSaved('Note sent to accountant dashboard');
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Scan product</h1>
      <p className="text-sm text-slate-500">Scan QR, QR number, barcode or SKU. Scan tallies to the assigned order.</p>
      <input
        ref={ref}
        className={`${inputClass} mt-4 text-lg`}
        placeholder="Scan QR / QR number / barcode / SKU"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && search()}
      />
      {err && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-rose-700">{err}</p>}
      {data && (
        <div className="mt-6 space-y-4 rounded-2xl border border-emerald-100 bg-white p-5">
          {(data.qr_number || data.qr?.qr_number) && <p className="text-sm font-semibold text-brand-600">QR number {data.qr_number || data.qr?.qr_number}</p>}
          {data.product && (
            <div className="flex gap-4">
              {data.product.image_path && <img src={fileUrl(data.product.image_path)} alt="" className="h-24 w-24 rounded-xl object-cover" />}
              <div>
                <p className="text-lg font-semibold">{data.product.name}</p>
                <p className="text-sm text-slate-500">{data.product.public_id} · {data.product.sku} · stock {data.product.available_quantity}</p>
              </div>
            </div>
          )}
          {data.order && <p className="text-sm">Order {data.order.public_id} · <Badge status={data.order.order_status} /></p>}
          {!data.order && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">This QR is not assigned to an order yet.</p>}
          {data.customer && <p className="text-sm">Customer {data.customer.name} · {data.customer.mobile}</p>}
          {data.delivery && <p className="text-sm">Delivery <Badge status={data.delivery.tracking_status} /> · {data.delivery.awb_number}</p>}
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <p className="text-sm font-semibold">Packing issue</p>
            <p className="text-xs text-slate-500">Use this if the QR was scanned but the product is not packed. The note goes to the accountant dashboard and admin.</p>
            <textarea className={`${inputClass} mt-2`} value={note} onChange={(e) => setNote(e.target.value)} />
            <button type="button" className="mt-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white" onClick={reportNotPacked}>
              Send note to accountant
            </button>
            {saved && <p className="mt-2 text-sm text-emerald-700">{saved}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
