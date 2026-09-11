import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { Field, inputClass } from '../../components/ui/Field';

export default function OrderForm() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [available, setAvailable] = useState([]);
  const [customerId, setCustomerId] = useState(sp.get('customer_id') || '');
  const [lines, setLines] = useState([{ product_id: '', quantity: 1, discount: 0, qr_numbers: [] }]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/customers', { params: { limit: 100 } }).then(({ data }) => setCustomers(data.data.items));
    api.get('/products', { params: { limit: 100 } }).then(({ data }) => setProducts(data.data.items));
    api.get('/qr/available').then(({ data }) => setAvailable(data.data.items || [])).catch(() => setAvailable([]));
    if (sp.get('reorder')) {
      api.get(`/reorders/${sp.get('reorder')}/prefill`).then(({ data }) => {
        const r = data.data.reorder;
        setCustomerId(String(r.customer_id));
        setLines([{ product_id: String(r.product_pk || r.product_id || ''), quantity: r.previous_quantity || 1, discount: 0, qr_numbers: [] }]);
      }).catch(() => {});
    }
  }, [sp]);

  const used = new Set(lines.flatMap((l) => l.qr_numbers || []).map(Number));

  function qrsFor(productId, current) {
    return available.filter((q) => {
      const n = Number(q.qr_number);
      const match = !productId || !q.product_id || String(q.product_id) === String(productId);
      return match && (!used.has(n) || current.includes(n));
    });
  }

  async function save(e) {
    e.preventDefault();
    setErr('');
    try {
      const { data } = await api.post('/orders', {
        customer_id: customerId,
        is_reorder: Boolean(sp.get('reorder')),
        parent_order_id: sp.get('parent') || undefined,
        items: lines.filter((l) => l.product_id).map((l) => ({ ...l, qr_numbers: l.qr_numbers })),
      });
      if (sp.get('reorder')) await api.post(`/reorders/${sp.get('reorder')}/convert`, { order_id: data.data.id });
      nav(`/orders/${data.data.public_id}`);
    } catch (ex) {
      setErr(ex.response?.data?.message || 'Could not create order');
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">New order</h1>
      <p className="mt-1 text-sm text-slate-500">Generate SKU QR codes first (100 at a time). Pick unused SKUs here. Leftover SKUs stay available for the next order.</p>
      {err && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
      <form className="mt-4 space-y-4 rounded-2xl border border-emerald-100 bg-white p-5" onSubmit={save}>
        <Field label="Customer">
          <select className={inputClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
            <option value="">Select</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.public_id} · {c.name} · {c.mobile}</option>)}
          </select>
        </Field>
        {lines.map((line, i) => (
          <div key={i} className="space-y-3 rounded-2xl bg-[#f3f6f4] p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Product">
                <select className={inputClass} value={line.product_id} onChange={(e) => {
                  const n = [...lines]; n[i].product_id = e.target.value; n[i].qr_numbers = []; setLines(n);
                }} required>
                  <option value="">Select</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
                </select>
              </Field>
              <Field label="Qty">
                <input type="number" min="1" className={inputClass} value={line.quantity} onChange={(e) => {
                  const n = [...lines]; n[i].quantity = Number(e.target.value); n[i].qr_numbers = []; setLines(n);
                }} />
              </Field>
              <Field label="Discount">
                <input type="number" className={inputClass} value={line.discount} onChange={(e) => {
                  const n = [...lines]; n[i].discount = Number(e.target.value); setLines(n);
                }} />
              </Field>
            </div>
            <Field label={`SKU numbers (pick ${line.quantity})`}>
              <select
                multiple
                size={Math.min(8, Math.max(3, line.quantity + 1))}
                className={inputClass}
                value={line.qr_numbers.map(String)}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map((o) => Number(o.value)).slice(0, line.quantity);
                  const n = [...lines]; n[i].qr_numbers = selected; setLines(n);
                }}
              >
                {qrsFor(line.product_id, line.qr_numbers).map((q) => (
                  <option key={q.qr_number} value={q.qr_number}>SKU {q.qr_number}{q.product_name ? ` · ${q.product_name}` : ''}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">Selected SKUs: {line.qr_numbers.join(', ') || 'none'}. Leftover numbers stay available for the next order.</p>
            </Field>
          </div>
        ))}
        <button type="button" className="text-sm font-semibold text-brand-600" onClick={() => setLines([...lines, { product_id: '', quantity: 1, discount: 0, qr_numbers: [] }])}>+ Add product</button>
        <div><button className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white">Create order</button></div>
      </form>
    </div>
  );
}
