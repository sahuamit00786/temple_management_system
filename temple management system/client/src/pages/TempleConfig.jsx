import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, Pencil, Trash2, CornerDownRight, Eye, EyeOff, FolderPlus, GripVertical, FolderOpen } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal.jsx';
import Modal from '../components/Modal.jsx';
import { useApp } from '../auth/AppContext.jsx';
import { api } from '../api/client.js';

function slugify(name) {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
}

function Frag({ children }) { return <>{children}</>; }

function ValueRow({ v, indent, canEdit, canCreate, canDelete, all, draggingId, dragOverId,
                    onDragStart, onDragOver, onDragEnd, onDrop, onEdit, onToggle, onDelete, onAddSub }) {
  const isParent = !v.parentId;
  const hasChildren = isParent && all.some((c) => c.parentId === v.id);
  const isDragging = draggingId === v.id;
  const isOver = dragOverId === v.id && draggingId !== v.id;
  const dragSrc = draggingId ? all.find((x) => x.id === draggingId) : null;
  const compatible = dragSrc && (dragSrc.parentId ?? null) === (v.parentId ?? null);
  const showDropTarget = isOver && compatible;

  return (
    <tr
      draggable={canEdit}
      onDragStart={(e) => onDragStart(e, v.id)}
      onDragOver={(e) => onDragOver(e, v.id)}
      onDragEnd={onDragEnd}
      onDrop={(e) => onDrop(e, v.id)}
      className={`transition-colors ${isDragging ? 'opacity-40' : ''} ${showDropTarget ? 'bg-gold-50 border-t-2 border-t-saffron-400' : ''}`}
    >
      <td className="!py-2 !px-2 w-8">
        {canEdit && (
          <span className="text-ink-300 cursor-grab active:cursor-grabbing flex items-center justify-center">
            <GripVertical size={14} />
          </span>
        )}
      </td>
      <td>
        <span className="flex items-center gap-1.5" style={{ paddingLeft: indent ? 16 : 0 }}>
          {indent && <CornerDownRight size={13} className="text-gold-500 shrink-0" />}
          <span className={`font-medium${!v.isActive ? ' text-ink-400 line-through' : ''}${isParent && !v.price ? ' text-maroon-800' : ''}`}>
            {v.nameEn}
          </span>
          {isParent && !v.price && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-ink-400 bg-ink-100 rounded px-1 ml-1">
              <FolderOpen size={9} /> group
            </span>
          )}
        </span>
      </td>
      <td className="text-ink-600 text-sm">{v.nameTa || '—'}</td>
      <td className="tabular-nums font-semibold text-saffron-700 text-sm">
        {v.price != null ? `RM ${Number(v.price).toFixed(2)}` : <span className="text-ink-300 font-normal">—</span>}
      </td>
      <td>
        <span className={`chip ${v.isActive ? 'chip-paid' : 'chip-cancelled'}`}>
          {v.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>
        <span className="flex items-center gap-0.5">
          {canEdit && (
            <>
              <button className="btn-ghost !p-1.5" title="Edit" onClick={() => onEdit(v)}>
                <Pencil size={14} />
              </button>
              <button
                className="btn-ghost !p-1.5"
                title={v.isActive
                  ? (hasChildren ? 'Hide group + all its items' : 'Deactivate')
                  : (hasChildren ? 'Show group + all its items' : 'Activate')}
                onClick={() => onToggle(v)}
              >
                {v.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </>
          )}
          {canDelete && (
            <button className="btn-ghost !p-1.5 text-kumkum-600" title="Delete" onClick={() => onDelete(v)}>
              <Trash2 size={14} />
            </button>
          )}
        </span>
      </td>
    </tr>
  );
}

export default function TempleConfig() {
  const { can, online, refreshMasterData } = useApp();
  const [allLookups, setAllLookups] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tmadj.allLookups') || '{}'); } catch { return {}; }
  });
  const [tab, setTab] = useState('');

  // item modals
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  // category modals
  const [newCat, setNewCat] = useState(null);
  const [editingCat, setEditingCat] = useState(null);
  const [deletingCat, setDeletingCat] = useState(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  // drag-and-drop state for value rows — ref holds truth, state drives visuals
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const draggingIdRef = useRef(null);

  // drag-and-drop state for category tabs
  const [draggingCat, setDraggingCat] = useState(null);
  const [dragOverCat, setDragOverCat] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api('/lookups?all=1');
      setAllLookups(data);
      localStorage.setItem('tmadj.allLookups', JSON.stringify(data));
    } catch {
      // Fall back to cached version (already set as initial state)
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() =>
    Object.entries(allLookups)
      .filter(([, t]) => t.isPosMenu)
      .map(([code, t]) => ({ code, ...t }))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)),
    [allLookups]
  );

  useEffect(() => {
    if (categories.length > 0 && (!tab || !categories.find((c) => c.code === tab))) {
      setTab(categories[0].code);
    }
  }, [categories, tab]);

  const currentType = allLookups[tab] || {};
  const all = currentType.values || [];
  const parents = all.filter((v) => !v.parentId);
  const childrenOf = useCallback((id) => all.filter((v) => v.parentId === id), [all]);
  const hasParents = parents.length > 0;

  // ── Value CRUD ──────────────────────────────────────────────────────────────

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const isGroup = editing.isGroup;
      if (!isGroup && (editing.price === '' || editing.price == null)) {
        setErr('Price is required for items'); setBusy(false); return;
      }
      const body = {
        nameEn: editing.nameEn.trim(),
        nameTa: editing.nameTa?.trim() || null,
        price: isGroup ? null : Number(editing.price),
        parentId: editing.parentId ? Number(editing.parentId) : null,
      };
      if (editing.id) await api(`/lookups/values/${editing.id}`, { method: 'PUT', body });
      else await api(`/lookups/${tab}/values`, { method: 'POST', body });
      setEditing(null);
      await Promise.all([load(), refreshMasterData()]);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const res = await api(`/lookups/values/${deleting.id}`, { method: 'DELETE' });
      flash(res.message || `"${deleting.nameEn}" deleted.`);
      setDeleting(null);
      await Promise.all([load(), refreshMasterData()]);
    } catch (e) { flash(e.message); }
    finally { setBusy(false); }
  };

  const toggleActive = async (v) => {
    try {
      const newActive = !v.isActive;
      const updates = [api(`/lookups/values/${v.id}`, { method: 'PUT', body: { isActive: newActive } })];
      // cascade to children when toggling a group (parent row)
      if (!v.parentId) {
        all.filter((c) => c.parentId === v.id).forEach((c) =>
          updates.push(api(`/lookups/values/${c.id}`, { method: 'PUT', body: { isActive: newActive } }))
        );
      }
      await Promise.all(updates);
      await Promise.all([load(), refreshMasterData()]);
    } catch (e) { flash(e.message); }
  };

  // ── Category CRUD ───────────────────────────────────────────────────────────

  const saveCategory = async () => {
    if (!newCat?.name?.trim()) return;
    setBusy(true); setErr('');
    try {
      const maxSort = Math.max(0, ...categories.map((c) => c.sortOrder ?? 0));
      await api('/lookups/types', {
        method: 'POST',
        body: { code: newCat.code || slugify(newCat.name), name: newCat.name.trim(), sortOrder: maxSort + 1 },
      });
      setNewCat(null);
      await Promise.all([load(), refreshMasterData()]);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const saveCategoryEdit = async () => {
    if (!editingCat?.name?.trim()) return;
    setBusy(true); setErr('');
    try {
      await api(`/lookups/types/${editingCat.id}`, { method: 'PUT', body: { name: editingCat.name.trim() } });
      setEditingCat(null);
      await Promise.all([load(), refreshMasterData()]);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const deleteCategory = async () => {
    setBusy(true); setErr('');
    try {
      const res = await api(`/lookups/types/${deletingCat.id}`, { method: 'DELETE' });
      flash(res.message || 'Category deleted');
      setDeletingCat(null);
      setTab('');
      await Promise.all([load(), refreshMasterData()]);
    } catch (e) { flash(e.message); }
    finally { setBusy(false); }
  };

  const toggleCategoryActive = async (cat) => {
    try {
      await api(`/lookups/types/${cat.id}`, { method: 'PUT', body: { isActive: cat.isActive === false } });
      await Promise.all([load(), refreshMasterData()]);
    } catch (e) { flash(e.message); }
  };

  // ── Reorder ─────────────────────────────────────────────────────────────────

  const handleCatDrop = async (targetId) => {
    setDraggingCat(null); setDragOverCat(null);
    if (!draggingCat || draggingCat === targetId) return;
    const fromIdx = categories.findIndex((c) => c.id === draggingCat);
    const toIdx = categories.findIndex((c) => c.id === targetId);
    if (fromIdx === toIdx) return;
    const reordered = [...categories];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    try {
      await api('/lookups/types/reorder', { method: 'PUT', body: { ids: reordered.map((c) => c.id) } });
      await Promise.all([load(), refreshMasterData()]);
    } catch (e) { flash(e.message); }
  };

  const handleDragStart = (e, id) => {
    draggingIdRef.current = id;
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== draggingIdRef.current) setDragOverId(id);
  };

  const handleDragEnd = () => {
    draggingIdRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDrop = async (e, targetId) => {
    e.preventDefault();
    const srcId = draggingIdRef.current;
    if (!srcId || srcId === targetId) { handleDragEnd(); return; }

    const dragItem = all.find((v) => v.id === srcId);
    const targetItem = all.find((v) => v.id === targetId);
    if (!dragItem || !targetItem) { handleDragEnd(); return; }

    // Only allow reorder within same level
    const dragLevel = dragItem.parentId ?? null;
    const targetLevel = targetItem.parentId ?? null;
    if (dragLevel !== targetLevel) { handleDragEnd(); return; }

    const siblings = all.filter((v) => (v.parentId ?? null) === dragLevel);
    const fromIdx = siblings.findIndex((v) => v.id === srcId);
    const toIdx = siblings.findIndex((v) => v.id === targetId);
    if (fromIdx === toIdx) { handleDragEnd(); return; }

    const reordered = [...siblings];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    handleDragEnd();
    try {
      await api('/lookups/values/reorder', { method: 'PUT', body: { ids: reordered.map((v) => v.id) } });
      await Promise.all([load(), refreshMasterData()]);
    } catch (e) { flash(e.message); }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      {!online && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
          <span>Offline — showing cached lookup data. Changes cannot be saved until reconnected.</span>
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-ink-600">Manage POS counter categories and items. Changes appear instantly at the counter.</p>
        {can('temple-config', 'create') && (
          <button
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!online}
            title={!online ? 'You are offline — connect to the server to make changes' : ''}
            onClick={() => { setErr(''); setNewCat({ name: '', code: '' }); }}
          >
            <FolderPlus size={16} /> Add category
          </button>
        )}
      </div>

      {categories.length === 0 ? (
        <div className="card p-10 text-center text-ink-600 text-sm">
          No POS categories yet. Click "Add category" to create the first one.
        </div>
      ) : (
        <>
          {/* ── Category tabs ───────────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {categories.map((cat) => {
              const isSelected = tab === cat.code;
              const isHidden = cat.isActive === false;
              const isDraggingThis = draggingCat === cat.id;
              const isDropTarget = dragOverCat === cat.id && draggingCat !== cat.id;
              return (
                <div
                  key={cat.code}
                  draggable={can('temple-config', 'edit')}
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDraggingCat(cat.id); }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverCat(cat.id); }}
                  onDragEnd={() => { setDraggingCat(null); setDragOverCat(null); }}
                  onDrop={(e) => { e.preventDefault(); handleCatDrop(cat.id); }}
                  onClick={() => setTab(cat.code)}
                  className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm font-medium cursor-pointer select-none transition-all ${
                    isSelected
                      ? 'bg-maroon-900 border-maroon-900 text-white shadow-md'
                      : 'bg-white border-gold-300/70 text-ink-700 hover:border-maroon-300 hover:text-maroon-900 hover:shadow-sm'
                  } ${isDraggingThis ? 'opacity-40 scale-95' : ''} ${isDropTarget ? 'ring-2 ring-saffron-400 ring-offset-1 scale-105' : ''} ${isHidden ? 'opacity-50 italic' : ''}`}
                >
                  {can('temple-config', 'edit') && (
                    <GripVertical size={13} className={`shrink-0 cursor-grab active:cursor-grabbing ${isSelected ? 'text-white/50' : 'text-ink-300'}`} />
                  )}
                  <span>{cat.name}</span>
                  <span className={`flex items-center gap-0.5 ml-0.5 transition-opacity ${isSelected ? 'opacity-80' : 'opacity-0 group-hover:opacity-100'}`}>
                    {can('temple-config', 'edit') && (
                      <button
                        className={`p-0.5 rounded hover:bg-white/20 ${isSelected ? 'text-white/70 hover:text-white' : 'text-ink-400 hover:text-maroon-700'}`}
                        title={isHidden ? 'Show in POS counter' : 'Hide from POS counter'}
                        onClick={(e) => { e.stopPropagation(); toggleCategoryActive(cat); }}
                      >
                        {isHidden ? <Eye size={11} /> : <EyeOff size={11} />}
                      </button>
                    )}
                    {can('temple-config', 'edit') && (
                      <button
                        className={`p-0.5 rounded hover:bg-white/20 ${isSelected ? 'text-white/70 hover:text-white' : 'text-ink-400 hover:text-maroon-700'}`}
                        title="Rename"
                        onClick={(e) => { e.stopPropagation(); setErr(''); setEditingCat({ id: cat.id, name: cat.name }); }}
                      >
                        <Pencil size={11} />
                      </button>
                    )}
                    {can('temple-config', 'delete') && (
                      <button
                        className={`p-0.5 rounded ${isSelected ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-ink-400 hover:text-kumkum-600 hover:bg-kumkum-50'}`}
                        title="Delete"
                        onClick={(e) => { e.stopPropagation(); setErr(''); setDeletingCat(cat); }}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {msg && <p className="text-sm text-leaf-700 mb-3">{msg}</p>}

          {/* ── Items panel ─────────────────────────────────────────────────────── */}
          {tab && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-ink-500 uppercase tracking-wide font-semibold">
                  {currentType.name} — {all.length} item{all.length !== 1 ? 's' : ''}
                </p>
                {can('temple-config', 'create') && (
                  <div className="flex gap-2">
                    {!online && (
                      <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-center">
                        Offline — cannot add or edit
                      </span>
                    )}
                    <button
                      className="btn-outline disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={!online}
                      title={!online ? 'Connect to server to add items' : ''}
                      onClick={() => setEditing({ nameEn: '', nameTa: '', price: '', parentId: null, isGroup: false })}
                    >
                      <Plus size={15} /> Add item
                    </button>
                  </div>
                )}
              </div>

              <div className="card overflow-x-auto">
                <table className="table" onDragEnd={handleDragEnd}>
                  <thead>
                    <tr>
                      <th className="w-8 !px-2"></th>
                      <th>Name (English)</th>
                      <th>Name (Tamil)</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-ink-600 py-10">
                          No items yet — click "Add group" to create sections, or "Add item" for flat items.
                        </td>
                      </tr>
                    ) : (() => {
                      const rowProps = {
                        canEdit: can('temple-config', 'edit') && online,
                        canCreate: can('temple-config', 'create') && online,
                        canDelete: can('temple-config', 'delete') && online,
                        all,
                        draggingId,
                        dragOverId,
                        onDragStart: handleDragStart,
                        onDragOver: handleDragOver,
                        onDragEnd: handleDragEnd,
                        onDrop: handleDrop,
                        onEdit: (v) => setEditing({ ...v, price: v.price ?? '', isGroup: !v.parentId && !v.price }),
                        onToggle: toggleActive,
                        onDelete: setDeleting,
                        onAddSub: (v) => setEditing({ nameEn: '', nameTa: '', price: '', parentId: v.id, isGroup: false }),
                      };
                      return parents.map((p) => (
                        <Frag key={p.id}>
                          <ValueRow v={p} {...rowProps} />
                          {childrenOf(p.id).map((c) => <ValueRow key={c.id} v={c} indent {...rowProps} />)}
                        </Frag>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
              {can('temple-config', 'edit') && all.length > 1 && (
                <p className="text-xs text-ink-400 mt-1.5 text-right flex items-center justify-end gap-1">
                  <GripVertical size={11} /> Drag rows to reorder
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Add / Edit item modal ──────────────────────────────────────────────── */}
      <Modal
        title={
          editing?.id
            ? `Edit "${editing.nameEn}"`
            : editing?.isGroup
              ? `Add group to ${currentType.name || tab}`
              : editing?.parentId
                ? `Add sub-item`
                : `Add item to ${currentType.name || tab}`
        }
        open={!!editing}
        onClose={() => { setEditing(null); setErr(''); }}
      >
        {editing && (
          <div className="space-y-3">
            <div>
              <label className="label">Name (English)</label>
              <input
                className="input"
                placeholder={editing.isGroup ? 'e.g. Ubhayam, Archanai Types…' : 'e.g. Kanda Shasti Ubhayam'}
                autoFocus
                value={editing.nameEn}
                onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Name (Tamil) — prints on chit</label>
              <input
                className="input"
                placeholder="Tamil name (optional)"
                value={editing.nameTa || ''}
                onChange={(e) => setEditing({ ...editing, nameTa: e.target.value })}
              />
            </div>

            {/* Group selector hidden per config — Add group button removed too */}
            {false && !editing.isGroup && !editing.parentId && hasParents && (
              <div>
                <label className="label">Assign to group <span className="text-ink-400 font-normal">(optional)</span></label>
                <select
                  className="input"
                  value={editing.parentId || ''}
                  onChange={(e) => setEditing({ ...editing, parentId: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">No group (top-level item)</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>{p.nameEn}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Sub-item parent label (read-only, can't change parent mid-edit) */}
            {editing.parentId && !editing.id && (
              <p className="text-sm text-ink-600">
                Sub-item of: <span className="font-semibold">{parents.find((p) => p.id === Number(editing.parentId))?.nameEn}</span>
              </p>
            )}

            {/* Price: not shown for group headers */}
            {!editing.isGroup && (
              <div>
                <label className="label">Price (RM) — leave blank for open amount</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={editing.price ?? ''}
                  onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                />
              </div>
            )}

            {editing.isGroup && (
              <p className="text-xs text-ink-500 bg-cream-50 border border-gold-200 rounded-lg px-3 py-2">
                Group headers organise items into sections in the POS. Add items under this group using the + button on the row.
              </p>
            )}

            {err && <p className="text-sm text-kumkum-600">{err}</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => { setEditing(null); setErr(''); }}>Cancel</button>
              <button className="btn-primary" disabled={!editing.nameEn?.trim() || (!editing.isGroup && (editing.price === '' || editing.price == null)) || busy} onClick={save}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Rename category modal ──────────────────────────────────────────────── */}
      <Modal title="Rename category" open={!!editingCat} onClose={() => { setEditingCat(null); setErr(''); }}>
        {editingCat && (
          <div className="space-y-3">
            <div>
              <label className="label">Category name</label>
              <input
                className="input"
                autoFocus
                value={editingCat.name}
                onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && saveCategoryEdit()}
              />
            </div>
            {err && <p className="text-sm text-kumkum-600">{err}</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => { setEditingCat(null); setErr(''); }}>Cancel</button>
              <button className="btn-primary" disabled={!editingCat.name?.trim() || busy} onClick={saveCategoryEdit}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Add category modal ─────────────────────────────────────────────────── */}
      <Modal title="Add POS category" open={!!newCat} onClose={() => { setNewCat(null); setErr(''); }}>
        {newCat && (
          <div className="space-y-3">
            <div>
              <label className="label">Category name</label>
              <input
                className="input"
                placeholder="e.g. Prayers / Pooja"
                autoFocus
                value={newCat.name}
                onChange={(e) => setNewCat({ ...newCat, name: e.target.value, code: slugify(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Code (auto-generated, must be unique)</label>
              <input
                className="input font-mono uppercase"
                placeholder="PRAYERS_POOJA"
                value={newCat.code}
                onChange={(e) => setNewCat({ ...newCat, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
              />
              <p className="text-xs text-ink-500 mt-1">Used internally. Cannot be changed later.</p>
            </div>
            {err && <p className="text-sm text-kumkum-600">{err}</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => { setNewCat(null); setErr(''); }}>Cancel</button>
              <button className="btn-primary" disabled={!newCat.name?.trim() || !newCat.code?.trim() || busy} onClick={saveCategory}>
                {busy ? 'Creating…' : 'Create category'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Confirm delete item ────────────────────────────────────────────────── */}
      <ConfirmModal
        open={!!deleting}
        title="Delete item"
        message={`Delete "${deleting?.nameEn}"? If it has been used in sales it will be deactivated instead.`}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
        busy={busy}
      />

      {/* ── Confirm delete category ────────────────────────────────────────────── */}
      <ConfirmModal
        open={!!deletingCat}
        title="Delete category"
        message={`Delete category "${deletingCat?.name}" and all its items? This cannot be undone. If any items have been used in sales, deletion will be blocked.`}
        onConfirm={deleteCategory}
        onClose={() => setDeletingCat(null)}
        confirmLabel="Delete category"
        busy={busy}
      />
    </div>
  );
}
