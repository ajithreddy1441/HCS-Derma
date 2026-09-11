import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import ScanResult from '../../components/scan/ScanResult';

const base = import.meta.env.VITE_API_URL || '/api';

export default function PublicScan() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${base}/scan/${encodeURIComponent(token)}`)
      .then(({ data: d }) => setData(d.data))
      .catch(() => setErr('QR not found or inactive'))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-[#eef4f0]">
      <header className="bg-brand-600 text-white shadow-lg">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-5 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xs font-bold tracking-wide text-brand-600 shadow-sm">
            HCS
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold leading-tight">HCS DERMA</p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/70">Product status</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {loading && (
          <div className="space-y-3">
            <div className="h-28 animate-pulse rounded-2xl bg-white" />
            <div className="h-40 animate-pulse rounded-2xl bg-white" />
            <div className="h-40 animate-pulse rounded-2xl bg-white" />
          </div>
        )}
        {err && <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-100">{err}</p>}
        {data && <ScanResult data={data} />}
        <p className="mt-8 text-center text-[11px] text-slate-400">HCS DERMA · Authenticated product scan</p>
      </main>
    </div>
  );
}
