import { useState } from 'react';
import api from '../../api/client';
import { Field, inputClass } from '../../components/ui/Field';
import DataTable from '../../components/tables/DataTable';

const TYPES = ['sales', 'orders', 'customers', 'leads', 'followups', 'payments', 'payment-mismatch', 'inventory', 'low-stock', 'delivery', 'returns', 'reorders', 'employees', 'targets', 'performance', 'payroll'];

export default function ReportsPage() {
  const [type, setType] = useState('sales');
  const [range, setRange] = useState('month');
  const [rows, setRows] = useState([]);

  async function run() {
    const { data } = await api.get(`/reports/${type}`, { params: { range } });
    setRows(data.data.items || []);
  }

  function exportFile(fmt) {
    api.get(`/reports/${type}`, { params: { range, export: fmt }, responseType: 'blob' }).then((res) => {
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}.${fmt === 'xlsx' ? 'xlsx' : 'csv'}`;
      a.click();
    });
  }

  const cols = rows[0] ? Object.keys(rows[0]).slice(0, 8).map((k) => ({ key: k, label: k, render: (r) => String(r[k] ?? '').slice(0, 40) })) : [];

  return (
    <div>
      <h1 className="text-2xl font-semibold">Reports</h1>
      <div className="mt-4 flex flex-wrap gap-3">
        <Field label="Report"><select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Range">
          <select className={inputClass} value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="year">This year</option>
          </select>
        </Field>
        <button className="mt-6 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white" onClick={run}>Run</button>
        <button className="mt-6 rounded-xl border px-4 py-2 text-sm" onClick={() => exportFile('csv')}>CSV</button>
        <button className="mt-6 rounded-xl border px-4 py-2 text-sm" onClick={() => exportFile('xlsx')}>Excel</button>
        <button className="mt-6 rounded-xl border px-4 py-2 text-sm" onClick={() => window.print()}>Print</button>
      </div>
      <div className="mt-4"><DataTable rows={rows} columns={cols} empty="Run a report to see data" /></div>
    </div>
  );
}
