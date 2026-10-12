import { Search, RotateCcw, Download, Printer } from 'lucide-react';
import { downloadName } from '../branding.js';
import SearchableSelect from './SearchableSelect.jsx';

// Shared multi-filter bar used by every list page & report
export default function FilterBar({ filters, values, onChange, onReset, onExport, canExport, exportOptions }) {
  return (
    <div className="card p-3 mb-4 flex flex-wrap items-end gap-3 !overflow-visible">
      {filters.map((f) => (
        <div key={f.key} className="min-w-[150px]">
          <label className="label">{f.label}</label>
          {f.type === 'select' ? (
            <SearchableSelect
              options={[{ value: '', label: 'All' }, ...f.options]}
              value={values[f.key] || ''}
              onChange={(v) => onChange(f.key, v)}
              placeholder="All"
              clearable
            />
          ) : f.type === 'date' ? (
            <input type="date" className="input" value={values[f.key] || ''} onChange={(e) => onChange(f.key, e.target.value)} />
          ) : (
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-ink-600/50" />
              <input className="input !pl-8" placeholder={f.placeholder || 'Search...'} value={values[f.key] || ''} onChange={(e) => onChange(f.key, e.target.value)} />
            </div>
          )}
        </div>
      ))}
      <button className="btn-ghost !p-2" title="Reset filters" onClick={onReset}><RotateCcw size={15} /></button>
      {exportOptions && canExport && exportOptions.map(({ label, onClick, disabled: optDisabled }) => {
        const isPdf = label.toUpperCase().includes('PDF');
        return (
          <button
            key={label}
            className="btn-outline !py-1.5 !px-2.5 text-xs flex items-center gap-1.5"
            onClick={onClick}
            disabled={optDisabled}
            title={label}
          >
            {isPdf ? <Printer size={13} /> : <Download size={13} />}
            {label}
          </button>
        );
      })}
      {!exportOptions && onExport && canExport && <button className="btn-ghost !p-2" title="Export CSV" onClick={onExport}><Download size={15} /></button>}
    </div>
  );
}

export function printTable(title, columns, rows) {
  const esc = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const thead = columns.map((c) => `<th${c.right ? ' class="r"' : ''}>${esc(c.label)}</th>`).join('');
  const tbody = rows.map((r) =>
    `<tr>${columns.map((c) => `<td${c.right ? ' class="r"' : ''}>${esc(c.csv ? c.csv(r) : r[c.key])}</td>`).join('')}</tr>`
  ).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;margin:16px;color:#1c1917}
  h2{font-size:14px;margin:0 0 10px;color:#5C1A1B}
  table{width:100%;border-collapse:collapse}
  th{background:#5C1A1B;color:#fff;padding:6px 8px;text-align:left;font-size:10px;font-weight:700}
  td{padding:5px 8px;border-bottom:1px solid #eee;font-size:11px;vertical-align:top}
  .r{text-align:right}
  tr:nth-child(even) td{background:#fdf8f0}
  @media print{body{margin:0}}
</style></head>
<body><h2>${esc(title)}</h2>
<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
}

export function exportCsv(filename, columns, rows) {
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const lines = [columns.map((c) => esc(c.label)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => esc(c.csv ? c.csv(r) : r[c.key])).join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = downloadName(filename);
  a.click();
  URL.revokeObjectURL(a.href);
}
