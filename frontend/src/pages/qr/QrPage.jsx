import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import api from '../../api/client';
import { Field, inputClass } from '../../components/ui/Field';

export default function QrPage() {
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ product_id: '', quantity: 100 });
  const sheet = useRef(null);

  function load() {
    api.get('/products', { params: { limit: 100 } }).then(({ data }) => setProducts(data.data.items));
    api.get('/qr').then(({ data }) => setItems(data.data.items || [])).catch(() => setItems([]));
  }

  useEffect(load, []);

  async function generate(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api.post('/qr/generate', {
        qr_type: form.product_id ? 'PRODUCT_UNIT' : 'PRODUCT',
        quantity: Number(form.quantity) || 100,
        ...(form.product_id ? { product_id: form.product_id } : {}),
      });
      const { data } = await api.get('/qr');
      setItems(data.data.items || []);
    } catch (ex) {
      setErr(ex.response?.data?.message || 'Could not generate QR codes');
    } finally {
      setBusy(false);
    }
  }

  async function remove(q) {
    if (!window.confirm(`Delete SKU ${q.qr_number}? It will no longer appear on new orders.`)) return;
    await api.delete(`/qr/${q.public_id || q.publicId || q.id}`);
    setItems((prev) => prev.filter((x) => x.id !== q.id && x.public_id !== q.public_id));
  }

  function downloadOne(token) {
    const canvas = document.getElementById(`qr-${token}`);
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `SKU-${token}.png`;
    a.click();
  }

  function printSheet() {
    const w = window.open('', '_blank');
    w.document.write(sheet.current.innerHTML);
    w.document.close();
    w.print();
  }

  const availableCount = items.filter((q) => !q.order_code && q.status === 'ACTIVE').length;

  return (
    <div>
      <h1 className="text-2xl font-semibold">QR Generator</h1>
      <p className="mt-1 text-sm text-slate-500">
        Each click creates sequential SKU numbers starting from 1 (then 101, 201, …). Generate before orders.
        Unused SKUs stay available for the next order. Deleted SKUs are removed from order selection.
      </p>
      <form className="mt-4 grid gap-3 rounded-2xl border border-emerald-100 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4" onSubmit={generate}>
        <Field label="Product (optional)">
          <select className={inputClass} value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
            <option value="">Any product — SKU 1, 2, 3…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
          </select>
        </Field>
        <Field label="How many">
          <input
            type="number"
            min="1"
            max="500"
            className={inputClass}
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
          />
        </Field>
        <div className="flex items-end gap-2 sm:col-span-2">
          <button disabled={busy} className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? 'Generating…' : `Generate ${form.quantity || 100} QR`}
          </button>
          <button type="button" className="rounded-full border border-slate-200 px-4 py-2 text-sm" onClick={printSheet}>Print / download sheet</button>
        </div>
      </form>
      {err && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
      <p className="mt-4 text-sm text-slate-500">{availableCount} unused SKU(s) ready for orders · {items.length} total</p>
      <div ref={sheet} className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((q) => {
          const sku = q.qr_number ?? q.sku;
          const assigned = Boolean(q.order_code);
          return (
            <div key={q.token || q.public_id} className="flex flex-col items-center rounded-2xl border border-emerald-100 bg-white p-4 text-center">
              {(q.url || q.token) && (
                <div className="flex w-full justify-center">
                  <QRCodeCanvas id={`qr-${q.token}`} value={q.url || `${window.location.origin}/scan/${q.token}`} size={140} />
                </div>
              )}
              <p className="mt-2 text-lg font-semibold text-brand-600">SKU {sku}</p>
              <p className="text-xs text-slate-500">
                {assigned ? `Assigned ${q.order_code}` : 'Available for orders'}
                {q.product_name ? ` · ${q.product_name}` : ''}
              </p>
              <div className="mt-2 flex justify-center gap-3">
                {q.token && (
                  <button type="button" className="text-xs font-semibold text-brand-600" onClick={() => downloadOne(q.token)}>Download</button>
                )}
                {!assigned && (
                  <button type="button" className="text-xs font-semibold text-rose-600" onClick={() => remove(q)}>Delete</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
