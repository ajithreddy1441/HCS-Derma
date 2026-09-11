import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Field, inputClass } from '../../components/ui/Field';
import { money } from '../../utils/format';
import Skeleton from '../../components/ui/Skeleton';

export default function TargetsPage() {
  const [tab, setTab] = useState('individual');
  const [targets, setTargets] = useState([]);
  const [teams, setTeams] = useState([]);
  const [emps, setEmps] = useState([]);
  const [perf, setPerf] = useState([]);
  const [rules, setRules] = useState([]);
  const [inc, setInc] = useState([]);

  function load() {
    api.get('/targets').then(({ data }) => setTargets(data.data.items)).catch(() => {});
    api.get('/team-targets').then(({ data }) => setTeams(data.data.items)).catch(() => {});
    api.get('/employees').then(({ data }) => setEmps(data.data.items)).catch(() => {});
    api.get('/performance').then(({ data }) => setPerf(data.data.items)).catch(() => {});
    api.get('/incentive-rules').then(({ data }) => setRules(data.data.items)).catch(() => {});
    api.get('/incentives').then(({ data }) => setInc(data.data.items)).catch(() => {});
  }
  useEffect(load, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Targets & incentives</h1>
      <div className="my-4 flex gap-2">
        {['individual', 'team', 'performance', 'incentives'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-sm capitalize ${tab === t ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-slate-200'}`}>{t}</button>
        ))}
      </div>
      {tab === 'individual' && (
        <>
          <form className="mb-4 grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-4" onSubmit={async (e) => {
            e.preventDefault();
            const fd = Object.fromEntries(new FormData(e.target));
            await api.post('/targets', fd);
            load();
          }}>
            <Field label="Employee"><select name="employee_id" className={inputClass}>{emps.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
            <Field label="Period"><select name="period_type" className={inputClass}><option>daily</option><option>weekly</option><option>monthly</option></select></Field>
            <Field label="Start"><input type="date" name="period_start" className={inputClass} required /></Field>
            <Field label="End"><input type="date" name="period_end" className={inputClass} required /></Field>
            <Field label="Sales target"><input name="sales_target" type="number" className={inputClass} /></Field>
            <Field label="Order target"><input name="order_target" type="number" className={inputClass} /></Field>
            <Field label="Follow-up target"><input name="followup_target" type="number" className={inputClass} /></Field>
            <Field label="Reorder target"><input name="reorder_target" type="number" className={inputClass} /></Field>
            <button className="rounded-xl bg-brand-600 text-sm font-semibold text-white">Save target</button>
          </form>
          <div className="space-y-2">{targets.map((t) => <div key={t.id} className="rounded-xl bg-white p-3 text-sm">{t.name} · {t.period_type} · sales {money(t.sales_target)}</div>)}</div>
        </>
      )}
      {tab === 'team' && (
        <div className="space-y-3">
          {teams.map((t) => (
            <div key={t.id} className="rounded-2xl bg-white p-4">
              <p className="font-semibold">{t.name}</p>
              <p className="text-sm">Target {money(t.sales_target)} · Actual {money(t.actual)} · Remaining {money(t.remaining)} · {t.achievement_pct}%</p>
              <p className="text-xs text-slate-500">Best {t.best?.name} · Lowest {t.lowest?.name}</p>
            </div>
          ))}
        </div>
      )}
      {tab === 'performance' && (
        <div className="overflow-auto rounded-2xl bg-white">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500">{['Name','Leads','Follow-ups','Converted','Orders','Sales','AOV','Reorders','Cancelled','Returned'].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
            <tbody>{perf.map((p) => (
              <tr key={p.id} className="border-t"><td className="p-3">{p.name}</td><td>{p.leads}</td><td>{p.followups}</td><td>{p.converted}</td><td>{p.orders}</td><td>{money(p.sales)}</td><td>{money(p.aov)}</td><td>{p.reorders}</td><td>{p.cancelled}</td><td>{p.returned_orders}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {tab === 'incentives' && (
        <div>
          <button className="mb-4 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white" onClick={async () => { await api.post('/incentives/calculate', {}); load(); }}>Calculate this month</button>
          <div className="space-y-2">{inc.map((i) => <div key={i.id} className="rounded-xl bg-white p-3 text-sm">{i.name} · {i.month} · {i.achievement_pct}% · incentive {money(i.incentive)} · bonus {money(i.bonus)}</div>)}</div>
          <p className="mt-4 text-xs text-slate-500">Rules: {rules.map((r) => r.label).join(' · ')}</p>
        </div>
      )}
    </div>
  );
}
