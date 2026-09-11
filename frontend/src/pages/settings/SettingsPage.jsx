import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Field, inputClass } from '../../components/ui/Field';

export default function SettingsPage() {
  const [s, setS] = useState({
    company_name: '',
    company_phone: '',
    public_scan_url: '',
    shiprocket_email: '',
    shiprocket_password: '',
    shiprocket_pickup: 'work',
    shiprocket_pickup_address: '',
    shiprocket_pickup_city: '',
    shiprocket_pickup_state: '',
    shiprocket_pickup_pin: '',
    shiprocket_pickup_phone: '',
  });
  const [msg, setMsg] = useState('');
  useEffect(() => {
    api.get('/settings').then(({ data }) => setS((prev) => ({ ...prev, ...data.data.settings })));
  }, []);
  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <form className="mt-4 space-y-3 rounded-2xl bg-white p-5" onSubmit={async (e) => {
        e.preventDefault();
        await api.put('/settings', { settings: s });
        setMsg('Saved');
      }}>
        <Field label="Company name"><input className={inputClass} value={s.company_name || ''} onChange={(e) => setS({ ...s, company_name: e.target.value })} /></Field>
        <Field label="Phone"><input className={inputClass} value={s.company_phone || ''} onChange={(e) => setS({ ...s, company_phone: e.target.value })} /></Field>
        <Field label="Public scan path"><input className={inputClass} value={s.public_scan_url || ''} onChange={(e) => setS({ ...s, public_scan_url: e.target.value })} /></Field>
        <h2 className="pt-2 text-sm font-semibold text-brand-600">Shiprocket</h2>
        <p className="text-xs text-slate-500">Login to Shiprocket. Pickup below is YOUR warehouse (from where parcels leave), not the customer address. Customer name, mobile, address, city, state and pincode on the order are sent as the delivery address.</p>
        <Field label="Shiprocket email"><input className={inputClass} value={s.shiprocket_email || ''} onChange={(e) => setS({ ...s, shiprocket_email: e.target.value })} /></Field>
        <Field label="Shiprocket password">
          <input
            type="password"
            className={inputClass}
            value={s.shiprocket_password || ''}
            onChange={(e) => setS({ ...s, shiprocket_password: e.target.value })}
            placeholder="Leave unchanged to keep saved password"
          />
        </Field>
        <Field label="Pickup nickname"><input className={inputClass} value={s.shiprocket_pickup || 'work'} onChange={(e) => setS({ ...s, shiprocket_pickup: e.target.value })} /></Field>
        <Field label="Warehouse address"><input className={inputClass} value={s.shiprocket_pickup_address || ''} onChange={(e) => setS({ ...s, shiprocket_pickup_address: e.target.value })} /></Field>
        <Field label="Warehouse city"><input className={inputClass} value={s.shiprocket_pickup_city || ''} onChange={(e) => setS({ ...s, shiprocket_pickup_city: e.target.value })} /></Field>
        <Field label="Warehouse state"><input className={inputClass} value={s.shiprocket_pickup_state || ''} onChange={(e) => setS({ ...s, shiprocket_pickup_state: e.target.value })} /></Field>
        <Field label="Warehouse pincode"><input className={inputClass} value={s.shiprocket_pickup_pin || ''} onChange={(e) => setS({ ...s, shiprocket_pickup_pin: e.target.value })} /></Field>
        <Field label="Warehouse phone"><input className={inputClass} value={s.shiprocket_pickup_phone || ''} onChange={(e) => setS({ ...s, shiprocket_pickup_phone: e.target.value })} /></Field>
        <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Save</button>
        {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      </form>
    </div>
  );
}
