export default function DataTable({ columns, rows, empty = 'Nothing here yet', footer, rowClass, rowStyle }) {
  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.right ? 'text-right' : ''}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="text-center text-ink-600 py-8">{empty}</td></tr>
          )}
          {rows.map((row, i) => (
            <tr key={row.id ?? i} className={rowClass ? rowClass(row) : ''} style={rowStyle ? rowStyle(row) : undefined}>
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
  );
}
