import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/client';
import { fileUrl } from '../../api/client';
import Badge from '../../components/ui/Badge';
import Timeline from '../../components/ui/Timeline';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { Field, inputClass } from '../../components/ui/Field';
import { money, dt } from '../../utils/format';
import Skeleton from '../../components/ui/Skeleton';
import { useAuth } from '../../context/AuthContext';

const FLOW = ['Order Created', 'Payment Pending', 'Payment Uploaded', 'Payment Approved', 'Order Confirmed', 'Processing', 'Shipment Created', 'Dispatched', 'In Transit', 'Out For Delivery', 'Delivered'];

export default function OrderDetail() {
  const { id } = useParams();
  const { can, user } = useAuth();
  const [data, setData] = useState(null);
  const [pay, setPay] = useState(false);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(null);

  function load() {
    setErr('');
    api.get(`/orders/${id}`).then(({ data: d }) => setData(d.data)).catch((e) => {
      setErr(e.response?.data?.message || 'Could not load this order');
    });
  }
  useEffect(load, [id]);

  if (err) return <div className="rounded-2xl bg-rose-50 p-6 text-rose-700">{err} <button className="underline" type="button" onClick={load}>Retry</button></div>;
  if (!data) return <Skeleton />;
  const { order: o, items, payments, shipment, tracking, activity, qrs } = data;
  const current = o.order_status;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{o.public_id}</h1>
          <p className="text-sm text-slate-500">{dt(o.order_date)} · {o.telecaller_name} ({o.employee_code})</p>
        </div>
        <div className="flex gap-2">
          <Badge status={o.payment_status} />
          <Badge status={o.order_status} />
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {FLOW.map((s) => (
          <span key={s} className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${s.toLowerCase().includes(current.replace(/_/g, ' ')) ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-slate-200'}`}>{s}</span>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Customer</h2>
          <p className="mt-2 text-sm">{o.customer_name} · {o.customer_code}</p>
          <p className="text-sm text-slate-500">{o.mobile}</p>
          <p className="text-sm text-slate-500">{o.address}</p>
          <p className="text-sm text-slate-500">{o.city}, {o.state} — {o.pincode}</p>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Totals</h2>
          <p className="mt-2 text-sm">Subtotal {money(o.subtotal)} · Discount {money(o.discount)} · Tax {money(o.tax)}</p>
          <p className="text-lg font-semibold">{money(o.total)}</p>
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Products</h2>
        {items.map((it) => (
          <div key={it.id} className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3 text-sm">
            {it.image_path && <img src={fileUrl(it.image_path)} alt="" className="h-12 w-12 rounded-lg object-cover" />}
            <div className="flex-1">
              <p className="font-medium">{it.product_name}</p>
              <p className="text-slate-500">{it.product_code} · {it.sku}</p>
            </div>
            <p>Qty {it.quantity}</p>
            <p>{money(it.total)}</p>
          </div>
        ))}
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex justify-between">
          <h2 className="font-semibold">Payments</h2>
          {can('payments.upload') && o.payment_status !== 'approved' && (
            <button className="text-sm font-semibold text-brand-600" onClick={() => setPay(true)}>Upload proof</button>
          )}
        </div>
        {payments.map((p) => (
          <div key={p.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
            <span>{p.public_id} · {p.payment_mode} · UTR {p.utr || '—'}</span>
            <span>{money(p.amount)}</span>
            <Badge status={p.status} />
            {p.screenshot_path && <a className="text-brand-600" href={fileUrl(p.screenshot_path)} target="_blank" rel="noreferrer">Screenshot</a>}
            {p.status === 'payment_mismatch' && <span className="text-rose-600">Diff {money(p.mismatch_difference)}</span>}
          </div>
        ))}
        {pay && (
          <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            fd.append('order_id', o.id);
            await api.post('/payments', fd);
            setPay(false);
            load();
          }}>
            <Field label="Amount"><input name="amount" type="number" step="0.01" className={inputClass} required /></Field>
            <Field label="Mode">
              <select name="payment_mode" className={inputClass}>
                {['upi', 'bank_transfer', 'cash', 'card', 'other'].map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="UTR"><input name="utr" className={inputClass} /></Field>
            <Field label="Screenshot"><input name="screenshot" type="file" accept="image/*" /></Field>
            <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Submit</button>
          </form>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-emerald-100 bg-white p-5">
        <h2 className="font-semibold">Assigned QR numbers</h2>
        <p className="mt-2 text-sm">
          {(qrs || []).some((q) => q.qr_number != null)
            ? qrs.filter((q) => q.qr_number != null).map((q) => `SKU ${q.qr_number}`).join(', ')
            : 'None assigned. Generate SKUs in QR Generator, then pick them on new orders.'}
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Shipping</h2>
        {shipment ? (
          <div className="mt-2">
            <p className="text-sm">Shiprocket {shipment.shiprocket_order_id || '—'} · AWB {shipment.awb_number || '—'} · {shipment.courier_partner || '—'} · <Badge status={shipment.tracking_status} /></p>
            {can('shipments.manage') && String(shipment.shiprocket_order_id || '').startsWith('MOCK-') && (
              <button className="mt-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => setConfirm('ship')}>Send to Shiprocket now</button>
            )}
          </div>
        ) : can('shipments.manage') && o.payment_status === 'approved' && (
          <button className="mt-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white" onClick={() => setConfirm('ship')}>Create Shiprocket shipment</button>
        )}
        {tracking?.map((t) => <p key={t.id} className="text-xs text-slate-500">{dt(t.created_at)} · {t.status} · {t.message}</p>)}
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Activity</h2>
        <div className="mt-3"><Timeline items={activity} /></div>
      </section>

      {can('orders.edit') && user.role === 'admin' && (
        <div className="mt-4 flex gap-2">
          <button className="rounded-xl border px-3 py-2 text-sm" onClick={() => setConfirm('cancel')}>Cancel order</button>
        </div>
      )}

      <ConfirmModal
        open={confirm === 'ship'}
        title="Create shipment"
        message="Sends this order to your Shiprocket account (customer, products, amount)."
        onClose={() => setConfirm(null)}
        onConfirm={async () => { await api.post('/shipments', { order_id: o.id, force: true }, { timeout: 35000 }); setConfirm(null); load(); }}
      />
      <ConfirmModal
        open={confirm === 'cancel'}
        danger
        title="Cancel order"
        message="Inventory is restored only if this order was already confirmed."
        onClose={() => setConfirm(null)}
        onConfirm={async () => { await api.put(`/orders/${o.public_id}/status`, { status: 'cancelled' }); setConfirm(null); load(); }}
      />
    </div>
  );
}
