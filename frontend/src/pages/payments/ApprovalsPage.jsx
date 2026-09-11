import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { fileUrl } from '../../api/client';
import Badge from '../../components/ui/Badge';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Modal from '../../components/ui/Modal';
import { Field, inputClass } from '../../components/ui/Field';
import { money } from '../../utils/format';
import Skeleton from '../../components/ui/Skeleton';

const REASONS = ['wrong_transaction', 'amount_mismatch', 'payment_not_received', 'duplicate_payment', 'invalid_screenshot', 'failed_transaction', 'other'];

export default function ApprovalsPage() {
  const [rows, setRows] = useState(null);
  const [reject, setReject] = useState(null);
  const [reason, setReason] = useState('amount_mismatch');
  const [approve, setApprove] = useState(null);

  function load() {
    api.get('/payments/queue').then(({ data }) => setRows(data.data.items)).catch(() => setRows([]));
  }
  useEffect(load, []);
  if (rows == null) return <Skeleton />;

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">Payment approvals</h1>
      <p className="mb-5 text-sm text-slate-500">Telecallers cannot approve. Mismatch payments require admin review.</p>
      <div className="space-y-3">
        {rows.map((p) => (
          <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{p.public_id} · <Link className="text-brand-600" to={`/orders/${p.order_code}`}>{p.order_code}</Link></p>
                <p className="text-sm text-slate-500">{p.customer_name} · {p.mobile} · {p.telecaller_name} ({p.employee_code})</p>
              </div>
              <Badge status={p.status} />
            </div>
            <p className="mt-2 text-sm">Paid {money(p.amount)} vs order {money(p.order_total)} {p.mismatch_difference != null && Number(p.mismatch_difference) !== 0 && <span className="font-semibold text-rose-600">Diff {money(p.mismatch_difference)}</span>}</p>
            <p className="text-sm">{p.payment_mode} · UTR {p.utr || '—'}</p>
            {p.screenshot_path && <a className="text-sm text-brand-600" href={fileUrl(p.screenshot_path)} target="_blank" rel="noreferrer">Screenshot</a>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white" onClick={() => setApprove(p)}>Approve</button>
              <button className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white" onClick={() => setReject(p)}>Reject</button>
              <button className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold" onClick={async () => { await api.post(`/payments/${p.public_id}/verify`, { action: 'request_verification' }); load(); }}>Request verification</button>
            </div>
          </div>
        ))}
      </div>
      <ConfirmModal
        open={!!approve}
        title="Approve payment"
        message="This confirms the order, generates an invoice, reduces inventory, and assigns product units."
        confirmLabel="Approve"
        onClose={() => setApprove(null)}
        onConfirm={async () => { await api.post(`/payments/${approve.public_id}/approve`); setApprove(null); load(); }}
      />
      <Modal open={!!reject} title="Reject payment" onClose={() => setReject(null)}>
        <Field label="Reason">
          <select className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
          </select>
        </Field>
        <button className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white" onClick={async () => { await api.post(`/payments/${reject.public_id}/reject`, { reason }); setReject(null); load(); }}>Reject</button>
      </Modal>
    </div>
  );
}
