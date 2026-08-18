import { useEffect, useState } from 'react';
import { Upload, Save, Plus, Pencil, Trash2, Eye, EyeOff, X } from 'lucide-react';
import { useApp } from '../auth/AppContext.jsx';
import { api } from '../api/client.js';
import Tabs from '../components/Tabs.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { PLACEHOLDERS, buildCtx, fillTemplate } from '../components/SendMessageModal.jsx';
import { Toast, useToast } from '../components/Toast.jsx';

const TABS = [
  { key: 'profile',   label: 'Temple Profile & Logo' },
  { key: 'receipt',   label: 'Receipt / Chit' },
  { key: 'payment',   label: 'Payment Config' },
  { key: 'numbering', label: 'Numbering' },
  { key: 'templates', label: 'Message Templates' },
];

const PAYMENT_TABS = [
  { key: 'qr',   label: 'Payment QR' },
  { key: 'bank', label: 'Bank Information' },
];

const DUMMY = {
  devotee: { name: 'Ravi Kumar', phone: '0123456789', altPhone: '0198765432', icNumber: '901231-10-5678', email: 'ravi@example.com', address: '12 Jalan Bunga, Kuala Lumpur' },
  booking: { bookingNo: 'HB-001234', eventDate: new Date().toISOString(), hallRate: 1200, balanceDueAt: new Date(Date.now() + 7 * 86400000).toISOString(), transactions: [] },
  eventTypeName: 'Wedding Ceremony',
};

function TemplateEditor({ tpl, onSave, onCancel }) {
  const [name, setName] = useState(tpl?.name || '');
  const [body, setBody] = useState(tpl?.body || '');
  const [preview, setPreview] = useState(false);

  const insertPlaceholder = (key) => {
    setBody((b) => b + key);
  };

  const dummyCtx = buildCtx(DUMMY.devotee, DUMMY.booking, DUMMY.eventTypeName);
  const previewText = fillTemplate(body, dummyCtx);

  return (
    <div className="card p-5 space-y-4">
      <div>
        <label className="label">Template name</label>
        <input className="input" placeholder="e.g. Booking Reminder, Payment Received…" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label mb-0">Message body</label>
          <button className="btn-ghost !py-1 !px-2 text-xs flex items-center gap-1" onClick={() => setPreview((p) => !p)}>
            {preview ? <EyeOff size={13} /> : <Eye size={13} />} {preview ? 'Edit' : 'Preview'}
          </button>
        </div>

        {preview ? (
          <div className="input min-h-[120px] whitespace-pre-wrap bg-leaf-50 border-leaf-200 leading-relaxed" style={{ fontFamily: 'monospace', fontSize: 13 }}>
            {previewText || <span className="text-ink-400 italic">No content</span>}
          </div>
        ) : (
          <textarea
            className="input min-h-[120px] resize-y"
            style={{ fontFamily: 'monospace', fontSize: 13 }}
            placeholder="Type your message here. Use placeholders below to insert devotee / booking details."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        )}
      </div>

      <div>
        <label className="label">Insert placeholder</label>
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map((p) => (
            <button
              key={p.key}
              className="btn-outline !py-1 !px-2.5 text-xs"
              onClick={() => insertPlaceholder(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-500 mt-1.5">Preview (above) uses dummy data. Real values are filled when sending.</p>
      </div>

      <div className="flex gap-2">
        <button className="btn-primary" disabled={!name.trim() || !body.trim()} onClick={() => onSave({ name: name.trim(), body: body.trim() })}>
          <Save size={14} /> Save template
        </button>
        <button className="btn-outline" onClick={onCancel}><X size={14} /> Cancel</button>
      </div>
    </div>
  );
}

export default function Settings() {
  const { settings, refreshMasterData, can, online } = useApp();
  const [tab, setTab] = useState('profile');
  const [paymentSubTab, setPaymentSubTab] = useState('qr');
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const editable = can('settings', 'edit');
  const { msg: toastMsg, show: showToast, clear: clearToast } = useToast();
  const guardOffline = () => { if (!online) { showToast('Offline — cannot edit settings. Connect to the internet first.'); return true; } return false; };

  // Numbering state
  const [numForm, setNumForm] = useState({ receiptPrefix: 'ORD', receiptDigits: 6, bookingPrefix: 'HB', bookingDigits: 6 });
  const [numBusy, setNumBusy] = useState(false);
  const [numMsg, setNumMsg] = useState('');

  // Templates state
  const [templates, setTemplates] = useState([]);
  const [editingTpl, setEditingTpl] = useState(null); // null | {} (new) | { id, name, body } (edit)
  const [tplBusy, setTplBusy] = useState(false);
  const [tplMsg, setTplMsg] = useState('');

  useEffect(() => { setForm({ ...settings }); }, [settings]);

  useEffect(() => {
    const stored = settings['message.templates'];
    setTemplates(Array.isArray(stored) ? stored : []);
  }, [settings]);

  useEffect(() => {
    if (tab === 'numbering') {
      api('/settings/numbering').then((d) => setNumForm({
        receiptPrefix: d.receiptPrefix,
        receiptDigits: d.receiptDigits,
        bookingPrefix: d.bookingPrefix,
        bookingDigits: d.bookingDigits,
      })).catch(() => {});
    }
  }, [tab]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      await api('/settings', { method: 'PUT', body: form });
      await refreshMasterData();
      setMsg('Settings saved'); setTimeout(() => setMsg(''), 3000);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const saveNumbering = async () => {
    setNumBusy(true); setNumMsg('');
    try {
      await api('/settings/numbering', { method: 'POST', body: numForm });
      setNumMsg('Numbering saved'); setTimeout(() => setNumMsg(''), 3000);
    } catch (e) { setNumMsg('Error: ' + e.message); }
    finally { setNumBusy(false); }
  };

  const saveTemplates = async (updated) => {
    setTplBusy(true); setTplMsg('');
    try {
      await api('/settings', { method: 'PUT', body: { 'message.templates': updated } });
      await refreshMasterData();
      setTemplates(updated);
      setTplMsg('Templates saved'); setTimeout(() => setTplMsg(''), 3000);
    } catch (e) { setTplMsg('Error: ' + e.message); }
    finally { setTplBusy(false); }
  };

  const handleSaveTpl = async ({ name, body }) => {
    let updated;
    if (editingTpl?.id) {
      updated = templates.map((t) => t.id === editingTpl.id ? { ...t, name, body } : t);
    } else {
      updated = [...templates, { id: crypto.randomUUID(), name, body }];
    }
    await saveTemplates(updated);
    setEditingTpl(null);
  };

  const handleDeleteTpl = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    await saveTemplates(templates.filter((t) => t.id !== id));
  };

  const upload = async (endpoint, field, file) => {
    if (!file) return;
    setBusy(true); setErr('');
    try {
      const fd = new FormData();
      fd.append(field, file);
      await api(endpoint, { method: 'POST', formData: fd });
      await refreshMasterData();
      setMsg('Image uploaded'); setTimeout(() => setMsg(''), 3000);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const Dropzone = ({ url, label, onPick }) => (
    <label className={`card flex flex-col items-center justify-center gap-2 p-6 transition ${editable ? 'cursor-pointer hover:shadow-glow' : 'opacity-60 cursor-not-allowed'}`}>
      {url
        ? <img src={url} alt="" className="max-h-40 object-contain" />
        : <Upload size={28} className="text-gold-500" />}
      <span className="text-sm text-ink-600">{label}</span>
      {editable && <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />}
    </label>
  );

  return (
    <div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {msg && <p className="text-sm text-leaf-700 mb-3">{msg}</p>}
      {err && <p className="text-sm text-kumkum-600 mb-3">{err}</p>}

      {tab === 'profile' && (
        <div className="grid md:grid-cols-[1fr_280px] gap-5">
          <div className="card p-5 space-y-3">
            <div><label className="label">Temple name (English)</label><input className="input" placeholder="e.g. TMADJ Temple" disabled={!editable} value={form['temple.name'] || ''} onChange={(e) => set('temple.name', e.target.value)} /></div>
            <div><label className="label">Temple name (Tamil)</label><input className="input" placeholder="e.g. கோயில் பெயர்" disabled={!editable} value={form['temple.nameTa'] || ''} onChange={(e) => set('temple.nameTa', e.target.value)} /></div>
            <div><label className="label">Address</label><input className="input" placeholder="Street, City, State" disabled={!editable} value={form['temple.address'] || ''} onChange={(e) => set('temple.address', e.target.value)} /></div>
            <div><label className="label">Phone</label><input className="input" placeholder="e.g. 03-1234 5678" disabled={!editable} value={form['temple.phone'] || ''} onChange={(e) => set('temple.phone', e.target.value)} /></div>
            {editable && <button className="btn-primary" disabled={busy} onClick={() => { if (guardOffline()) return; save(); }}><Save size={15} /> {busy ? 'Saving…' : 'Save profile'}</button>}
          </div>
          <div>
            <p className="label mb-2">Temple logo — shows in the sidebar, login & chit</p>
            <Dropzone url={settings['temple.logoUrl']} label="Tap to upload logo (PNG/JPG/SVG, max 2 MB)" onPick={(f) => { if (guardOffline()) return; upload('/settings/logo', 'logo', f); }} />
          </div>
        </div>
      )}

      {tab === 'receipt' && (
        <div className="card p-5 space-y-3 max-w-xl !overflow-visible">
          <div>
            <label className="label">Paper width</label>
            <SearchableSelect
              options={[{ value: '80', label: '80 mm' }, { value: '58', label: '58 mm' }]}
              value={form['receipt.paperWidth'] || '80'}
              onChange={(v) => set('receipt.paperWidth', v)}
              disabled={!editable}
            />
          </div>
          <div><label className="label">Footer blessing text</label><input className="input" placeholder="e.g. Om Sakthi · Thank you for your devotion" disabled={!editable} value={form['receipt.footerText'] || ''} onChange={(e) => set('receipt.footerText', e.target.value)} /></div>
          <div>
            <label className="label">Chit language</label>
            <SearchableSelect
              options={[{ value: 'EN', label: 'English' }, { value: 'TA', label: 'Tamil' }, { value: 'BOTH', label: 'English + Tamil' }]}
              value={form['receipt.language'] || 'EN'}
              onChange={(v) => set('receipt.language', v)}
              disabled={!editable}
            />
          </div>
          {editable && <button className="btn-primary" disabled={busy} onClick={() => { if (guardOffline()) return; save(); }}><Save size={15} /> Save receipt settings</button>}
        </div>
      )}

      {tab === 'payment' && (
        <div>
          <Tabs tabs={PAYMENT_TABS} active={paymentSubTab} onChange={setPaymentSubTab} className="mb-4" />

          {paymentSubTab === 'qr' && (
            <div className="max-w-md">
              <p className="text-sm text-ink-600 mb-3">Upload your bank's DuitNow QR. It appears full-screen on the counter when the devotee chooses "DuitNow QR".</p>
              <Dropzone url={settings['qr.imageUrl']} label="Tap to upload DuitNow QR image" onPick={(f) => { if (guardOffline()) return; upload('/settings/qr-image', 'qr', f); }} />
            </div>
          )}

          {paymentSubTab === 'bank' && (
            <div className="card p-5 space-y-3 max-w-xl">
              <p className="text-sm text-ink-600 mb-1">Shown on hall booking invoices alongside the payment QR.</p>
              <div><label className="label">Bank name</label><input className="input" placeholder="Enter your bank name" disabled={!editable} value={form['bank.name'] || ''} onChange={(e) => set('bank.name', e.target.value)} /></div>
              <div><label className="label">Bank account no</label><input className="input" placeholder="Enter your bank account no" disabled={!editable} value={form['bank.accountNo'] || ''} onChange={(e) => set('bank.accountNo', e.target.value)} /></div>
              <div><label className="label">Account owner name</label><input className="input" placeholder="Enter your account owner name" disabled={!editable} value={form['bank.accountOwnerName'] || ''} onChange={(e) => set('bank.accountOwnerName', e.target.value)} /></div>
              {editable && <button className="btn-primary" disabled={busy} onClick={() => { if (guardOffline()) return; save(); }}><Save size={15} /> {busy ? 'Saving…' : 'Save bank information'}</button>}
            </div>
          )}
        </div>
      )}

      {tab === 'numbering' && (
        <div className="card p-5 max-w-xl space-y-6">
          <p className="text-sm text-ink-600">Numbers are randomly generated and guaranteed unique in the database.</p>

          <div className="space-y-4">
            <h3 className="font-semibold text-maroon-900 border-b border-gold-200 pb-2">POS Order Number</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Prefix</label>
                <input className="input" placeholder="e.g. ORD" disabled={!editable} value={numForm.receiptPrefix} onChange={(e) => setNumForm((f) => ({ ...f, receiptPrefix: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="label">Number of digits</label>
                <input className="input" type="number" min="4" max="10" disabled={!editable} value={numForm.receiptDigits} onChange={(e) => setNumForm((f) => ({ ...f, receiptDigits: Number(e.target.value) }))} />
              </div>
            </div>
            <p className="text-xs text-ink-500">Preview: <b className="text-maroon-900">{numForm.receiptPrefix || 'ORD'}-{'X'.repeat(numForm.receiptDigits || 6)}</b></p>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-maroon-900 border-b border-gold-200 pb-2">Hall Booking Number</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Prefix</label>
                <input className="input" placeholder="e.g. HB" disabled={!editable} value={numForm.bookingPrefix} onChange={(e) => setNumForm((f) => ({ ...f, bookingPrefix: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="label">Number of digits</label>
                <input className="input" type="number" min="4" max="10" disabled={!editable} value={numForm.bookingDigits} onChange={(e) => setNumForm((f) => ({ ...f, bookingDigits: Number(e.target.value) }))} />
              </div>
            </div>
            <p className="text-xs text-ink-500">Preview: <b className="text-maroon-900">{numForm.bookingPrefix || 'HB'}-{'X'.repeat(numForm.bookingDigits || 6)}</b></p>
          </div>

          {numMsg && <p className={`text-sm ${numMsg.startsWith('Error') ? 'text-kumkum-600' : 'text-leaf-700'}`}>{numMsg}</p>}
          {editable && <button className="btn-primary" disabled={numBusy} onClick={() => { if (guardOffline()) return; saveNumbering(); }}><Save size={15} /> {numBusy ? 'Saving…' : 'Save numbering'}</button>}
        </div>
      )}

      {tab === 'templates' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            {editable && !editingTpl && (
              <button className="btn-primary" onClick={() => { if (guardOffline()) return; setEditingTpl({}); }}>
                <Plus size={15} /> New template
              </button>
            )}
          </div>

          {tplMsg && <p className={`text-sm ${tplMsg.startsWith('Error') ? 'text-kumkum-600' : 'text-leaf-700'}`}>{tplMsg}</p>}

          {editingTpl !== null && (
            <TemplateEditor
              tpl={editingTpl.id ? editingTpl : null}
              onSave={(d) => { if (guardOffline()) return; handleSaveTpl(d); }}
              onCancel={() => setEditingTpl(null)}
            />
          )}

          {templates.length === 0 && editingTpl === null && (
            <div className="card p-12 text-center text-ink-500 text-sm">
              No templates yet. Click <b>New template</b> to create one.
            </div>
          )}

          {templates.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {templates.map((t) => {
                const dummyCtx = buildCtx(DUMMY.devotee, DUMMY.booking, DUMMY.eventTypeName);
                const preview = fillTemplate(t.body, dummyCtx);
                const lineCount = (t.body.match(/\n/g) || []).length + 1;
                return (
                  <div key={t.id} className="card p-5 flex flex-col gap-3">
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-maroon-900 text-base leading-tight">{t.name}</h3>
                      {editable && (
                        <div className="flex gap-0.5 shrink-0">
                          <button className="btn-ghost !p-1.5" title="Edit" onClick={() => { if (guardOffline()) return; setEditingTpl(t); }}><Pencil size={14} /></button>
                          <button className="btn-ghost !p-1.5 text-kumkum-600 hover:bg-kumkum-50" title="Delete" onClick={() => { if (guardOffline()) return; handleDeleteTpl(t.id); }}><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>

                    {/* Raw body */}
                    <div className="flex-1 bg-cream-50 border border-gold-300/50 rounded-lg px-3 py-2.5">
                      <p className="text-xs font-mono text-ink-700 leading-relaxed whitespace-pre-wrap line-clamp-5">{t.body}</p>
                    </div>

                    {/* Placeholder chips */}
                    <div className="flex flex-wrap gap-1">
                      {PLACEHOLDERS.filter((p) => t.body.includes(p.key)).map((p) => (
                        <span key={p.key} className="chip bg-saffron-100 text-saffron-700 !text-[10px]">{p.label}</span>
                      ))}
                    </div>

                    {/* Preview toggle */}
                    <details>
                      <summary className="text-xs text-saffron-600 cursor-pointer select-none font-medium">Preview with dummy data</summary>
                      <div className="mt-2 bg-leaf-50 border border-leaf-200 rounded-lg px-3 py-2.5">
                        <p className="text-xs font-mono text-ink-800 leading-relaxed whitespace-pre-wrap">{preview}</p>
                      </div>
                    </details>

                    {/* Meta */}
                    <p className="text-[11px] text-ink-400">{lineCount} line{lineCount !== 1 ? 's' : ''} · {t.body.length} chars</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Toast message={toastMsg} onClose={clearToast} />
    </div>
  );
}
