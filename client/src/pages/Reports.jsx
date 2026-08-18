import { useEffect, useState, useCallback } from 'react';
import { Eye } from 'lucide-react';
import { useApp } from '../auth/AppContext.jsx';
import { api, qs } from '../api/client.js';
import OfflineBlock from '../components/OfflineBlock.jsx';
import Tabs from '../components/Tabs.jsx';
import DataGrid from '../components/DataGrid.jsx';
import FilterBar, { exportCsv } from '../components/FilterBar.jsx';
import { generateTablePdf } from '../print/TablePDF.jsx';
import Modal from '../components/Modal.jsx';

const RM = (n) => `RM ${Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function StatCard({ label, value, accent, sub }) {
  const colors = {
    green:  { bg: '#f0fdf4', border: '#86efac', label: '#166534', value: '#15803d' },
    red:    { bg: '#fef2f2', border: '#fca5a5', label: '#991b1b', value: '#dc2626' },
    amber:  { bg: '#fffbeb', border: '#fcd34d', label: '#92400e', value: '#d97706' },
    blue:   { bg: '#eff6ff', border: '#93c5fd', label: '#1e3a8a', value: '#1d4ed8' },
    purple: { bg: '#faf5ff', border: '#c4b5fd', label: '#4c1d95', value: '#7c3aed' },
    default:{ bg: '#fafaf9', border: '#e5e7eb', label: '#57534e', value: '#1c1917' },
  };
  const c = colors[accent] || colors.default;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '14px 18px', minWidth: 140, flex: '1 1 140px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: c.label, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: c.value, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: c.label, opacity: 0.75, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function MiniBreakdown({ title, rows, valueFormatter }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', flex: '1 1 200px', minWidth: 200 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#78716c', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {rows.map((r) => (
          <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
            <span style={{ color: '#44403c', fontWeight: 500 }}>{r.label}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {r.count !== undefined && <span style={{ color: '#78716c', fontSize: 11 }}>{r.count}×</span>}
              <span style={{ fontWeight: 700, color: '#1c1917', fontVariantNumeric: 'tabular-nums' }}>{valueFormatter ? valueFormatter(r.value) : r.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const KIND_LABELS = { ARCHANAI: 'Archanai', DONATION: 'Donation', ANNADHANAM: 'Annadhanam', HALL_PAYMENT: 'Hall Payment' };
const STATUS_LABELS = { PENDING_DEPOSIT: 'Pending Deposit', CONFIRMED: 'Confirmed', FULLY_PAID: 'Fully Paid', CANCELLED: 'Cancelled' };

const TABS = [
  { key: 'daily-collection', label: 'Daily Collection' },
  { key: 'bookings',         label: 'Hall Bookings' },
  { key: 'payments',         label: 'Hall Payments' },
  { key: 'devotees',         label: 'Devotees' },
  { key: 'audit',            label: 'Audit Log' },
];

const DEFAULT_SORT = {
  'daily-collection': 'txDate',
  bookings:           'eventDate',
  payments:           'txDate',
  devotees:           'createdAt',
  audit:              'createdAt',
};

export default function Reports() {
  const { lookups, can, user, online } = useApp();
  if (!online) return <OfflineBlock />;
  const [tab, setTab] = useState('daily-collection');
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '' });
  const [data, setData] = useState({});
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  const [itemsModal, setItemsModal] = useState(null);

  const fetchAllRows = async () => {
    const effectiveSortBy = sortBy || DEFAULT_SORT[tab] || 'txDate';
    const d = await api(`/reports/${tab}${qs({ ...filters, page: 1, pageSize: 5000, sortBy: effectiveSortBy, sortOrder })}`);
    return d.rows || [];
  };

  const doExportCsv = async (cols) => {
    try { exportCsv(`tmadj-${tab}-${filters.dateFrom || 'all'}.csv`, cols, await fetchAllRows()); } catch {}
  };

  const doExportPdf = async (cols) => {
    try { await generateTablePdf(`${tab.replace(/-/g, ' ')} report`, cols, await fetchAllRows()); } catch {}
  };

  const handleSort = (key) => {
    if (key === sortBy) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortOrder('asc'); }
    setPage(1);
  };
  const handleFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };

  const tabs = TABS.filter((t) => t.key !== 'audit' || user?.role === 'Superadmin');

  const payModes = [
    ...(lookups.PAYMENT_MODE?.values || []),
    ...(lookups.BOOKING_PAYMENT_MODE?.values || []),
  ].filter((v, i, a) => a.findIndex((x) => (x.meta?.code || x.nameEn) === (v.meta?.code || v.nameEn)) === i);

  // POS categories created in Temple Config (isPosMenu=true) — these drive transaction `kind`
  const posCategories = Object.entries(lookups)
    .filter(([, t]) => t.isPosMenu)
    .map(([code, t]) => ({ code, ...t }))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));

  const kindLabels = {
    ...KIND_LABELS,
    ...Object.fromEntries(posCategories.map((c) => [c.code, c.name])),
  };

  const kindOptions = [
    ...posCategories.map((c) => ({ value: c.code, label: c.name })),
    { value: 'HALL_PAYMENT', label: 'Hall Payment' },
  ].filter((v, i, a) => a.findIndex((x) => x.value === v.value) === i);

  const load = useCallback(() => {
    setErr(''); setLoading(true);
    const effectiveSortBy = sortBy || DEFAULT_SORT[tab] || 'txDate';
    api(`/reports/${tab}${qs({ ...filters, page, pageSize, sortBy: effectiveSortBy, sortOrder })}`)
      .then((d) => setData(d || {}))
      .catch((e) => { setData({}); setErr(e.message); })
      .finally(() => setLoading(false));
  }, [tab, filters, page, pageSize, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load]);

  const switchTab = (k) => {
    setTab(k); setFilters({ dateFrom: '', dateTo: '' });
    setPage(1); setSortBy(''); setSortOrder('desc'); setData({});
  };

  // ─── filter defs ───────────────────────────────────────────
  const filterDefs = {
    'daily-collection': [
      { key: 'dateFrom', label: 'From', type: 'date' },
      { key: 'dateTo', label: 'To', type: 'date' },
      { key: 'kind', label: 'Type', type: 'select', options: kindOptions },
      { key: 'paymentMode', label: 'Payment mode', type: 'select', options: payModes.map((m) => ({ value: m.meta?.code || m.nameEn.toUpperCase().replace(/ /g, '_'), label: m.nameEn })) },
      { key: 'status', label: 'Status', type: 'select', options: [{ value: 'PAID', label: 'Paid' }, { value: 'CANCELLED', label: 'Cancelled' }] },
      { key: 'search', label: 'Search', type: 'search', placeholder: 'Receipt no / name' },
    ],
    bookings: [
      { key: 'dateFrom', label: 'From', type: 'date' },
      { key: 'dateTo', label: 'To', type: 'date' },
      { key: 'eventTypeId', label: 'Event type', type: 'select', options: (lookups.HALL_EVENT?.values || []).map((t) => ({ value: t.id, label: t.nameEn })) },
      { key: 'status', label: 'Status', type: 'select', options: Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })) },
      { key: 'search', label: 'Search', type: 'search', placeholder: 'Booking no / name' },
    ],
    payments: [
      { key: 'dateFrom', label: 'From', type: 'date' },
      { key: 'dateTo', label: 'To', type: 'date' },
      { key: 'paymentMode', label: 'Payment mode', type: 'select', options: payModes.map((m) => ({ value: m.meta?.code || m.nameEn.toUpperCase().replace(/ /g, '_'), label: m.nameEn })) },
      { key: 'status', label: 'Status', type: 'select', options: [{ value: 'PAID', label: 'Paid' }, { value: 'CANCELLED', label: 'Cancelled' }] },
      { key: 'search', label: 'Search', type: 'search', placeholder: 'Receipt no / name' },
    ],
    devotees: [
      { key: 'dateFrom', label: 'Registered from', type: 'date' },
      { key: 'dateTo', label: 'To', type: 'date' },
      { key: 'memberType', label: 'Member Type', type: 'select', options: [{ value: 'DEVOTEE', label: 'Devotee' }, { value: 'MEMBER', label: 'Member' }, { value: 'COMMITTEE', label: 'Committee' }] },
      { key: 'search', label: 'Search', type: 'search', placeholder: 'Name / phone / IC' },
    ],
    audit: [
      { key: 'dateFrom', label: 'From', type: 'date' },
      { key: 'dateTo', label: 'To', type: 'date' },
      { key: 'entity', label: 'Entity', type: 'select', options: ['Transaction', 'HallBooking', 'LookupValue', 'User', 'Setting', 'RolePermission'].map((e) => ({ value: e, label: e })) },
      { key: 'action', label: 'Action', type: 'select', options: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'].map((a) => ({ value: a, label: a })) },
    ],
  };

  // ─── columns ───────────────────────────────────────────────
  const txColumns = [
    { key: 'receiptNo', label: 'Receipt', flex: 1, sortable: true, render: (t) => <span className="font-semibold text-maroon-900">{t.receiptNo}</span>, csv: (t) => t.receiptNo },
    { key: 'txDate', label: 'Date & Time', flex: 1.4, sortable: true, render: (t) => new Date(t.txDate).toLocaleString('en-MY'), csv: (t) => new Date(t.txDate).toLocaleString('en-MY') },
    { key: 'kind', label: 'Type', flex: 1, render: (t) => kindLabels[t.kind] || t.kind, csv: (t) => t.kind },
    { key: 'devoteeName', label: 'Devotee', flex: 1.2, sortable: true, render: (t) => t.devoteeName || t.devotee?.name || '—', csv: (t) => t.devoteeName || t.devotee?.name || '' },
    { key: 'items', label: 'Items', flex: 2.5, render: (t) => {
      const items = t.items ?? [];
      const first = items[0];
      const extra = items.length - 1;
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs truncate flex-1 min-w-0">
            {first ? `${first.nameSnapshot} ×${first.qty}` : '—'}
            {extra > 0 && <span className="text-ink-500 ml-1">+{extra} more</span>}
          </span>
          {items.length > 0 && (
            <button className="shrink-0 btn-ghost !p-1 text-ink-400 hover:text-maroon-900" title="View all items" onClick={(e) => { e.stopPropagation(); setItemsModal(t); }}>
              <Eye size={13} />
            </button>
          )}
        </div>
      );
    }, csv: (t) => (t.items ?? []).map((i) => `${i.nameSnapshot}x${i.qty}`).join('; ') },
    { key: 'paymentMode', label: 'Mode', flex: 0.9, sortable: true, render: (t) => (t.paymentMode || '—').replace(/_/g, ' '), csv: (t) => t.paymentMode || '' },
    { key: 'createdBy', label: 'Staff', flex: 0.9, render: (t) => t.createdBy?.name || '—', csv: (t) => t.createdBy?.name || '' },
    { key: 'status', label: 'Status', flex: 0.7, sortable: true, render: (t) => <span className={`chip ${t.status === 'PAID' ? 'chip-paid' : 'chip-cancelled'}`}>{t.status}</span>, csv: (t) => t.status },
    { key: 'total', label: 'Total', flex: 0.8, right: true, sortable: true, render: (t) => <span className={`tabular-nums font-semibold ${t.status === 'CANCELLED' ? 'line-through text-ink-600' : 'text-leaf-700'}`}>{RM(t.total)}</span>, csv: (t) => Number(t.total).toFixed(2) },
  ];

  const bookingColumns = [
    { key: 'bookingNo', label: 'Booking No', sortable: true, render: (b) => <span className="font-semibold text-maroon-900">{b.bookingNo}</span>, csv: (b) => b.bookingNo },
    { key: 'devotee', label: 'Devotee', render: (b) => b.devotee?.name || '—', csv: (b) => b.devotee?.name || '' },
    { key: 'devoteePhone', label: 'Phone', render: (b) => b.devotee?.phone || '—', csv: (b) => b.devotee?.phone || '' },
    { key: 'eventDate', label: 'Event Date', sortable: true, render: (b) => new Date(b.eventDate).toLocaleDateString('en-MY'), csv: (b) => new Date(b.eventDate).toLocaleDateString('en-MY') },
    { key: 'hallRate', label: 'Rate', right: true, sortable: true, render: (b) => <span className="tabular-nums font-semibold">{RM(b.hallRate)}</span>, csv: (b) => Number(b.hallRate).toFixed(2) },
    { key: 'totalPaid', label: 'Paid', right: true, render: (b) => {
      const paid = Number(b.totalPaid || 0);
      const remaining = Number(b.hallRate) - paid;
      return (
        <div>
          <div className="tabular-nums font-semibold text-leaf-700">{RM(paid)}</div>
          {remaining > 0 && b.status !== 'CANCELLED' && <div className="text-xs text-kumkum-600 tabular-nums">{RM(remaining)} left</div>}
        </div>
      );
    }, csv: (b) => Number(b.totalPaid || 0).toFixed(2) },
    { key: 'status', label: 'Status', sortable: true, render: (b) => {
      const cls = { PENDING_DEPOSIT: 'chip-due', CONFIRMED: 'chip bg-blue-100 text-blue-700', FULLY_PAID: 'chip-paid', CANCELLED: 'chip-cancelled' }[b.status] || 'chip';
      return <span className={cls}>{STATUS_LABELS[b.status] || b.status}</span>;
    }, csv: (b) => b.status },
  ];

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const MEMBER_TYPE_LABELS = { DEVOTEE: 'Devotee', MEMBER: 'Member', COMMITTEE: 'Committee' };

  const devoteeColumns = [
    { key: 'name', label: 'Name', sortable: true, render: (d) => <span className="font-semibold">{d.name}</span>, csv: (d) => d.name },
    { key: 'phone', label: 'Phone', render: (d) => d.phone || '—', csv: (d) => d.phone || '' },
    { key: 'icNumber', label: 'IC / Passport', render: (d) => d.icNumber || '—', csv: (d) => d.icNumber || '' },
    { key: 'memberType', label: 'Type', render: (d) => (
      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${d.memberType === 'MEMBER' ? 'bg-gold-100 text-gold-800' : d.memberType === 'COMMITTEE' ? 'bg-maroon-100 text-maroon-800' : 'bg-cream-100 text-ink-600'}`}>
        {MEMBER_TYPE_LABELS[d.memberType] || 'Devotee'}
      </span>
    ), csv: (d) => MEMBER_TYPE_LABELS[d.memberType] || 'Devotee' },
    { key: 'membershipTypeLabel', label: 'Plan', render: (d) => d.memberType === 'MEMBER' ? (d.membershipTypeLabel || '—') : '—', csv: (d) => d.membershipTypeLabel || '' },
    { key: 'membershipPrice', label: 'Membership Fee', right: true, render: (d) => d.membershipPrice ? RM(d.membershipPrice) : '—', csv: (d) => d.membershipPrice ? Number(d.membershipPrice).toFixed(2) : '' },
    { key: 'membershipPaidVia', label: 'Paid Via', render: (d) => d.membershipPaidVia || '—', csv: (d) => d.membershipPaidVia || '' },
    { key: 'membershipEndDate', label: 'Valid Until', render: (d) => fmtDate(d.membershipEndDate), csv: (d) => d.membershipEndDate || '' },
    { key: 'createdAt', label: 'Registered', sortable: true, render: (d) => new Date(d.createdAt).toLocaleDateString('en-MY'), csv: (d) => new Date(d.createdAt).toLocaleDateString('en-MY') },
  ];

  const auditColumns = [
    { key: 'createdAt', label: 'When', sortable: true, render: (a) => new Date(a.createdAt).toLocaleString('en-MY'), csv: (a) => new Date(a.createdAt).toLocaleString('en-MY') },
    { key: 'user', label: 'User', render: (a) => a.user?.name || '—', csv: (a) => a.user?.name || '' },
    { key: 'action', label: 'Action', render: (a) => <span className="chip bg-saffron-100 text-saffron-700">{a.action}</span>, csv: (a) => a.action },
    { key: 'entity', label: 'Entity', csv: (a) => a.entity },
    { key: 'entityId', label: 'Record ID', csv: (a) => a.entityId || '' },
  ];

  const columns = { 'daily-collection': txColumns, bookings: bookingColumns, payments: txColumns, devotees: devoteeColumns, audit: auditColumns }[tab] || txColumns;

  // ─── stat cards ────────────────────────────────────────────
  function renderCards() {
    if (!data || Object.keys(data).length === 0) return null;

    if (tab === 'daily-collection' || tab === 'payments') {
      const avg = data.paidCount > 0 ? Number(data.sumTotal) / data.paidCount : 0;
      const byModeRows = (data.byMode || []).map((g) => ({
        key: g.paymentMode,
        label: (g.paymentMode || 'Unknown').replace(/_/g, ' '),
        count: g._count._all,
        value: Number(g._sum.total || 0),
      })).sort((a, b) => b.value - a.value);

      const byKindRows = (data.byKind || []).map((g) => ({
        key: g.kind,
        label: kindLabels[g.kind] || g.kind,
        count: g._count._all,
        value: Number(g._sum.total || 0),
      })).sort((a, b) => b.value - a.value);

      return (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <StatCard label="Total Collected" value={RM(data.sumTotal)} accent="green" sub={`${data.paidCount || 0} paid transactions`} />
            <StatCard label="Cancelled" value={data.cancelledCount || 0} accent="red" sub="not included in total" />
            <StatCard label="Total Records" value={data.total || 0} accent="default" />
            <StatCard label="Avg per Transaction" value={RM(avg)} accent="amber" />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            {byModeRows.length > 0 && <MiniBreakdown title="By Payment Mode" rows={byModeRows} valueFormatter={RM} />}
            {byKindRows.length > 0 && <MiniBreakdown title="By Type" rows={byKindRows} valueFormatter={RM} />}
          </div>
        </>
      );
    }

    if (tab === 'bookings') {
      const cs = data.countByStatus || {};
      const statusRows = Object.entries(STATUS_LABELS)
        .filter(([k]) => cs[k] !== undefined)
        .map(([k, l]) => ({ key: k, label: l, value: cs[k] }));

      return (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <StatCard label="Total Bookings" value={data.total || 0} accent="default" />
            <StatCard label="Total Hall Rate" value={RM(data.sumRate)} accent="amber" />
            <StatCard label="Collected" value={RM(data.sumPaid)} accent="green" />
            <StatCard label="Outstanding" value={RM(data.outstanding)} accent={Number(data.outstanding) > 0 ? 'red' : 'default'} />
          </div>
          {statusRows.length > 0 && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <MiniBreakdown title="By Status" rows={statusRows} />
            </div>
          )}
        </>
      );
    }

    if (tab === 'devotees') {
      return (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <StatCard label="Filtered Records" value={data.total || 0} accent="default" />
          <StatCard label="All Devotees" value={data.totalAll || 0} accent="blue" />
          <StatCard label="New This Month" value={data.thisMonth || 0} accent="green" />
          <StatCard label="With IC / Passport" value={data.withIc || 0} accent="amber" sub={`${data.withEmail || 0} with email`} />
        </div>
      );
    }

    if (tab === 'audit') {
      const byActionRows = (data.byAction || []).map((g) => ({
        key: g.action,
        label: g.action,
        value: g._count._all,
      })).sort((a, b) => b.value - a.value);

      return (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <StatCard label="Total Entries" value={data.total || 0} accent="default" />
          {byActionRows.length > 0 && <MiniBreakdown title="By Action" rows={byActionRows} />}
        </div>
      );
    }

    return null;
  }

  return (
    <div>
      <Tabs tabs={tabs} active={tab} onChange={switchTab} />

      <FilterBar
        filters={filterDefs[tab] || []}
        values={filters}
        onChange={handleFilter}
        onReset={() => { setFilters({ dateFrom: '', dateTo: '' }); setPage(1); }}
        canExport={can('reports', 'export')}
        exportOptions={[
          { label: 'CSV', onClick: () => doExportCsv(columns) },
          { label: 'PDF', onClick: () => doExportPdf(columns) },
        ]}
      />

      {err && <p className="text-sm text-kumkum-600 mb-3">{err}</p>}

      {renderCards()}

      <DataGrid
        loading={loading}
        columns={columns}
        rows={data.rows || []}
        total={data.total || 0}
        page={page}
        pageSize={pageSize}
        sortBy={sortBy || DEFAULT_SORT[tab]}
        sortOrder={sortOrder}
        onSort={handleSort}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        empty="No records for these filters."
      />

      <Modal title={itemsModal ? `Items — ${itemsModal.receiptNo}` : ''} open={!!itemsModal} onClose={() => setItemsModal(null)}>
        {itemsModal && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gold-300/50">
                <th className="text-left py-2 text-xs font-semibold uppercase tracking-wide text-ink-500 pr-4">Item</th>
                <th className="text-center py-2 text-xs font-semibold uppercase tracking-wide text-ink-500 w-12">Qty</th>
                <th className="text-right py-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Price</th>
              </tr>
            </thead>
            <tbody>
              {(itemsModal.items ?? []).map((item, i) => (
                <tr key={i} className="border-b border-gold-300/20 last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-ink-900">{item.nameSnapshot}</td>
                  <td className="py-2.5 text-center tabular-nums text-ink-600">{item.qty}</td>
                  <td className="py-2.5 text-right tabular-nums font-semibold text-maroon-900">{RM(item.qty > 1 ? item.lineTotal : item.priceSnapshot)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gold-300/50">
                <td colSpan={2} className="pt-3 font-semibold text-ink-700">Total</td>
                <td className="pt-3 text-right tabular-nums font-semibold text-leaf-700">{RM(itemsModal.total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </Modal>
    </div>
  );
}
