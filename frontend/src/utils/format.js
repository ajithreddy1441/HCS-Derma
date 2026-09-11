export const STATUS = {
  success: ['approved', 'delivered', 'active', 'converted', 'completed', 'paid', 'in_stock', 'order_confirmed'],
  warning: ['pending', 'processing', 'low_stock', 'under_verification', 'payment_pending', 'payment_verification', 'partial_payment', 'quality_check', 'due'],
  danger: ['rejected', 'cancelled', 'out_of_stock', 'inactive', 'lost', 'payment_rejected', 'returned', 'rto', 'blocked'],
  info: ['dispatched', 'in_transit', 'new', 'ready_to_dispatch', 'out_for_delivery', 'interested', 'follow_up_required'],
};

export function tone(status) {
  const s = String(status || '').toLowerCase();
  if (STATUS.success.includes(s)) return 'success';
  if (STATUS.warning.includes(s)) return 'warning';
  if (STATUS.danger.includes(s)) return 'danger';
  if (STATUS.info.includes(s)) return 'info';
  return 'neutral';
}

export function labelize(v) {
  if (v == null || v === '') return '—';
  return String(v).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function money(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n || 0));
}

export function dt(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
