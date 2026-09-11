import { useEffect, useState } from 'react';
import api from '../../api/client';
import { dt } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import Skeleton from '../../components/ui/Skeleton';

export default function ActivityPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState('activity');
  const [rows, setRows] = useState(null);
  useEffect(() => {
    const path = tab === 'audit' ? '/audit' : '/activity';
    api.get(path).then(({ data }) => setRows(data.data.items)).catch(() => setRows([]));
  }, [tab]);
  if (rows == null) return <Skeleton />;
  return (
    <div>
      <h1 className="text-2xl font-semibold">Activity & audit</h1>
      <div className="my-4 flex gap-2">
        <button className={`rounded-full px-3 py-1.5 text-sm ${tab === 'activity' ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-slate-200'}`} onClick={() => setTab('activity')}>Activity</button>
        {can('audit.view') && <button className={`rounded-full px-3 py-1.5 text-sm ${tab === 'audit' ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-slate-200'}`} onClick={() => setTab('audit')}>Audit trail</button>}
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
            <p className="font-medium">{r.action || r.field_changed} · {r.module} · {r.record_id}</p>
            <p className="text-slate-500">{r.description || `${r.old_value} → ${r.new_value}`}</p>
            <p className="text-xs text-slate-400">{r.employee_name} {r.employee_code} · {dt(r.created_at)}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-400">Audit history cannot be deleted by employees.</p>
    </div>
  );
}
