import { useEffect, useState } from 'react';
import api from '../../api/client';
import DataTable from '../../components/tables/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Field, inputClass } from '../../components/ui/Field';
import { useAuth } from '../../context/AuthContext';
import Skeleton from '../../components/ui/Skeleton';

export default function ReturnsPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [approve, setApprove] = useState(null);

  function load() {
    api.get('/returns').then(({ data }) => setRows(data.data.items)).catch(() => setRows([]));
  }
  useEffect(load, []);

  if (rows == null) return <Skeleton />;
  return (
    <div>
      <div className="mb-5 flex justify-between">
        <h1 className="text-2xl font-semibold">Returns</h1>
        <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => setOpen(true)}>New return</button>
      </div>
      <DataTable
        rows={rows}
        columns={[
          { key: 'public_id', label: 'Return' },
          { key: 'order_code', label: 'Order' },
          { key: 'customer_name', label: 'Customer' },
          { key: 'reason', label: 'Reason' },
          { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
          ...(can('returns.manage') ? [{ key: 'a', label: '', render: (r) => <button className="text-brand-600" onClick={() => setApprove(r)}>Update</button> }] : []),
        ]}
      />
      <Modal open={open} title="Create return" onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          await api.post('/returns', fd);
          setOpen(false);
          load();
        }}>
          <Field label="Order ID"><input name="order_id" className={inputClass} required placeholder="ORD000001" /></Field>
          <Field label="Reason">
            <select name="reason" className={inputClass}>
              {['customer_request', 'damaged_product', 'wrong_product', 'missing_product', 'delivery_issue', 'product_issue', 'courier_return', 'rto', 'other'].map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Items JSON"><textarea name="items" className={inputClass} placeholder='[{"sku":"SKU1","quantity":1}]' /></Field>
          <Field label="Images"><input type="file" name="image" accept="image/*" /></Field>
          <button className="rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white">Create</button>
        </form>
      </Modal>
      <Modal open={!!approve} title="Return status" onClose={() => setApprove(null)}>
        <form className="grid gap-3" onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          await api.put(`/returns/${approve.public_id}/status`, Object.fromEntries(fd));
          setApprove(null);
          load();
        }}>
          <Field label="Status">
            <select name="status" className={inputClass} defaultValue={approve?.status}>
              {['return_requested', 'under_review', 'approved', 'rejected', 'pickup_scheduled', 'in_transit', 'received', 'quality_check', 'approved_for_inventory', 'rejected_for_inventory', 'refund_processing', 'replacement_processing', 'completed'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Admin remarks"><textarea name="admin_remarks" className={inputClass} /></Field>
          <p className="text-xs text-slate-500">Stock is added only when status is approved_for_inventory after quality check.</p>
          <button className="rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white">Save</button>
        </form>
      </Modal>
    </div>
  );
}
