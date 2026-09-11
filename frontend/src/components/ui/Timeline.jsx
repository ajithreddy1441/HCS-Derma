import { dt } from '../../utils/format';

export default function Timeline({ items = [] }) {
  if (!items.length) return <p className="text-sm text-slate-500">No activity yet.</p>;
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {items.map((a) => (
        <li key={a.id} className="relative">
          <span className="absolute -left-[1.41rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500" />
          <p className="text-xs text-slate-400">{dt(a.created_at)}</p>
          <p className="text-sm font-semibold text-slate-800">{a.action}</p>
          <p className="text-sm text-slate-500">{a.description}</p>
          <p className="text-xs text-slate-400">{a.employee_name} {a.employee_code}</p>
        </li>
      ))}
    </ol>
  );
}
