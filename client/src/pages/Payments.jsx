import { useEffect, useState, useCallback } from 'react';
import { Search, X, RotateCcw, Eye } from 'lucide-react';
import { useApp } from '../auth/AppContext.jsx';
import { api, qs } from '../api/client.js';
import DataGrid from '../components/DataGrid.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import Modal from '../components/Modal.jsx';

const RM = (n) => `RM ${Number(n || 0).toFixed(2)}`;
const today = () => new Date().toLocaleDateString('en-CA');

const KIND_LABEL = {
  ARCHANAI: 'Archanai',
  DONATION: 'Donation',
  ANNADHANAM: 'Annadhanam',
  HALL_PAYMENT: 'Hall Booking',
  MEMBERSHIP: 'Membership',
};

const KIND_CHIP = {
  ARCHANAI: 'bg-saffron-100 text-saffron-700',
  DONATION: 'bg-leaf-100 text-leaf-700',
  ANNADHANAM: 'bg-gold-100 text-gold-700',
  HALL_PAYMENT: 'bg-maroon-100 text-maroon-700',
  MEMBERSHIP: 'bg-purple-100 text-purple-700',
};

const MODE_CHIP = {
  CASH: 'bg-leaf-100 text-leaf-700',
  DUITNOW_QR: 'bg-blue-100 text-blue-700',
  BANK_TRANSFER: 'bg-indigo-100 text-indigo-700',
  CHEQUE: 'bg-purple-100 text-purple-700',
};

const FALLBACK_PAY_MODES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'DUITNOW_QR', label: 'DuitNow QR' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'ONLINE_TRANSFER', label: 'Online Transfer' },
];

export default function Payments() {
  const { lookups } = useApp();
  const payModes = [
    ...(lookups.PAYMENT_MODE?.values || []),
    ...(lookups.BOOKING_PAYMENT_MODE?.values || []),
  ].filter((v) => v.isActive).filter((v, i, a) => a.findIndex((x) => (x.meta?.code || x.nameEn) === (v.meta?.code || v.nameEn)) === i);

  const payModeOptions = payModes.length
    ? payModes.map((m) => ({ value: m.nameEn, label: m.nameEn }))
    : FALLBACK_PAY_MODES;

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [sum, setSum] = useState(0);
  const [loading, setLoading] = useState(false);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [type, setType] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const [itemsModal, setItemsModal] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('txDate');
  const [sortOrder, setSortOrder] = useState('desc');

  const isMembership = type === 'membership';
  const isAll = !type;

  const load = useCallback(() => {
    setLoading(true);
    if (isAll) {
      const txQ = qs({ dateFrom, dateTo, paymentMode, status, search, page: 1, pageSize: 500, sortBy: 'txDate', sortOrder: 'desc' });
      const memQ = qs({ dateFrom, dateTo, paymentMode, search, page: 1, pageSize: 500 });
      Promise.all([api(`/payments${txQ}`), api(`/payments/membership${memQ}`)])
        .then(([txData, memData]) => {
          const txRows = (txData.rows || []).map((t) => ({ ...t, _type: 'transaction', _sortDate: t.txDate }));
          const memRows = (memData.rows || []).map((m) => ({ ...m, _type: 'membership', _sortDate: m.membershipStartDate, kind: 'MEMBERSHIP' }));
          const merged = [...txRows, ...memRows].sort((a, b) => new Date(b._sortDate) - new Date(a._sortDate));
          const offset = (page - 1) * pageSize;
          setRows(merged.slice(offset, offset + Number(pageSize)));
          setTotal(merged.length);
          setSum(Number(txData.sum || 0) + Number(memData.sum || 0));
        })
        .catch(() => {})
        .finally(() => setLoading(false));
      return;
    }
    const endpoint = isMembership
      ? `/payments/membership${qs({ dateFrom, dateTo, paymentMode, search, page, pageSize, sortBy, sortOrder })}`
      : `/payments${qs({ dateFrom, dateTo, type, paymentMode, status, search, page, pageSize, sortBy, sortOrder })}`;
    api(endpoint)
      .then((d) => { setRows(d.rows); setTotal(d.total); setSum(d.sum); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, type, paymentMode, status, search, page, pageSize, sortBy, sortOrder, isAll, isMembership]);

  useEffect(() => { load(); }, [load]);

  const handleSort = (col) => {
    if (sortBy === col) setSortOrder((o) => o === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortOrder('desc'); }
    setPage(1);
  };

  const reset = () => {
    setDateFrom(''); setDateTo('');
    setType(''); setPaymentMode(''); setStatus(''); setSearch('');
    setPage(1);
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const allColumns = [
    {
      key: 'date', label: 'Date & Time',
      render: (r) => (
        <span className="text-xs text-ink-600 whitespace-nowrap">
          {r._type === 'membership'
            ? fmtDate(r.membershipStartDate)
            : new Date(r.txDate).toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      ),
    },
    {
      key: 'kind', label: 'Type',
      render: (r) => (
        <span className={`chip text-xs ${KIND_CHIP[r.kind] || 'bg-cream-100 text-ink-600'}`}>
          {KIND_LABEL[r.kind] || r.kind}
        </span>
      ),
    },
    {
      key: 'ref', label: 'Reference',
      render: (r) => r._type === 'membership' ? (
        <span className="text-sm font-medium text-maroon-900">{r.membershipTypeLabel || '—'}</span>
      ) : (
        <div>
          <p className="font-semibold text-maroon-900 text-sm">{r.receiptNo || r.localChitNo || '—'}</p>
          {r.booking?.bookingNo && (
            <p className="text-xs text-ink-600 mt-0.5">Booking: <span className="font-medium text-maroon-700">{r.booking.bookingNo}</span></p>
          )}
        </div>
      ),
    },
    {
      key: 'devotee', label: 'Devotee',
      render: (r) => {
        const name = r._type === 'membership' ? r.name : (r.devotee?.name || r.devoteeName);
        const phone = r._type === 'membership' ? r.phone : r.devotee?.phone;
        if (!name) return <span className="text-ink-400">—</span>;
        return <div><p className="text-sm font-medium">{name}</p>{phone && <p className="text-xs text-ink-600">{phone}</p>}</div>;
      },
    },
    {
      key: 'desc', label: 'Items / Plan',
      render: (r) => {
        if (r._type === 'membership') {
          return <span className="text-xs text-ink-600">{fmtDate(r.membershipStartDate)} – {fmtDate(r.membershipEndDate)}</span>;
        }
        if (!r.items?.length) return <span className="text-ink-400 text-xs">—</span>;
        const first = r.items[0];
        const extra = r.items.length - 1;
        return (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs text-ink-700 truncate flex-1 min-w-0">
              {first.nameSnapshot} <span className="text-ink-400">×{first.qty}</span>
              {extra > 0 && <span className="text-ink-400 ml-1">+{extra} more</span>}
            </span>
            <button className="shrink-0 btn-ghost !p-1 text-ink-400 hover:text-maroon-900" title="View all items" onClick={(e) => { e.stopPropagation(); setItemsModal(r); }}>
              <Eye size={13} />
            </button>
          </div>
        );
      },
    },
    {
      key: 'total', label: 'Amount', right: true,
      render: (r) => {
        const amount = r._type === 'membership' ? r.membershipPrice : r.total;
        const cancelled = r._type !== 'membership' && r.status === 'CANCELLED';
        return <span className={`font-semibold tabular-nums ${cancelled ? 'line-through text-ink-400' : 'text-maroon-900'}`}>{RM(amount)}</span>;
      },
    },
    {
      key: 'mode', label: 'Mode',
      render: (r) => {
        const mode = r._type === 'membership' ? r.membershipPaidVia : r.paymentMode;
        return <span className={`chip text-xs ${MODE_CHIP[mode] || 'bg-cream-100 text-ink-600'}`}>{mode?.replace(/_/g, ' ') || '—'}</span>;
      },
    },
    {
      key: 'status', label: 'Status',
      render: (r) => (r._type === 'membership' || r.status === 'PAID')
        ? <span className="chip-paid">Paid</span>
        : <span className="chip-cancelled">Cancelled</span>,
    },
  ];

  const membershipColumns = [
    { key: 'name', label: 'Name', sortable: true, render: (d) => <span className="font-semibold text-maroon-900">{d.name}</span> },
    { key: 'phone', label: 'Contact', render: (d) => d.phone || '—' },
    { key: 'icNumber', label: 'IC / Passport', render: (d) => d.icNumber || '—' },
    { key: 'membershipTypeLabel', label: 'Plan', render: (d) => d.membershipTypeLabel || '—' },
    { key: 'membershipPaidVia', label: 'Paid Via', render: (d) => d.membershipPaidVia || '—' },
    { key: 'membershipStartDate', label: 'Valid From', sortable: true, render: (d) => fmtDate(d.membershipStartDate) },
    { key: 'membershipEndDate', label: 'Valid Until', render: (d) => fmtDate(d.membershipEndDate) },
    {
      key: 'total', label: 'Amount', right: true,
      render: (d) => <span className="font-semibold tabular-nums text-maroon-900">{RM(d.membershipPrice)}</span>,
    },
    { key: 'status', label: 'Status', render: () => <span className="chip chip-paid">Paid</span> },
  ];

  const transactionColumns = [
    {
      key: 'txDate', label: 'Date & Time', sortable: true,
      render: (t) => (
        <span className="text-xs text-ink-600 whitespace-nowrap">
          {new Date(t.txDate).toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      ),
    },
    {
      key: 'ref', label: 'Reference',
      render: (t) => (
        <div>
          <p className="font-semibold text-maroon-900 text-sm">{t.receiptNo || t.localChitNo || '—'}</p>
          {t.booking?.bookingNo && (
            <p className="text-xs text-ink-600 mt-0.5">Booking: <span className="font-medium text-maroon-700">{t.booking.bookingNo}</span></p>
          )}
        </div>
      ),
    },
    {
      key: 'kind', label: 'Type',
      render: (t) => (
        <span className={`chip text-xs ${KIND_CHIP[t.kind] || 'bg-cream-100 text-ink-600'}`}>
          {KIND_LABEL[t.kind] || t.kind}
        </span>
      ),
    },
    {
      key: 'devotee', label: 'Devotee',
      render: (t) => {
        const name = t.devotee?.name || t.devoteeName;
        const phone = t.devotee?.phone;
        if (!name) return <span className="text-ink-400">—</span>;
        return (
          <div>
            <p className="text-sm font-medium">{name}</p>
            {phone && <p className="text-xs text-ink-600">{phone}</p>}
          </div>
        );
      },
    },
    {
      key: 'items', label: 'Items',
      render: (t) => {
        if (!t.items?.length) return <span className="text-ink-400 text-xs">—</span>;
        const first = t.items[0];
        const extra = t.items.length - 1;
        return (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs text-ink-700 truncate flex-1 min-w-0">
              {first.nameSnapshot} <span className="text-ink-400">×{first.qty}</span>
              {extra > 0 && <span className="text-ink-400 ml-1">+{extra} more</span>}
            </span>
            <button className="shrink-0 btn-ghost !p-1 text-ink-400 hover:text-maroon-900" title="View all items" onClick={(e) => { e.stopPropagation(); setItemsModal(t); }}>
              <Eye size={13} />
            </button>
          </div>
        );
      },
    },
    {
      key: 'total', label: 'Amount', sortable: true, right: true,
      render: (t) => (
        <span className={`font-semibold tabular-nums ${t.status === 'CANCELLED' ? 'line-through text-ink-400' : 'text-maroon-900'}`}>
          {RM(t.total)}
        </span>
      ),
    },
    {
      key: 'paymentMode', label: 'Mode',
      render: (t) => (
        <span className={`chip text-xs ${MODE_CHIP[t.paymentMode] || 'bg-cream-100 text-ink-600'}`}>
          {t.paymentMode?.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: (t) => t.status === 'CANCELLED'
        ? <span className="chip-cancelled">Cancelled</span>
        : <span className="chip-paid">Paid</span>,
    },
    {
      key: 'createdBy', label: 'Recorded by',
      render: (t) => (
        <span className="text-sm text-ink-700">{t.createdBy?.name || '—'}</span>
      ),
    },
  ];

  const columns = isAll ? allColumns : isMembership ? membershipColumns : transactionColumns;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-4 !overflow-visible">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          </div>
          <div className="min-w-[140px]">
            <label className="label">Type</label>
            <SearchableSelect
              options={[
                { value: '', label: 'All types' },
                { value: 'booking', label: 'Hall Booking' },
                { value: 'order', label: 'POS Order' },
                { value: 'membership', label: 'Membership' },
              ]}
              value={type}
              onChange={(v) => { setType(v); setPage(1); }}
            />
          </div>
          <div className="min-w-[150px]">
            <label className="label">Payment mode</label>
            <SearchableSelect
              options={[{ value: '', label: 'All modes' }, ...payModeOptions]}
              value={paymentMode}
              onChange={(v) => { setPaymentMode(v); setPage(1); }}
            />
          </div>
          {!isMembership && !isAll && (
            <div className="min-w-[130px]">
              <label className="label">Status</label>
              <SearchableSelect
                options={[{ value: '', label: 'All' }, { value: 'PAID', label: 'Paid' }, { value: 'CANCELLED', label: 'Cancelled' }]}
                value={status}
                onChange={(v) => { setStatus(v); setPage(1); }}
              />
            </div>
          )}
          <div className="flex-1 min-w-[200px]">
            <label className="label">Search</label>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-ink-600/50" />
              <input
                className="input !pl-8"
                placeholder="Booking no, receipt, devotee…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
              {search && (
                <button className="absolute right-2 top-2 text-ink-400 hover:text-ink-700" onClick={() => { setSearch(''); setPage(1); }}>
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
          <button className="btn-ghost !p-2" title="Reset filters" onClick={reset}><RotateCcw size={15} /></button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 px-1">
        <p className="text-sm text-ink-600">
          <span className="font-semibold text-maroon-900">{total}</span> payment{total !== 1 ? 's' : ''}
        </p>
        <p className="text-sm text-ink-600">
          Total collected: <span className="font-semibold text-leaf-700">{RM(sum)}</span>
        </p>
      </div>

      {/* Table */}
      <DataGrid
        loading={loading}
        empty="No payments found."
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
      />

      <Modal title={itemsModal ? `Items — ${itemsModal.receiptNo || itemsModal.localChitNo}` : ''} open={!!itemsModal} onClose={() => setItemsModal(null)}>
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
