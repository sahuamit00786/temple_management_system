import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZES = [10, 25, 50, 100];

export default function DataGrid({
  columns, rows, total = 0, empty = 'Nothing here yet', footer,
  page = 1, pageSize = 25,
  onPageChange, onPageSizeChange,
  sortBy, sortOrder = 'desc', onSort,
  loading = false,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pageNums = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const nums = [1];
    if (page > 3) nums.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) nums.push(i);
    if (page < totalPages - 2) nums.push('…');
    nums.push(totalPages);
    return nums;
  })();

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={[
                    c.right ? 'text-right' : '',
                    c.sortable ? 'cursor-pointer select-none hover:bg-cream-100 transition-colors' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => c.sortable && onSort?.(c.key)}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {c.label}
                    {c.sortable && (
                      sortBy === c.key
                        ? sortOrder === 'asc'
                          ? <ChevronUp size={13} className="text-maroon-700 shrink-0" />
                          : <ChevronDown size={13} className="text-maroon-700 shrink-0" />
                        : <ChevronsUpDown size={13} className="text-ink-600/40 shrink-0" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                {columns.map((c) => (
                  <td key={c.key}>
                    <div className="h-4 bg-gray-200 rounded" style={{ width: `${50 + ((i * 13 + c.key.length * 9) % 40)}%` }} />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={columns.length} className="text-center text-ink-600 py-10">{empty}</td></tr>
            )}
            {!loading && rows.map((row, i) => (
              <tr key={row.id ?? i}>
                {columns.map((c) => (
                  <td key={c.key} className={c.right ? 'text-right tabular-nums' : ''}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>

      {/* Pagination bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-cream-200 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-600">Rows</span>
          <select
            className="input !py-0.5 !px-2 !text-xs !w-16"
            value={pageSize}
            onChange={(e) => { onPageSizeChange?.(Number(e.target.value)); onPageChange?.(1); }}
          >
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="text-xs text-ink-600">
            {total === 0 ? 'No results' : `${from}–${to} of ${total}`}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          <button className="btn-ghost !p-1.5" disabled={page <= 1} onClick={() => onPageChange?.(page - 1)} aria-label="Previous page">
            <ChevronLeft size={15} />
          </button>
          {pageNums.map((p, i) =>
            p === '…'
              ? <span key={`e${i}`} className="px-1.5 text-xs text-ink-600">…</span>
              : <button
                  key={p}
                  className={`min-w-[28px] h-7 rounded text-xs font-medium px-1 transition-colors ${p === page ? 'bg-maroon-900 text-cream-50' : 'btn-ghost'}`}
                  onClick={() => onPageChange?.(p)}
                >{p}</button>
          )}
          <button className="btn-ghost !p-1.5" disabled={page >= totalPages} onClick={() => onPageChange?.(page + 1)} aria-label="Next page">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Shared sort handler factory — call inside a component */
export function useSortState(defaultField = 'createdAt', defaultOrder = 'desc') {
  return {
    handler: (current, setCurrent, setOrder, setPage) => (key) => {
      if (key === current) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
      else { setCurrent(key); setOrder('asc'); }
      setPage(1);
    },
  };
}
