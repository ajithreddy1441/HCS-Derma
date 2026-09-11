import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/client';
import Badge from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';

export default function LeadDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get(`/leads/${id}`).then(({ data: d }) => setData(d.data));
  }, [id]);
  if (!data) return <Skeleton />;
  const { lead: l, followups, notes } = data;
  return (
    <div>
      <h1 className="text-2xl font-semibold">{l.customer_name}</h1>
      <p className="text-sm text-slate-500">{l.public_id} · {l.mobile} · {l.telecaller_name}</p>
      <Badge status={l.status} />
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
        <p>Product: {l.interested_product || '—'}</p>
        <p>Source: {l.source || '—'}</p>
        <p>Notes: {l.notes || '—'}</p>
        {l.customer_code && <p>Converted customer: {l.customer_code}</p>}
      </div>
      <h2 className="mt-6 font-semibold">Follow-ups</h2>
      <ul className="mt-2 space-y-2">{followups.map((f) => <li key={f.id} className="rounded-xl bg-white p-3 text-sm">{f.followup_date} · {f.status}</li>)}</ul>
      <h2 className="mt-6 font-semibold">Notes</h2>
      <ul className="mt-2 space-y-2">{notes.map((n) => <li key={n.id} className="rounded-xl bg-white p-3 text-sm">{n.note}</li>)}</ul>
    </div>
  );
}
