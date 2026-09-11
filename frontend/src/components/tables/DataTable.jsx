import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';

export default function DataTable({ columns, rows, onRow, empty = 'No records found' }) {
  if (!rows?.length) return <EmptyState title={empty} />;
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-3 font-semibold">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id || row.public_id}
                onClick={() => onRow?.(row)}
                className={`border-t border-slate-100 ${onRow ? 'cursor-pointer hover:bg-slate-50' : ''}`}
              >
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3 align-middle">
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <button
            key={row.id || row.public_id}
            type="button"
            onClick={() => onRow?.(row)}
            className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"
          >
            {columns.slice(0, 4).map((c) => (
              <div key={c.key} className="mb-1 flex justify-between gap-3 text-sm">
                <span className="text-slate-400">{c.label}</span>
                <span className="font-medium text-slate-800">{c.render ? c.render(row) : row[c.key]}</span>
              </div>
            ))}
            {row.status && <Badge status={row.status} />}
          </button>
        ))}
      </div>
    </>
  );
}
