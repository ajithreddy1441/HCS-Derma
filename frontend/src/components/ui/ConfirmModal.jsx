import { useEffect, useState } from 'react';

function friendlyShipError(msg) {
  const t = String(msg || '');
  if (/wrong pickup location/i.test(t)) {
    return 'Shiprocket pickup nickname is "work" (the PRIMARY warehouse in Tadepalligudem). Restart the API so this CRM sends "work", then Confirm again.';
  }
  if (/billing\/shipping address first/i.test(t) || /add billing/i.test(t)) {
    return 'Customer address is already on this order. Shiprocket still needs a pickup warehouse on the seller account.';
  }
  return t;
}

export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setBusy(false);
      setErr('');
    }
  }, [open]);

  if (!open) return null;

  async function confirm() {
    setErr('');
    setBusy(true);
    try {
      await onConfirm();
    } catch (e) {
      setErr(friendlyShipError(e.response?.data?.message || e.message || 'Request failed'));
      setBusy(false);
      return;
    }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        {err && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button
            type="button"
            disabled={busy}
            onClick={confirm}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-brand-600 hover:bg-brand-700'}`}
          >
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
