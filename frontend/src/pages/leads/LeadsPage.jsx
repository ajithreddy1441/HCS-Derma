import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import DataTable from '../../components/tables/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Field, inputClass } from '../../components/ui/Field';
import Skeleton from '../../components/ui/Skeleton';

const STATUSES = ['new', 'interested', 'follow_up_required', 'converted', 'not_interested', 'no_response', 'future_requirement', 'lost'];

export default function LeadsPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer_name: '', mobile: '', interested_product: '', source: '', notes: '', next_followup_date: '', next_followup_time: '' });

  function load() {
    api.get('/leads', { params: { status, limit: 50 } }).then(({ data }) => setRows(data.data.items)).catch(() => setRows([]));
  }
  useEffect(load, [status]);

  async function save(e) {
    e.preventDefault();
    await api.post('/leads', form);
    setOpen(false);
    load();
  }

  async function convert(id, e) {
    e.stopPropagation();
    const { data } = await api.post(`/leads/${id}/convert`);
    nav(`/customers/${data.data.public_id}`);
  }

  if (rows == null) return <Skeleton />;
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => setOpen(true)}>New lead</button>
      </div>
      <select className={`${inputClass} mb-4 max-w-xs`} value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <DataTable
        rows={rows}
        onRow={(r) => nav(`/leads/${r.public_id}`)}
        columns={[
          { key: 'public_id', label: 'Lead ID' },
          { key: 'customer_name', label: 'Name' },
          { key: 'mobile', label: 'Mobile' },
          { key: 'interested_product', label: 'Product' },
          { key: 'telecaller_name', label: 'Telecaller' },
          { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
          { key: 'x', label: '', render: (r) => r.status !== 'converted' && <button className="text-brand-600" onClick={(e) => convert(r.public_id, e)}>Convert</button> },
        ]}
      />
      <Modal open={open} title="New lead" onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={save}>
          {['customer_name', 'mobile', 'interested_product', 'source', 'notes', 'next_followup_date', 'next_followup_time'].map((k) => (
            <Field key={k} label={k.replace(/_/g, ' ')}>
              <input className={inputClass} type={k.includes('date') ? 'date' : k.includes('time') ? 'time' : 'text'} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} required={k === 'customer_name' || k === 'mobile'} />
            </Field>
          ))}
          <button className="rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white">Save</button>
        </form>
      </Modal>
    </div>
  );
}
