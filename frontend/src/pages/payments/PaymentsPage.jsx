import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { fileUrl } from '../../api/client';
import DataTable from '../../components/tables/DataTable';
import Badge from '../../components/ui/Badge';
import { money } from '../../utils/format';
import Skeleton from '../../components/ui/Skeleton';

export default function PaymentsPage() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    api.get('/payments', { params: { limit: 80 } }).then(({ data }) => setRows(data.data.items)).catch(() => setRows([]));
  }, []);
  if (rows == null) return <Skeleton />;
  return (
    <div>
      <h1 className="mb-5 text-2xl font-semibold">Payments</h1>
      <DataTable
        rows={rows}
        columns={[
          { key: 'public_id', label: 'Payment' },
          { key: 'order_code', label: 'Order', render: (r) => <Link className="text-brand-600" to={`/orders/${r.order_code}`}>{r.order_code}</Link> },
          { key: 'customer_name', label: 'Customer' },
          { key: 'amount', label: 'Amount', render: (r) => money(r.amount) },
          { key: 'order_total', label: 'Order total', render: (r) => money(r.order_total) },
          { key: 'payment_mode', label: 'Mode' },
          { key: 'utr', label: 'UTR' },
          { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
          { key: 's', label: '', render: (r) => r.screenshot_path && <a href={fileUrl(r.screenshot_path)} target="_blank" rel="noreferrer">View</a> },
        ]}
      />
    </div>
  );
}
