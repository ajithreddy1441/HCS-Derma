import { useEffect, useState } from 'react';
import api from '../../api/client';
import DataTable from '../../components/tables/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Field, inputClass } from '../../components/ui/Field';
import Skeleton from '../../components/ui/Skeleton';

export default function EmployeesPage() {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', mobile: '', email: '', role: 'telecaller', username: '', password: '', joining_date: '' });

  function load() {
    api.get('/employees').then(({ data }) => setRows(data.data.items)).catch(() => setRows([]));
  }
  useEffect(load, []);

  if (rows == null) return <Skeleton />;
  return (
    <div>
      <div className="mb-5 flex justify-between">
        <h1 className="text-2xl font-semibold">Employees</h1>
        <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => setOpen(true)}>Add employee</button>
      </div>
      <DataTable
        rows={rows}
        columns={[
          { key: 'public_id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'mobile', label: 'Mobile' },
          { key: 'email', label: 'Email' },
          { key: 'username', label: 'Username' },
          { key: 'role_name', label: 'Role' },
          { key: 'joining_date', label: 'Joined' },
          { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
        ]}
      />
      <Modal open={open} title="Employee" onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={async (e) => { e.preventDefault(); await api.post('/employees', form); setOpen(false); load(); }}>
          {Object.keys(form).map((k) => (
            <Field key={k} label={k.replace(/_/g, ' ')}>
              {k === 'role' ? (
                <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="admin">admin</option>
                  <option value="telecaller">telecaller</option>
                  <option value="accountant">accountant</option>
                </select>
              ) : (
                <input className={inputClass} type={k === 'password' ? 'password' : k === 'joining_date' ? 'date' : 'text'} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} required={k !== 'joining_date'} />
              )}
            </Field>
          ))}
          <button className="rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white">Create</button>
        </form>
      </Modal>
    </div>
  );
}
