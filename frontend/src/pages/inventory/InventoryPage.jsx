import { useEffect, useState } from 'react';
import api from '../../api/client';
import DataTable from '../../components/tables/DataTable';
import Badge from '../../components/ui/Badge';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { Field, inputClass } from '../../components/ui/Field';
import { useAuth } from '../../context/AuthContext';
import Skeleton from '../../components/ui/Skeleton';

export default function InventoryPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState('stock');
  const [rows, setRows] = useState(null);
  const [history, setHistory] = useState([]);
  const [adj, setAdj] = useState(null);

  useEffect(() => {
    api.get('/inventory').then(({ data }) => setRows(data.data.items)).catch(() => setRows([]));
    api.get('/inventory/history').then(({ data }) => setHistory(data.data.items)).catch(() => {});
  }, []);

  if (rows == null) return <Skeleton />;
  return (
    <div>
      <h1 className="text-2xl font-semibold">Inventory</h1>
      <div className="my-4 flex gap-2">
        <button className={`rounded-full px-3 py-1.5 text-sm ${tab === 'stock' ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-slate-200'}`} onClick={() => setTab('stock')}>Stock</button>
        <button className={`rounded-full px-3 py-1.5 text-sm ${tab === 'history' ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-slate-200'}`} onClick={() => setTab('history')}>History</button>
      </div>
      {tab === 'stock' && (
        <DataTable
          rows={rows}
          columns={[
            { key: 'name', label: 'Product' },
            { key: 'public_id', label: 'ID' },
            { key: 'sku', label: 'SKU' },
            { key: 'opening_stock', label: 'Opening' },
            { key: 'sold_quantity', label: 'Sold' },
            { key: 'available_quantity', label: 'Available' },
            { key: 'low_stock_level', label: 'Low level' },
            { key: 'stock_status', label: 'Status', render: (r) => <Badge status={r.stock_status} /> },
            ...(can('inventory.adjust') ? [{ key: 'a', label: '', render: (r) => <button className="text-brand-600" onClick={() => setAdj(r)}>Adjust</button> }] : []),
          ]}
        />
      )}
      {tab === 'history' && (
        <DataTable
          rows={history}
          columns={[
            { key: 'public_id', label: 'Txn' },
            { key: 'product_name', label: 'Product' },
            { key: 'previous_quantity', label: 'Prev' },
            { key: 'quantity_changed', label: 'Change' },
            { key: 'new_quantity', label: 'New' },
            { key: 'reason', label: 'Reason' },
            { key: 'order_code', label: 'Order' },
            { key: 'employee_name', label: 'Employee' },
          ]}
        />
      )}
      <ConfirmModal
        open={!!adj}
        title="Adjust inventory"
        message="Enter signed quantity (negative reduces stock). This is a manual adjustment and is audited."
        onClose={() => setAdj(null)}
        onConfirm={async () => {
          const qty = Number(document.getElementById('adj-qty').value);
          const reason = document.getElementById('adj-reason').value;
          await api.post('/inventory/adjust', { product_id: adj.product_id, quantity: qty, reason });
          setAdj(null);
          location.reload();
        }}
      />
      {adj && (
        <div className="fixed bottom-6 left-1/2 z-50 w-80 -translate-x-1/2 rounded-xl bg-white p-3 shadow-xl">
          <Field label="Quantity"><input id="adj-qty" type="number" className={inputClass} /></Field>
          <Field label="Reason">
            <select id="adj-reason" className={inputClass}>
              <option value="manual_adjustment">Manual Adjustment</option>
              <option value="stock_added">Stock Added</option>
              <option value="damaged_product">Damaged Product</option>
              <option value="stock_correction">Stock Correction</option>
            </select>
          </Field>
        </div>
      )}
    </div>
  );
}
