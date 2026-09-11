import { useEffect, useState } from 'react';
import api from '../../api/client';
import DataTable from '../../components/tables/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Field, inputClass } from '../../components/ui/Field';
import { money } from '../../utils/format';
import Skeleton from '../../components/ui/Skeleton';

export default function PayrollPage() {
  const [rows, setRows] = useState(null);
  const [emps, setEmps] = useState([]);
  const [open, setOpen] = useState(false);
  function load() {
    api.get('/payroll').then(({ data }) => setRows(data.data.items)).catch(() => setRows([]));
    api.get('/employees').then(({ data }) => setEmps(data.data.items)).catch(() => {});
  }
  useEffect(load, []);
  if (rows == null) return <Skeleton />;
  return (
    <div>
      <div className="mb-5 flex justify-between">
        <h1 className="text-2xl font-semibold">Payroll</h1>
        <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => setOpen(true)}>Create payroll</button>
      </div>
      <DataTable
        rows={rows}
        columns={[
          { key: 'public_id', label: 'ID' },
          { key: 'name', label: 'Employee' },
          { key: 'employee_code', label: 'Emp' },
          { key: 'role_name', label: 'Role' },
          { key: 'salary_month', label: 'Month' },
          { key: 'basic_salary', label: 'Basic', render: (r) => money(r.basic_salary) },
          { key: 'incentive', label: 'Incentive', render: (r) => money(r.incentive) },
          { key: 'net_salary', label: 'Net', render: (r) => money(r.net_salary) },
          { key: 'payment_status', label: 'Status', render: (r) => <Badge status={r.payment_status} /> },
        ]}
      />
      <Modal open={open} title="Payroll" onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={async (e) => { e.preventDefault(); await api.post('/payroll', Object.fromEntries(new FormData(e.target))); setOpen(false); load(); }}>
          <Field label="Employee"><select name="employee_id" className={inputClass}>{emps.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
          <Field label="Month"><input name="salary_month" className={inputClass} placeholder="2026-09" required /></Field>
          <Field label="Basic"><input name="basic_salary" type="number" className={inputClass} /></Field>
          <Field label="Commission"><input name="commission" type="number" className={inputClass} /></Field>
          <Field label="Deductions"><input name="deductions" type="number" className={inputClass} /></Field>
          <Field label="Advance"><input name="advance" type="number" className={inputClass} /></Field>
          <p className="text-xs text-slate-500">Incentive and bonus pull from the incentive module for that month when left blank.</p>
          <button className="rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white">Save</button>
        </form>
      </Modal>
    </div>
  );
}
