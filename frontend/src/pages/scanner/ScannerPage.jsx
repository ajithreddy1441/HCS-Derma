import { useEffect, useRef, useState } from 'react';
import api from '../../api/client';
import { inputClass } from '../../components/ui/Field';
import ScanResult from '../../components/scan/ScanResult';

export default function ScannerPage() {
  const ref = useRef(null);
  const [value, setValue] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('Product scanned but not packed');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { ref.current?.focus(); }, [data]);

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
    } catch {
      setData(null);
      setErr('Not found. Scan the QR, QR number, or enter an order ID such as ORD000005.');
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
      <p className="text-sm text-slate-500">Scan a QR (or paste the QR link), QR number, barcode, SKU, or order ID. Order, customer and shipping details load automatically.</p>
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
          placeholder="Scan QR / QR number / barcode / SKU / order ID"
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
              <p className="text-xs text-slate-500">Use this if the QR was scanned but the product is not packed. The note goes to the accountant dashboard and admin.</p>
              <textarea className={`${inputClass} mt-2`} value={note} onChange={(e) => setNote(e.target.value)} />
              <button type="button" className="mt-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white" onClick={reportNotPacked}>
                Send note to accountant
              </button>
              {saved && <p className="mt-2 text-sm text-emerald-700">{saved}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
