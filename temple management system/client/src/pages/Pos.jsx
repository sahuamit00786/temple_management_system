import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTabParam } from '../hooks/useTabParam.js';
import { downloadName } from '../branding.js';
import { useSearchParams } from 'react-router-dom';
import { Minus, Plus, Printer, QrCode, Banknote, Search, Pencil, XCircle, Receipt, RotateCcw, Download, WifiOff } from 'lucide-react';
// Search kept for All Orders search bar
import { useApp } from '../auth/AppContext.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import DevoteeSearch from '../components/DevoteeSearch.jsx';
import DataGrid from '../components/DataGrid.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import Tabs from '../components/Tabs.jsx';
import Chit, { buildChitHtml, ChitContent } from '../print/Chit.jsx';
import { Toast, useToast } from '../components/Toast.jsx';
import { api, qs } from '../api/client.js';
import { queueTransaction } from '../db/syncEngine.js';
import { ldb } from '../db/dexie.js';
import { generateTablePdf } from '../print/TablePDF.jsx';
import { getDeviceId, savePrinterPreference } from '../utils/printerMemory.js';

function nextLocalChit(prefix, digits = 6) {
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  return `${prefix}-${Math.floor(Math.random() * (max - min + 1)) + min}`;
}


function ItemCard({ item, inCart, onAdd, onSetQty }) {
  if (inCart) {
    return (
      <div className="card p-3 ring-2 ring-maroon-900 bg-maroon-900/5 flex flex-col gap-2">
        <div>
          <p className="font-semibold text-maroon-900 leading-snug text-sm truncate">{item.nameEn}</p>
          <p className="text-saffron-600 font-display text-base tabular-nums leading-tight">
            {item.price != null ? `RM ${Number(item.price).toFixed(2)}` : 'Open'}
          </p>
        </div>
        <div className="flex items-center justify-between bg-white/70 rounded-md px-0.5 py-0.5 border border-maroon-900/10">
          <button
            type="button"
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-kumkum-100 text-maroon-900 transition focus:outline-none"
            onClick={() => onSetQty(inCart.qty - 1)}
          ><Minus size={10} /></button>
          <span className="tabular-nums font-bold text-maroon-900 text-xs">{inCart.qty}</span>
          <button
            type="button"
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-leaf-100 text-maroon-900 transition focus:outline-none"
            onClick={() => onSetQty(inCart.qty + 1)}
          ><Plus size={10} /></button>
        </div>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="card p-3 text-left transition hover:shadow-glow flex flex-col gap-1 focus:outline-none"
      onClick={() => onAdd(item)}
    >
      <p className="font-semibold text-maroon-900 leading-snug text-sm">{item.nameEn}</p>
      <p className="text-saffron-600 font-display text-base mt-auto tabular-nums">
        {item.price != null ? `RM ${Number(item.price).toFixed(2)}` : 'Open amount'}
      </p>
    </button>
  );
}


const POS_TABS = [{ key: 'create', label: 'Create Order' }, { key: 'orders', label: 'All Orders' }];
const RM = (n) => `RM ${Number(n || 0).toFixed(2)}`;

export default function Pos() {
  const { lookups, settings, can, user, online } = useApp();
  const [searchParams] = useSearchParams();
  const [posTab, setPosTab] = useTabParam('create', ['create', 'orders']);

  const today = new Date().toLocaleDateString('en-CA');

  // ── Create Order state ──
  const [cart, setCart] = useState([]);
  const [devoteeName, setDevoteeName] = useState('');
  const [devoteeId, setDevoteeId] = useState(null);
  const [starId, setStarId] = useState('');
  const [paying, setPaying] = useState(null);
  const [tendered, setTendered] = useState('');
  const [lastChit, setLastChit] = useState(null);
  const [lastPayMode, setLastPayMode] = useState('');

  // ── All Orders state ──
  const [orders, setOrders] = useState({ rows: [], total: 0 });
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordPage, setOrdPage] = useState(1);
  const [ordPageSize, setOrdPageSize] = useState(25);
  const [ordSortBy, setOrdSortBy] = useState('txDate');
  const [ordSortOrder, setOrdSortOrder] = useState('desc');
  const [ordSearch, setOrdSearch] = useState('');
  const [ordDateFrom, setOrdDateFrom] = useState(() => searchParams.get('dateFrom') || '');
  const [ordDateTo, setOrdDateTo] = useState(() => searchParams.get('dateTo') || '');
  const [ordPayMode, setOrdPayMode] = useState('');
  const [ordStatus, setOrdStatus] = useState('');
  const [cancelling, setCancelling] = useState(null);
  const [cancelErr, setCancelErr] = useState('');
  const [viewing, setViewing] = useState(null);
  const [chitHtml, setChitHtml] = useState(null);
  const chitIframeRef = useRef(null);
  const mobileChitIframeRef = useRef(null);
  const [cartPreviewOpen, setCartPreviewOpen] = useState(false);
  const [prefillSource, setPrefillSource] = useState(null);
  const [editing, setEditing] = useState(null); // { id, receiptNo, snapshot } while editing an existing order
  const [savingEdit, setSavingEdit] = useState(false);
  const { msg: toastMsg, show: showToast, clear: clearToast } = useToast();
  const [receiptPrefix, setReceiptPrefix] = useState(localStorage.getItem('tmadj.receiptPrefix') || 'ORD');
  const [receiptDigits, setReceiptDigits] = useState(Number(localStorage.getItem('tmadj.receiptDigits') || 6));

  const payModes = lookups.PAYMENT_MODE?.values?.filter((v) => v.isActive) || [];
  const payModeOptions = payModes.map((m) => ({ value: m.meta?.code || m.nameEn.toUpperCase(), label: m.nameEn }));

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const data = await api(`/transactions${qs({ type: 'order', dateFrom: ordDateFrom, dateTo: ordDateTo, search: ordSearch, paymentMode: ordPayMode, status: ordStatus, page: ordPage, pageSize: ordPageSize, sortBy: ordSortBy, sortOrder: ordSortOrder })}`);
      // Merge any unsynced local transactions not yet on server
      let pendingRows = [];
      try {
        const serverUuids = new Set((data.rows || []).map((r) => r.clientUuid).filter(Boolean));
        const local = await ldb.localTx.toArray();
        pendingRows = local
          .filter((t) => !t.synced && !serverUuids.has(t.clientUuid))
          .map((t) => ({ ...t, receiptNo: t.receiptNo || t.localChitNo, status: t.status || 'PAID', _local: true }))
          .sort((a, b) => new Date(b.txDate) - new Date(a.txDate));
      } catch {}
      setOrders({ rows: [...pendingRows, ...(data.rows || [])], total: (data.total || 0) + pendingRows.length });
    } catch {
      // Offline — serve from IndexedDB localTx
      try {
        const all = await ldb.localTx.toArray();
        all.sort((a, b) => new Date(b.txDate) - new Date(a.txDate));
        const offset = (ordPage - 1) * ordPageSize;
        setOrders({
          rows: all.slice(offset, offset + ordPageSize).map((t) => ({ ...t, receiptNo: t.receiptNo || t.localChitNo, status: t.status || 'PAID' })),
          total: all.length,
        });
      } catch { setOrders({ rows: [], total: 0 }); }
    } finally {
      setOrdersLoading(false);
    }
  }, [ordPage, ordPageSize, ordSortBy, ordSortOrder, ordSearch, ordDateFrom, ordDateTo, ordPayMode, ordStatus]);

  useEffect(() => { if (posTab === 'orders') loadOrders(); }, [posTab, loadOrders]);

  useEffect(() => {
    api('/settings/numbering').then((d) => {
      const p = d.receiptPrefix || 'ORD';
      const dig = d.receiptDigits || 6;
      setReceiptPrefix(p); setReceiptDigits(dig);
      localStorage.setItem('tmadj.receiptPrefix', p);
      localStorage.setItem('tmadj.receiptDigits', String(dig));
    }).catch(() => {});
  }, []);

  const handleOrdSort = (key) => {
    if (key === ordSortBy) setOrdSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setOrdSortBy(key); setOrdSortOrder('asc'); }
    setOrdPage(1);
  };

  const cancelOrder = async () => {
    setCancelErr('');
    try {
      await api(`/transactions/${cancelling.id}`, { method: 'DELETE' });
      setCancelling(null); loadOrders();
    } catch (e) { setCancelErr(e.message); }
  };

  const formSnapshot = (c, name, dId, sId) => JSON.stringify({
    cart: c.map((i) => [i.lookupValueId, i.qty, Number(i.priceSnapshot)]),
    name: name || '', dId: dId || null, sId: sId || '',
  });

  // Edit an existing order in place (no new order is created)
  const loadFromOrder = (t) => {
    const newCart = (t.items || []).map((i) => ({
      lookupValueId: i.lookupValueId,
      nameSnapshot: i.nameSnapshot,
      nameTa: i.nameTa || null,
      priceSnapshot: Number(i.priceSnapshot),
      qty: i.qty || 1,
      kind: t.kind,
    }));
    const sId = String(stars.find((s) => s.nameEn === t.starNatchathiram)?.id || '');
    setCart(newCart);
    setDevoteeName(t.devoteeName || '');
    setDevoteeId(t.devoteeId || null);
    setStarId(sId);
    setPrefillSource(null);
    setEditing({ id: t.id, receiptNo: t.receiptNo, snapshot: formSnapshot(newCart, t.devoteeName, t.devoteeId, sId), paymentMode: t.paymentMode });
    setPosTab('create');
  };

  const clearForm = () => { setCart([]); setDevoteeName(''); setDevoteeId(null); setStarId(''); setPrefillSource(null); setEditing(null); };

  const saveEdit = async () => {
    setSavingEdit(true);
    try {
      const updated = await api(`/transactions/${editing.id}`, {
        method: 'PUT',
        body: { items: cart, devoteeName: devoteeName || null, devoteeId: devoteeId || null, starNatchathiram: starName || null },
      });
      setLastChit(updated);
      setEditing((e) => ({ ...e, snapshot: formSnapshot(cart, devoteeName, devoteeId, starId), paymentMode: updated.paymentMode }));
      loadOrders();
      showToast(`Order ${updated.receiptNo || ''} updated`);
    } catch (e) { showToast(e.message || 'Failed to save order'); }
    finally { setSavingEdit(false); }
  };

  const stars = lookups.NATCHATHIRAM?.values || [];
  const starName = stars.find((s) => String(s.id) === starId)?.nameEn || '';

  // Chit preview width — mirrors receipt.paperWidth (58mm/80mm at 96dpi)
  const chitPreviewWidth = settings['receipt.paperWidth'] === '58' ? 220 : 310;

  // POS menu categories (marked isPosMenu=true and not hidden in Temple Config)
  const posCategories = useMemo(() =>
    Object.entries(lookups)
      .filter(([, t]) => t.isPosMenu && t.isActive !== false)
      .map(([code, t]) => ({ code, ...t }))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)),
    [lookups]
  );

  const [posCategory, setPosCategory] = useState('');

  // Auto-select first category
  useEffect(() => {
    if (posCategories.length > 0 && (!posCategory || !posCategories.find((c) => c.code === posCategory))) {
      setPosCategory(posCategories[0].code);
    }
  }, [posCategories]); // eslint-disable-line react-hooks/exhaustive-deps

  const categoryItems = useMemo(() => {
    if (!posCategory) return [];
    return (lookups[posCategory]?.values || []).filter((v) => v.isActive);
  }, [posCategory, lookups]);

  const categoryParents = useMemo(() => categoryItems.filter((v) => !v.parentId), [categoryItems]);
  const categoryIsTree = useMemo(() => categoryItems.some((v) => v.parentId), [categoryItems]);
  const childrenOf = useCallback((parentId) => categoryItems.filter((v) => v.parentId === parentId), [categoryItems]);

  const add = (v) => {
    setCart((c) => {
      const found = c.find((i) => i.lookupValueId === v.id);
      if (found) return c.map((i) => (i.lookupValueId === v.id ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { lookupValueId: v.id, nameSnapshot: v.nameEn, nameTa: v.nameTa || null, priceSnapshot: Number(v.price || 0), qty: 1, kind: v._kind }];
    });
  };

  const addWithKind = (v, kind) => add({ ...v, _kind: kind });

  const setQty = (id, qty) => {
    if (qty < 1) return setCart((c) => c.filter((i) => i.lookupValueId !== id));
    setCart((c) => c.map((i) => (i.lookupValueId === id ? { ...i, qty } : i)));
  };

  const editDirty = !!editing && formSnapshot(cart, devoteeName, devoteeId, starId) !== editing.snapshot;
  // While editing, changes must be saved before payment
  const payDisabled = !cart.length || editDirty;
  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  const total = cart.reduce((s, i) => s + i.priceSnapshot * i.qty, 0);
  const change = Number(tendered || 0) - total;

const previewChitNo = `${receiptPrefix}-${'X'.repeat(receiptDigits)}`;

  const livePreviewChit = {
    receiptNo: null,
    localChitNo: previewChitNo,
    items: cart,
    total,
    tendered: Number(tendered) || total,
    paymentMode: lastPayMode || 'CASH',
    deviceId: localStorage.getItem('tmadj.deviceId') || 'C1',
    txDate: new Date().toISOString(),
    devoteeName: devoteeName || null,
    createdByName: user?.name,
    createdByRole: user?.role,
  };

  // Derive kind from cart items (majority or first)
  const inferKind = () => {
    if (!cart.length) return 'ARCHANAI';
    const counts = {};
    for (const i of cart) counts[i.kind || 'ARCHANAI'] = (counts[i.kind || 'ARCHANAI'] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  };

  // Hard refresh resets all POS state (cart, editing, payment, last chit)
  const newOrder = () => { window.location.assign('/pos?tab=create'); };

  // Pay an already-saved order: update its payment mode instead of creating a new sale
  const payEditedOrder = async (paymentMode) => {
    try {
      const updated = await api(`/transactions/${editing.id}`, {
        method: 'PUT',
        body: { paymentMode, items: cart, devoteeName: devoteeName || null, devoteeId: devoteeId || null, starNatchathiram: starName || null },
      });
      setLastChit({ ...updated, tendered: paymentMode === 'CASH' ? Number(tendered) : updated.total });
      setLastPayMode(paymentMode);
      setPaying(null); setTendered('');
      clearForm();
      loadOrders();
      showToast(`Order ${updated.receiptNo || ''} paid`);
      setTimeout(() => window.print(), 200);
    } catch (e) { showToast(e.message || 'Failed to record payment'); }
  };

  const completeSale = async (paymentMode) => {
    if (editing) return payEditedOrder(paymentMode);
    const chit = {
      clientUuid: crypto.randomUUID(),
      localChitNo: nextLocalChit(receiptPrefix, receiptDigits),
      kind: inferKind(),
      devoteeId: devoteeId || null,
      devoteeName: devoteeName || null,
      starNatchathiram: starName || null,
      items: cart,
      total,
      tendered: paymentMode === 'CASH' ? Number(tendered) : total,
      paymentMode,
      deviceId: localStorage.getItem('tmadj.deviceId') || 'C1',
      txDate: new Date().toISOString(),
      createdByName: user?.name,
      createdByRole: user?.role,
    };
    await queueTransaction(chit);
    setLastChit(chit);
    setLastPayMode(paymentMode);
    setPaying(null); setCart([]); setDevoteeName(''); setDevoteeId(null); setStarId(''); setTendered('');
    // Show order immediately from local store, then refresh from server after sync settles
    loadOrders();
    setTimeout(() => { if (posTab === 'orders') loadOrders(); }, 3000);
    setTimeout(() => window.print(), 200);
  };

  const POS_PRINT_COLS = [
    { key: 'receiptNo', label: 'Receipt', flex: 1, csv: (t) => t.receiptNo || t.localChitNo || '' },
    { key: 'txDate', label: 'Date & Time', flex: 1.4, csv: (t) => new Date(t.txDate).toLocaleString('en-MY') },
    { key: 'devoteeName', label: 'Devotee', flex: 1.2, csv: (t) => t.devoteeName || '' },
    { key: 'items', label: 'Items', flex: 2.5, csv: (t) => (t.items || []).map((i) => `${i.nameSnapshot} x${i.qty}`).join('; ') },
    { key: 'paymentMode', label: 'Mode', flex: 0.9, csv: (t) => t.paymentMode || '' },
    { key: 'total', label: 'Total (RM)', flex: 0.9, right: true, csv: (t) => Number(t.total).toFixed(2) },
    { key: 'status', label: 'Status', flex: 0.7, csv: (t) => t.status },
  ];

  const fetchOrders = async () => {
    const data = await api(`/transactions${qs({ type: 'order', dateFrom: ordDateFrom, dateTo: ordDateTo, search: ordSearch, paymentMode: ordPayMode, status: ordStatus, page: 1, pageSize: 10000, sortBy: ordSortBy, sortOrder: ordSortOrder })}`);
    return data.rows || [];
  };

  const exportPdf = async () => {
    const rows = await fetchOrders();
    await generateTablePdf(`Orders — ${new Date().toLocaleDateString('en-MY')}`, POS_PRINT_COLS, rows);
  };

  const exportCsv = async () => {
    const rows = await fetchOrders();
    const header = ['Receipt No', 'Local Chit No', 'Date', 'Devotee', 'Items', 'Payment Mode', 'Total', 'Status'];
    const lines = rows.map((t) => [
      t.receiptNo || '',
      t.localChitNo || '',
      new Date(t.txDate).toLocaleString('en-MY'),
      t.devoteeName || '',
      (t.items || []).map((i) => `${i.nameSnapshot} x${i.qty}`).join('; '),
      t.paymentMode || '',
      Number(t.total).toFixed(2),
      t.status,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = downloadName(`orders-${new Date().toLocaleDateString('en-CA')}.csv`);
    a.click();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Tabs tabs={can('pos', 'create') ? POS_TABS : POS_TABS.filter((t) => t.key === 'orders')} active={posTab} onChange={setPosTab} />
        {posTab === 'create' && (
          <button
            className="btn-ghost !p-2 lg:hidden relative"
            title="View chit"
            onClick={() => setCartPreviewOpen(true)}
          >
            <Receipt size={16} />
            {totalQty > 0 && (
              <span className="absolute -top-1 -right-1 bg-maroon-900 text-cream-50 text-[10px] leading-none rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5">
                {totalQty}
              </span>
            )}
          </button>
        )}
      </div>

      {posTab === 'orders' && (
        <div>
          {!online && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
              <WifiOff size={15} className="shrink-0" />
              Offline — showing locally stored orders. New orders will sync when connection is restored.
            </div>
          )}
          <div className="card p-3 mb-4 flex flex-wrap items-end gap-3 !overflow-visible">
            <div>
              <label className="label">From</label>
              <input type="date" className="input" value={ordDateFrom} onChange={(e) => { setOrdDateFrom(e.target.value); setOrdPage(1); }} />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" className="input" value={ordDateTo} onChange={(e) => { setOrdDateTo(e.target.value); setOrdPage(1); }} />
            </div>
            <div>
              <label className="label">Payment mode</label>
              <SearchableSelect
                options={[{ value: '', label: 'All' }, ...payModeOptions]}
                value={ordPayMode}
                onChange={(v) => { setOrdPayMode(v); setOrdPage(1); }}
                clearable
              />
            </div>
            <div>
              <label className="label">Status</label>
              <SearchableSelect
                options={[{ value: '', label: 'All' }, { value: 'PAID', label: 'Paid' }, { value: 'CANCELLED', label: 'Cancelled' }]}
                value={ordStatus}
                onChange={(v) => { setOrdStatus(v); setOrdPage(1); }}
                clearable
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="label">Search</label>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-ink-600/50" />
                <input className="input !pl-8" placeholder="Receipt / devotee…" value={ordSearch}
                  onChange={(e) => { setOrdSearch(e.target.value); setOrdPage(1); }} />
              </div>
            </div>
            <div className="flex gap-2 self-end">
              <button className="btn-ghost !p-2" title="Reset filters" onClick={() => { setOrdDateFrom(''); setOrdDateTo(''); setOrdPayMode(''); setOrdStatus(''); setOrdSearch(''); setOrdPage(1); }}><RotateCcw size={15} /></button>
              {can('pos', 'export') && (
                <>
                  <button className="btn-outline !py-1.5 !px-2.5 text-xs flex items-center gap-1.5" title="Export CSV" onClick={exportCsv}><Download size={13} /> CSV</button>
                  <button className="btn-outline !py-1.5 !px-2.5 text-xs flex items-center gap-1.5" title="Print PDF" onClick={exportPdf}><Printer size={13} /> PDF</button>
                </>
              )}
            </div>
          </div>
          <DataGrid
            loading={ordersLoading}
            empty="No orders today."
            rows={orders.rows}
            total={orders.total}
            page={ordPage}
            pageSize={ordPageSize}
            sortBy={ordSortBy}
            sortOrder={ordSortOrder}
            onSort={handleOrdSort}
            onPageChange={setOrdPage}
            onPageSizeChange={(s) => { setOrdPageSize(s); setOrdPage(1); }}
            columns={[
              { key: 'receiptNo', label: 'Receipt', sortable: true, render: (t) => (
                <span className="flex items-center gap-1.5">
                  <span className="font-semibold text-maroon-900">{t.receiptNo || t.localChitNo}</span>
                  {t._local && <span className="chip bg-amber-100 text-amber-700 text-[10px]">Pending sync</span>}
                </span>
              )},
              { key: 'txDate', label: 'Date & Time', sortable: true, render: (t) => new Date(t.txDate).toLocaleString('en-MY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
              { key: 'devoteeName', label: 'Devotee', sortable: true, render: (t) => t.devoteeName || '—' },
              { key: 'items', label: 'Items', render: (t) => {
                const count = t.items?.reduce((s, i) => s + i.qty, 0) || 0;
                return (
                  <span className="flex items-center gap-1">
                    <span className="text-xs">{count} item{count !== 1 ? 's' : ''}</span>
                    <button className="btn-ghost !p-1 text-ink-600" title="View details" onClick={() => setViewing(t)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                  </span>
                );
              }},
              { key: 'paymentMode', label: 'Mode', sortable: true },
              { key: 'total', label: 'Total', right: true, sortable: true, render: (t) => <span className={t.status === 'CANCELLED' ? 'line-through text-ink-600' : 'font-semibold'}>{RM(t.total)}</span> },
              { key: 'status', label: 'Status', render: (t) => t.status === 'CANCELLED'
                ? <span className="chip-cancelled">Cancelled</span>
                : <span className="chip-paid">Paid</span> },
              { key: 'actions', label: '', render: (t) => (
                <span className="flex gap-1">
                  <button className="btn-ghost !p-1.5 text-maroon-700" title="Show chit" onClick={() => setChitHtml(buildChitHtml(t, settings))}><Receipt size={14} /></button>
                  {can('pos', 'edit') && t.id && t.status !== 'CANCELLED' && <button className="btn-ghost !p-1.5" title="Edit order" onClick={() => loadFromOrder(t)}><Pencil size={14} /></button>}
                  {can('pos', 'delete') && <button className="btn-ghost !p-1.5 text-kumkum-600" title="Delete order permanently" onClick={() => { setCancelErr(''); setCancelling(t); }}><XCircle size={14} /></button>}
                </span>
              )},
            ]}
          />
          <ConfirmModal
            open={!!cancelling}
            title="Delete order permanently"
            message={`Permanently delete receipt ${cancelling?.receiptNo || cancelling?.localChitNo} (${RM(cancelling?.total)})? This removes it entirely and cannot be undone.`}
            onConfirm={cancelOrder}
            onClose={() => setCancelling(null)}
            error={cancelErr}
            confirmLabel="Delete permanently"
          />
          {/* Chit preview modal */}
          <Modal title="Chit Preview" open={!!chitHtml} onClose={() => setChitHtml(null)}>
            {chitHtml && (
              <div className="flex flex-col gap-3">
                <div className="flex justify-end gap-2">
                  <button className="btn-ghost" onClick={() => setChitHtml(null)}>Close</button>
                  <button className="btn-primary" onClick={() => {
                    const deviceId = getDeviceId(settings);
                    const handleAfterPrint = () => {
                      savePrinterPreference(deviceId, 'user-selected');
                      window.removeEventListener('afterprint', handleAfterPrint);
                    };
                    window.addEventListener('afterprint', handleAfterPrint);
                    chitIframeRef.current?.contentWindow?.print();
                  }}>
                    <Printer size={15} /> Print
                  </button>
                </div>
                <div className="bg-gray-100 rounded p-3 flex justify-center">
                  <iframe
                    ref={chitIframeRef}
                    srcDoc={chitHtml}
                    title="Chit"
                    scrolling="no"
                    onLoad={(e) => {
                      const doc = e.target.contentDocument;
                      if (doc) e.target.style.height = `${doc.documentElement.scrollHeight}px`;
                    }}
                    style={{ width: `${chitPreviewWidth}px`, minHeight: '120mm', border: 'none', background: '#fff', display: 'block', boxShadow: '0 2px 12px rgba(0,0,0,0.15)', borderRadius: '4px' }}
                  />
                </div>
              </div>
            )}
          </Modal>

          <Modal title={`Order details — ${viewing?.receiptNo || viewing?.localChitNo}`} open={!!viewing} onClose={() => setViewing(null)}>
            {viewing && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-xs text-ink-600"><span>{new Date(viewing.txDate).toLocaleString('en-MY')}</span><span>{viewing.paymentMode}</span></div>
                {viewing.devoteeName && <p className="text-xs">Devotee: <b>{viewing.devoteeName}</b></p>}
                <table className="w-full text-xs border-t border-cream-200 mt-1">
                  <thead><tr className="text-left text-ink-600 border-b border-cream-200"><th className="py-1.5">Item</th><th className="py-1.5 text-center w-12">Qty</th><th className="py-1.5 text-right w-20">Amount</th></tr></thead>
                  <tbody>
                    {viewing.items?.map((i, n) => (
                      <tr key={n} className="border-b border-cream-100">
                        <td className="py-1.5">{i.nameSnapshot}</td>
                        <td className="py-1.5 text-center">{i.qty}</td>
                        <td className="py-1.5 text-right tabular-nums">{RM(Number(i.priceSnapshot) * i.qty)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td colSpan={2} className="pt-2 font-bold">Total</td><td className="pt-2 text-right font-bold tabular-nums">{RM(viewing.total)}</td></tr></tfoot>
                </table>
              </div>
            )}
          </Modal>

        </div>
      )}

      {posTab === 'create' && <div className="lg:pr-[348px] flex flex-col" style={{ minHeight: 'calc(100vh - 160px)' }}>

        {editing && (
          <div className="mb-3 px-4 py-2.5 bg-saffron-100 border border-saffron-300 rounded-lg text-sm text-maroon-900 flex items-center justify-between">
            <span>Editing order <b>{editing.receiptNo}</b> — make changes and press Save.</span>
            <button className="text-ink-600 hover:text-maroon-900 ml-4" onClick={clearForm}>Cancel edit</button>
          </div>
        )}

        {/* Category tabs */}
        {posCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {posCategories.map((cat) => (
              <button key={cat.code} type="button"
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  posCategory === cat.code
                    ? 'bg-maroon-900 text-white'
                    : 'bg-cream-100 text-ink-600 hover:bg-cream-200 hover:text-maroon-900'
                }`}
                onClick={() => setPosCategory(cat.code)}>
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Items for selected category */}
        <div className="bg-white rounded-xl p-4 flex-1">
          {posCategories.length === 0 && (
            <p className="text-ink-600 text-sm py-10 text-center">No POS categories configured — set them up in Temple Config.</p>
          )}

          {posCategory && categoryIsTree ? (
            /* Grouped display (e.g. Donations with parent/sub structure) */
            categoryParents.map((parent) => {
              const subs = childrenOf(parent.id);
              if (!subs.length) return null;
              return (
                <div key={parent.id} className="mb-5">
                  <p className="text-xs text-saffron-600 font-semibold mb-2 pl-0.5 uppercase tracking-wide">{parent.nameEn}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {subs.map((v) => (
                      <ItemCard key={v.id} item={v}
                        inCart={cart.find((i) => i.lookupValueId === v.id) || null}
                        onAdd={(item) => addWithKind(item, posCategory)}
                        onSetQty={(qty) => setQty(v.id, qty)} />
                    ))}
                  </div>
                </div>
              );
            })
          ) : posCategory ? (
            /* Flat display */
            categoryItems.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {categoryItems.map((v) => (
                  <ItemCard key={v.id} item={v}
                    inCart={cart.find((i) => i.lookupValueId === v.id) || null}
                    onAdd={(item) => addWithKind(item, posCategory)}
                    onSetQty={(qty) => setQty(v.id, qty)} />
                ))}
              </div>
            ) : (
              <p className="text-ink-600 text-sm py-10 text-center">No items in this category — add them in Temple Config.</p>
            )
          ) : null}
        </div>

        {/* Receipt preview — right column, live chit preview */}
        <div className="hidden lg:block fixed top-0 right-0 w-[340px] h-screen bg-gray-100 border-l border-gray-300 pointer-events-none overflow-hidden">
          <div className="pointer-events-auto w-full h-full flex flex-col overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>

            {/* ~80mm/58mm at 96dpi; mx-auto centers within 340px panel */}
            <div className="flex flex-col gap-2 mx-auto pt-20 pb-6" style={{ width: `${chitPreviewWidth}px` }}>

              <DevoteeSearch
                receipt
                value={{ name: devoteeName }}
                onChange={(d) => { setDevoteeName(d.name); setDevoteeId(d.id || null); }}
              />

              <div className="bg-white rounded shadow-md overflow-hidden">
                <ChitContent chit={livePreviewChit} settings={settings} />
              </div>

              {editing && (
                <button className="btn-primary w-full justify-center" disabled={!editDirty || !cart.length || savingEdit} onClick={saveEdit}>
                  {savingEdit ? 'Saving…' : 'Save'}
                </button>
              )}
              {(editing ? can('pos', 'edit') : can('pos', 'create')) && (
                <div className="flex flex-col gap-2">
                  <button className="btn-primary w-full justify-center" disabled={payDisabled} onClick={() => { setTendered(total.toFixed(2)); setPaying('CASH'); }}>
                    <Banknote size={16} /> Cash
                  </button>
                  <button className="btn-outline w-full justify-center" disabled={payDisabled} onClick={() => { setTendered(total.toFixed(2)); setPaying('DUITNOW_QR'); }}>
                    <QrCode size={16} /> DuitNow QR
                  </button>
                </div>
              )}
              <button className="btn-outline w-full justify-center" onClick={newOrder}>
                <Plus size={15} /> New Order
              </button>

            </div>
          </div>
        </div>
      </div>}

      {/* Cash modal */}
      <Modal title="Cash payment" open={paying === 'CASH'} onClose={() => setPaying(null)}>
        <div className="space-y-3">
          <p className="text-3xl font-display text-maroon-900 text-center tabular-nums">{RM(total)}</p>
          <div>
            <label className="label">Cash received (RM)</label>
            <input className="input text-lg" type="number" step="0.01" placeholder="0.00" value={tendered} onChange={(e) => setTendered(e.target.value)} autoFocus />
          </div>
          {tendered !== '' && (
            <p className={`text-center font-semibold ${change < 0 ? 'text-kumkum-600' : 'text-leaf-700'}`}>
              {change < 0 ? `Short by RM ${Math.abs(change).toFixed(2)}` : `Change: RM ${change.toFixed(2)}`}
            </p>
          )}
          <button className="btn-primary w-full justify-center" disabled={change < 0} onClick={() => completeSale('CASH')}>
            Confirm payment
          </button>
        </div>
      </Modal>

      {/* QR modal */}
      <Modal title="Scan to pay — DuitNow QR" open={paying === 'DUITNOW_QR'} onClose={() => setPaying(null)}>
        <div className="text-center space-y-3">
          <p className="text-3xl font-display text-maroon-900 tabular-nums">{RM(total)}</p>
          {settings['qr.imageUrl']
            ? <img src={settings['qr.imageUrl']} alt="DuitNow QR" className="w-64 h-64 mx-auto object-contain border border-gold-300 rounded-xl" />
            : <p className="text-sm text-ink-600 py-10">Upload your DuitNow QR in Settings → Payment QR to show it here.</p>}
          <button className="btn-primary w-full justify-center" onClick={() => completeSale('DUITNOW_QR')}>
            Confirm payment received
          </button>
        </div>
      </Modal>

      {/* Mobile live chit preview (right panel is desktop-only) */}
      <Modal title="Order Chit" open={cartPreviewOpen} onClose={() => setCartPreviewOpen(false)}>
        <div className="flex flex-col gap-3">
          <div className="bg-gray-100 rounded p-3 flex justify-center">
            <iframe
              ref={mobileChitIframeRef}
              srcDoc={buildChitHtml(livePreviewChit, settings)}
              title="Chit"
              scrolling="no"
              onLoad={(e) => {
                const doc = e.target.contentDocument;
                if (doc) e.target.style.height = `${doc.documentElement.scrollHeight}px`;
              }}
              style={{ width: `${chitPreviewWidth}px`, minHeight: '120mm', border: 'none', background: '#fff', display: 'block', boxShadow: '0 2px 12px rgba(0,0,0,0.15)', borderRadius: '4px' }}
            />
          </div>
          <button
            className="btn-primary w-full justify-center"
            disabled={!cart.length}
            onClick={() => {
              const deviceId = getDeviceId(settings);
              const handleAfterPrint = () => {
                savePrinterPreference(deviceId, 'user-selected');
                window.removeEventListener('afterprint', handleAfterPrint);
              };
              window.addEventListener('afterprint', handleAfterPrint);
              mobileChitIframeRef.current?.contentWindow?.print();
            }}
          >
            <Printer size={15} /> Print
          </button>

          {editing && (
            <button className="btn-primary w-full justify-center" disabled={!editDirty || !cart.length || savingEdit} onClick={() => { setCartPreviewOpen(false); saveEdit(); }}>
              {savingEdit ? 'Saving…' : 'Save'}
            </button>
          )}
          {(editing ? can('pos', 'edit') : can('pos', 'create')) && (
            <div className="flex flex-col gap-2">
              <button className="btn-primary w-full justify-center" disabled={payDisabled} onClick={() => { setCartPreviewOpen(false); setTendered(total.toFixed(2)); setPaying('CASH'); }}>
                <Banknote size={16} /> Cash
              </button>
              <button className="btn-outline w-full justify-center" disabled={payDisabled} onClick={() => { setCartPreviewOpen(false); setTendered(total.toFixed(2)); setPaying('DUITNOW_QR'); }}>
                <QrCode size={16} /> DuitNow QR
              </button>
            </div>
          )}
          <button className="btn-outline w-full justify-center" onClick={newOrder}>
            <Plus size={15} /> New Order
          </button>
        </div>
      </Modal>

      <Toast message={toastMsg} onClose={clearToast} />
      <Chit chit={lastChit} settings={settings} />
    </div>
  );
}
