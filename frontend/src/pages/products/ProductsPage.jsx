import { useEffect, useState } from 'react';
import api from '../../api/client';
import { fileUrl } from '../../api/client';
import DataTable from '../../components/tables/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Field, inputClass } from '../../components/ui/Field';
import { money } from '../../utils/format';
import Skeleton from '../../components/ui/Skeleton';

export default function ProductsPage() {
  const [rows, setRows] = useState(null);
  const [cats, setCats] = useState([]);
  const [open, setOpen] = useState(false);

  function load() {
    api.get('/products', { params: { limit: 100 } }).then(({ data }) => setRows(data.data.items)).catch(() => setRows([]));
    api.get('/products/categories').then(({ data }) => setCats(data.data.items)).catch(() => {});
  }
  useEffect(load, []);

  async function save(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api.post('/products', fd);
    setOpen(false);
    load();
  }

  if (rows == null) return <Skeleton />;
  return (
    <div>
      <div className="mb-5 flex justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => setOpen(true)}>Add product</button>
      </div>
      <DataTable
        rows={rows}
        columns={[
          { key: 'image', label: '', render: (r) => r.image_path ? <img src={fileUrl(r.image_path)} alt="" className="h-10 w-10 rounded-lg object-cover" /> : '—' },
          { key: 'public_id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'sku', label: 'SKU' },
          { key: 'price', label: 'Price', render: (r) => money(r.price) },
          { key: 'available_quantity', label: 'Stock' },
          { key: 'stock_status', label: 'Status', render: (r) => <Badge status={r.stock_status} /> },
        ]}
      />
      <Modal open={open} title="Product" onClose={() => setOpen(false)}>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={save}>
          <Field label="Name"><input name="name" className={inputClass} required /></Field>
          <Field label="SKU"><input name="sku" className={inputClass} required /></Field>
          <Field label="Barcode"><input name="barcode" className={inputClass} /></Field>
          <Field label="Category">
            <select name="category_id" className={inputClass}><option value="">None</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </Field>
          <Field label="Price"><input name="price" type="number" className={inputClass} /></Field>
          <Field label="Discount price"><input name="discount_price" type="number" className={inputClass} /></Field>
          <Field label="Tax"><input name="tax" type="number" className={inputClass} /></Field>
          <Field label="Opening stock"><input name="opening_stock" type="number" className={inputClass} /></Field>
          <Field label="Low stock"><input name="low_stock_level" type="number" className={inputClass} defaultValue={5} /></Field>
          <Field label="Image"><input name="image" type="file" accept="image/*" /></Field>
          <div className="sm:col-span-2"><button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Save</button></div>
        </form>
      </Modal>
    </div>
  );
}
