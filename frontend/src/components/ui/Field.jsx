export function Field({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500 focus:ring-2';
