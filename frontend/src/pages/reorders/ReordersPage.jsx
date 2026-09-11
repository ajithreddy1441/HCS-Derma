import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import DataTable from '../../components/tables/DataTable';
import Badge from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';

export default function ReordersPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    api.get('/reorders').then(({ data }) => setRows(data.data.items)).catch(() => setRows([]));
  }, []);
  if (rows == null) return <Skeleton />;
  return (
    <div>
      <h1 className="mb-5 text-2xl font-semibold">Reorder follow-ups</h1>
      <DataTable
        rows={rows}
        columns={[
          { key: 'public_id', label: 'ID' },
          { key: 'customer_name', label: 'Customer' },
          { key: 'mobile', label: 'Mobile' },
          { key: 'product_name', label: 'Previous product' },
          { key: 'previous_quantity', label: 'Qty' },
          { key: 'previous_order_code', label: 'Previous order' },
          { key: 'due_date', label: 'Due' },
          { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
          { key: 'a', label: '', render: (r) => r.status === 'due' && (
            <button className="text-brand-600" onClick={() => nav(`/orders/new?reorder=${r.public_id}&customer_id=${r.customer_id}&parent=${r.previous_order_id}`)}>Create reorder</button>
          ) },
        ]}
      />
    </div>
  );
}
