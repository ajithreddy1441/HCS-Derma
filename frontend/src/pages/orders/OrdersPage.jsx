import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import DataTable from '../../components/tables/DataTable';
import Badge from '../../components/ui/Badge';
import { money } from '../../utils/format';
import Skeleton from '../../components/ui/Skeleton';
import { inputClass } from '../../components/ui/Field';

export default function OrdersPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    api.get('/orders', { params: { q, limit: 50 } }).then(({ data }) => setRows(data.data.items)).catch(() => setRows([]));
  }, [q]);
  if (rows == null) return <Skeleton />;
  return (
    <div>
      <div className="mb-5 flex justify-between">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <Link to="/orders/new" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">New order</Link>
      </div>
      <input className={`${inputClass} mb-4 max-w-md`} placeholder="Search order / customer" value={q} onChange={(e) => setQ(e.target.value)} />
      <DataTable
        rows={rows}
        onRow={(r) => nav(`/orders/${r.public_id}`)}
        columns={[
          { key: 'public_id', label: 'Order' },
          { key: 'customer_name', label: 'Customer' },
          { key: 'telecaller_name', label: 'Telecaller' },
          { key: 'total', label: 'Total', render: (r) => money(r.total) },
          { key: 'payment_status', label: 'Payment', render: (r) => <Badge status={r.payment_status} /> },
          { key: 'order_status', label: 'Status', render: (r) => <Badge status={r.order_status} /> },
        ]}
      />
    </div>
  );
}
