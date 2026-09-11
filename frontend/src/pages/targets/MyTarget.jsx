import { useEffect, useState } from 'react';
import api from '../../api/client';
import { money } from '../../utils/format';
import Skeleton from '../../components/ui/Skeleton';

export default function MyTarget() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get('/dashboard/my-target').then(({ data: d }) => setData(d.data));
  }, []);
  if (!data) return <Skeleton />;
  const t = data.targets.find((x) => x.period_type === 'monthly') || data.targets[0];
  const sales = Number(data.actuals?.sales_month || 0);
  const target = Number(t?.sales_target || 0);
  const pct = target ? ((sales / target) * 100).toFixed(1) : 0;
  return (
    <div>
      <h1 className="text-2xl font-semibold">My target</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Sales target" value={money(target)} />
        <Stat label="Achieved" value={money(sales)} />
        <Stat label="Remaining" value={money(Math.max(0, target - sales))} />
        <Stat label="Achievement" value={`${pct}%`} />
        <Stat label="Orders target" value={t?.order_target || 0} />
        <Stat label="Orders completed" value={data.actuals?.orders_month || 0} />
        <Stat label="Follow-ups completed" value={data.followups?.followups_today || 0} />
        <Stat label="Reorders converted" value={data.reorders?.reorders || 0} />
      </div>
      <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-brand-600" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
