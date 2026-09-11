import { useEffect, useRef, useState } from 'react';
import api from '../../api/client';
import { inputClass } from '../../components/ui/Field';
import ScanResult from '../../components/scan/ScanResult';
import { dt } from '../../utils/format';

export default function ScannerPage() {
  const ref = useRef(null);
  const [value, setValue] = useState('');
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('Product scanned but not packed');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadHistory() {
    try {
      const { data: d } = await api.get('/scan/history');
      setHistory(d.data.items || []);
    } catch {
      setHistory([]);
    }
  }

  useEffect(() => {
    loadHistory();
    ref.current?.focus();
  }, []);

  async function search(v) {
    const q = (v || value).trim();
    if (!q) return;
    setErr('');
    setSaved('');
    setBusy(true);
    try {
      const { data: d } = await api.get(`/scan/${encodeURIComponent(q)}`);
      setData(d.data);
      setValue('');
      await loadHistory();
    } catch {
      setData(null);
      setErr('Not found. Scan the QR, QR number, product, or enter an order ID such as ORD000005.');
    } finally {
      setBusy(false);
      ref.current?.focus();
    }
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
      <p className="text-sm text-slate-500">Scan a product QR to see product details. Search by order ID to open that order. All previous scans stay listed below.</p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <input
          ref={ref}
          className={`${inputClass} text-lg`}
          placeholder="Scan QR / product / order ID"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text');
            if (text) setTimeout(() => search(text), 0);
          }}
        />
        <button type="submit" disabled={busy} className="shrink-0 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? '…' : 'Search'}
        </button>
      </form>
      {err && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-rose-700">{err}</p>}

      {data && (
        <div className="mt-6 space-y-4">
          <ScanResult data={data} />
          {(data.qr_number || data.qr?.qr_number) && (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-sm font-semibold">Packing issue</p>
              <p className="text-xs text-slate-500">Use this if the QR was scanned but the product is not packed.</p>
              <textarea className={`${inputClass} mt-2`} value={note} onChange={(e) => setNote(e.target.value)} />
              <button type="button" className="mt-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white" onClick={reportNotPacked}>
                Send note to accountant
              </button>
              {saved && <p className="mt-2 text-sm text-emerald-700">{saved}</p>}
            </div>
          )}
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Scanned products</h2>
        <p className="text-sm text-slate-500">Phone QR scans and CRM scans both appear here, including QRs already assigned to orders. Click a row to open details.</p>
        <div className="mt-3 space-y-2">
          {history.length === 0 && (
            <p className="rounded-2xl bg-white p-4 text-sm text-slate-500 ring-1 ring-slate-100">No products scanned yet.</p>
          )}
          {history.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => search(h.lookup_value || String(h.qr_number || h.order_public_id || ''))}
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-brand-600"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{h.product_name || h.order_public_id || 'Scan'}</p>
                  <p className="text-sm text-slate-500">
                    {h.qr_number != null ? `QR ${h.qr_number}` : h.kind}
                    {h.product_sku ? ` · ${h.product_sku}` : ''}
                    {h.order_public_id ? ` · ${h.order_public_id}` : ''}
                  </p>
                  {h.customer_name && <p className="text-xs text-slate-400">{h.customer_name}</p>}
                </div>
                <div className="text-right">
                  {h.order_public_id && <p className="text-xs font-semibold text-brand-600">{h.order_public_id}</p>}
                  <p className="mt-1 text-xs text-slate-400">{dt(h.created_at)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
