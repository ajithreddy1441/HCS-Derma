import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import DataTable from '../../components/tables/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Field, inputClass } from '../../components/ui/Field';
import { useDebounce } from '../../hooks/useDebounce';
import Skeleton from '../../components/ui/Skeleton';

const LABELS = {
  name: 'Name',
  store_name: 'Store name',
  mobile: 'Mobile',
  alternate_mobile: 'Alternate mobile',
  email: 'Email',
  address: 'Address (house / street)',
  city: 'City',
  state: 'State',
  pincode: 'Pincode',
};
const REQUIRED = ['name', 'mobile', 'address', 'city', 'state', 'pincode'];
const empty = { name: '', store_name: '', mobile: '', alternate_mobile: '', email: '', address: '', city: '', state: '', pincode: '' };

export default function CustomersPage() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  function load() {
    api.get('/customers', { params: { q: dq, limit: 50 } }).then(({ data }) => setRows(data.data.items)).catch(() => setRows([]));
  }
  useEffect(load, [dq]);

  async function save(e) {
    e.preventDefault();
    await api.post('/customers', form);
    setOpen(false);
    setForm(empty);
    load();
  }

  if (rows == null) return <Skeleton />;
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => setOpen(true)}>Add customer</button>
      </div>
      <input className={`${inputClass} mb-4 max-w-md`} placeholder="Search name, mobile, ID" value={q} onChange={(e) => setQ(e.target.value)} />
      <DataTable
        rows={rows}
        onRow={(r) => nav(`/customers/${r.public_id}`)}
        columns={[
          { key: 'public_id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'store_name', label: 'Store' },
          { key: 'mobile', label: 'Mobile' },
          { key: 'city', label: 'City' },
          { key: 'telecaller_name', label: 'Telecaller' },
          { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
        ]}
      />
      <Modal open={open} title="New customer" onClose={() => setOpen(false)}>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={save}>
          {Object.keys(empty).map((k) => (
            <Field key={k} label={LABELS[k]}>
              <input className={inputClass} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} required={REQUIRED.includes(k)} />
            </Field>
          ))}
          <div className="sm:col-span-2 flex justify-end">
            <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
