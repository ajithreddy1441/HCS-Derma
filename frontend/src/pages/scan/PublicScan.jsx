import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { HiOutlineLocationMarker, HiOutlineShoppingBag, HiOutlineTruck, HiOutlineUser } from 'react-icons/hi';
import Badge from '../../components/ui/Badge';
import { fileUrl } from '../../api/client';
import { dt, money } from '../../utils/format';

const base = import.meta.env.VITE_API_URL || '/api';

function Row({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[60%] text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}

function Card({ icon: Icon, title, children }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_8px_30px_rgba(26,77,46,0.06)] ring-1 ring-emerald-900/5">
      <div className="mb-3 flex items-center gap-2">
        {Icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <h2 className="text-sm font-semibold tracking-wide text-brand-700">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function PublicScan() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${base}/scan/${encodeURIComponent(token)}`)
      .then(({ data: d }) => setData(d.data))
      .catch(() => setErr('QR not found or inactive'))
      .finally(() => setLoading(false));
  }, [token]);

  const ship = data?.shipping;
  const shipLine = [ship?.address, ship?.city, ship?.state, ship?.pincode].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-[#eef4f0]">
      <header className="bg-brand-600 text-white shadow-lg">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-5 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xs font-bold tracking-wide text-brand-600 shadow-sm">
            HCS
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold leading-tight">HCS DERMA</p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/70">Product status</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {loading && (
          <div className="space-y-3">
            <div className="h-28 animate-pulse rounded-2xl bg-white" />
            <div className="h-40 animate-pulse rounded-2xl bg-white" />
            <div className="h-40 animate-pulse rounded-2xl bg-white" />
          </div>
        )}

        {err && <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-100">{err}</p>}

        {data && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl bg-brand-600 p-5 text-white shadow-md">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">Scanned unit</p>
              <p className="mt-1 text-xl font-semibold">{data.order?.public_id || data.product?.name || 'HCS DERMA'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.order && <Badge status={data.order.order_status} />}
                {data.order?.payment_status && <Badge status={data.order.payment_status} />}
                {data.packed_status && <Badge status={data.packed_status} />}
              </div>
              {data.qr_number != null && <p className="mt-3 text-sm text-white/80">QR {data.qr_number}</p>}
            </div>

            {data.product && (
              <Card icon={HiOutlineShoppingBag} title="Product">
                <div className="flex gap-4">
                  {data.product.image_path && (
                    <img src={fileUrl(data.product.image_path)} alt="" className="h-20 w-20 rounded-xl object-cover ring-1 ring-slate-100" />
                  )}
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{data.product.name}</p>
                    <p className="text-sm text-slate-500">
                      {data.product.public_id}
                      {data.product.sku ? ` · ${data.product.sku}` : ''}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {data.order ? (
              <Card icon={HiOutlineShoppingBag} title="Order details">
                <Row label="Order ID" value={data.order.public_id} />
                <Row label="Order date" value={dt(data.order.order_date)} />
                <Row label="Quantity" value={data.order.quantity} />
                <Row label="Order total" value={money(data.order.total)} />
                <div className="mt-1 flex justify-between py-2 text-sm">
                  <span className="text-slate-500">Status</span>
                  <Badge status={data.order.order_status} />
                </div>
                {data.order.items?.length > 0 && (
                  <div className="mt-2 space-y-2 border-t border-slate-100 pt-3">
                    {data.order.items.map((it, i) => (
                      <div key={`${it.sku}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                        <div>
                          <p className="font-medium text-slate-800">{it.product_name}</p>
                          <p className="text-xs text-slate-500">{it.sku}</p>
                        </div>
                        <p className="shrink-0 text-slate-600">× {it.quantity}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ) : (
              <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-100">This QR is not assigned to an order yet.</p>
            )}

            {data.customer && (
              <Card icon={HiOutlineUser} title="Ordered by">
                <Row label="Name" value={data.customer.name} />
                <Row label="Customer ID" value={data.customer.public_id} />
                <Row label="Mobile" value={data.customer.mobile} />
                <Row label="Email" value={data.customer.email} />
                <Row label="City" value={[data.customer.city, data.customer.state].filter(Boolean).join(', ')} />
              </Card>
            )}

            {ship && (ship.name || shipLine) && (
              <Card icon={HiOutlineLocationMarker} title="Shipping details">
                <Row label="Receiver" value={ship.name} />
                <Row label="Mobile" value={ship.mobile} />
                <Row label="Email" value={ship.email} />
                <Row label="Address" value={ship.address} />
                <Row label="City" value={ship.city} />
                <Row label="State" value={ship.state} />
                <Row label="Pincode" value={ship.pincode} />
              </Card>
            )}

            <Card icon={HiOutlineTruck} title="Delivery">
              {data.delivery ? (
                <>
                  <div className="mb-1 flex justify-between py-2 text-sm">
                    <span className="text-slate-500">Status</span>
                    <Badge status={data.delivery.tracking_status} />
                  </div>
                  <Row label="Courier" value={data.delivery.courier_partner} />
                  <Row label="AWB" value={data.delivery.awb_number} />
                  <Row label="ETA" value={data.delivery.expected_delivery_date ? dt(data.delivery.expected_delivery_date) : '—'} />
                </>
              ) : (
                <p className="text-sm text-slate-500">Shipment is not created yet.</p>
              )}
            </Card>
          </div>
        )}

        <p className="mt-8 text-center text-[11px] text-slate-400">HCS DERMA · Authenticated product scan</p>
      </main>
    </div>
  );
}
