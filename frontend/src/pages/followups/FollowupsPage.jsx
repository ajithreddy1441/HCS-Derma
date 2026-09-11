import { useEffect, useState } from 'react';
import api from '../../api/client';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Field, inputClass } from '../../components/ui/Field';
import Skeleton from '../../components/ui/Skeleton';

const SECTIONS = [
  ['today', "Today's Follow-ups"],
  ['upcoming', 'Upcoming'],
  ['overdue', 'Overdue'],
  ['completed', 'Completed'],
];

export default function FollowupsPage() {
  const [section, setSection] = useState('today');
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [complete, setComplete] = useState(null);
  const [sent, setSent] = useState('');
  const [form, setForm] = useState({ followup_date: '', followup_time: '', reason: '', notes: '', customer_id: '', lead_id: '' });
  const [done, setDone] = useState({ status: 'completed', notes: '', previous_conversation: '', next_followup_date: '', next_followup_time: '', next_action: '' });

  function load() {
    api.get('/followups', { params: { section } }).then(({ data }) => setRows(data.data.items)).catch(() => setRows([]));
  }
  useEffect(load, [section]);

  if (rows == null) return <Skeleton />;
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Follow-ups</h1>
        <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => setOpen(true)}>Add follow-up</button>
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {SECTIONS.map(([k, l]) => (
          <button key={k} onClick={() => setSection(k)} className={`rounded-full px-3 py-1.5 text-sm ${section === k ? (k === 'overdue' ? 'bg-orange-500 text-white' : 'bg-brand-600 text-white') : 'bg-white ring-1 ring-slate-200'}`}>{l}</button>
        ))}
      </div>
      {section === 'overdue' && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-white p-4">
          <p className="text-sm text-slate-600">Send overdue names, mobiles and due dates to admin notifications.</p>
          <button
            className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
            onClick={async () => {
              const { data } = await api.post('/followups/alert-admin');
              setSent(`Sent ${data.data.count} overdue record(s) to admin`);
            }}
          >
            Send overdue to admin
          </button>
          {sent && <p className="w-full text-sm text-emerald-700">{sent}</p>}
        </div>
      )}
      <div className="space-y-3">
        {rows.map((f) => (
          <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="font-semibold">{f.party_name} · {f.mobile}</p>
              <p className="text-sm text-slate-500">{f.public_id} · {f.followup_date} {f.followup_time} · {f.telecaller_name}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge status={f.status} />
              {f.status === 'pending' && <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white" onClick={() => setComplete(f)}>Complete</button>}
            </div>
          </div>
        ))}
      </div>
      <Modal open={open} title="Follow-up" onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={async (e) => { e.preventDefault(); await api.post('/followups', form); setOpen(false); load(); }}>
          {['followup_date', 'followup_time', 'reason', 'notes', 'customer_id', 'lead_id'].map((k) => (
            <Field key={k} label={k}>
              <input className={inputClass} type={k.includes('date') ? 'date' : k.includes('time') ? 'time' : 'text'} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} required={k === 'followup_date'} />
            </Field>
          ))}
          <button className="rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white">Save</button>
        </form>
      </Modal>
      <Modal open={!!complete} title="Complete follow-up" onClose={() => setComplete(null)}>
        <form className="grid gap-3" onSubmit={async (e) => { e.preventDefault(); await api.put(`/followups/${complete.public_id}/complete`, done); setComplete(null); load(); }}>
          <Field label="Status">
            <select className={inputClass} value={done.status} onChange={(e) => setDone({ ...done, status: e.target.value })}>
              {['completed', 'interested', 'not_interested', 'no_response', 'call_later', 'converted'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Conversation"><textarea className={inputClass} value={done.previous_conversation} onChange={(e) => setDone({ ...done, previous_conversation: e.target.value })} /></Field>
          <Field label="Notes"><textarea className={inputClass} value={done.notes} onChange={(e) => setDone({ ...done, notes: e.target.value })} /></Field>
          <Field label="Next follow-up date"><input type="date" className={inputClass} value={done.next_followup_date} onChange={(e) => setDone({ ...done, next_followup_date: e.target.value })} /></Field>
          <Field label="Next time"><input type="time" className={inputClass} value={done.next_followup_time} onChange={(e) => setDone({ ...done, next_followup_time: e.target.value })} /></Field>
          <button className="rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white">Save</button>
        </form>
      </Modal>
    </div>
  );
}
