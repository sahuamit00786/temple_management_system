import { useEffect, useState, useCallback } from 'react';
import { useTabParam } from '../hooks/useTabParam.js';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../auth/AppContext.jsx';
import { api } from '../api/client.js';
import { ldb } from '../db/dexie.js';
import Tabs from '../components/Tabs.jsx';
import Modal from '../components/Modal.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import DataTable from '../components/DataTable.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { Toast, useToast } from '../components/Toast.jsx';

const TABS = [
  { key: 'users', label: 'Users' },
  { key: 'roles', label: 'Roles' },
  { key: 'permissions', label: 'Menu Permissions' },
];
// Edit/Delete are open to every role, so they are not part of the permission matrix
const ACTIONS = ['canView', 'canCreate', 'canExport'];
const ACTION_LABEL = { canView: 'View', canCreate: 'Create', canEdit: 'Edit', canDelete: 'Delete', canExport: 'Export' };

export default function Users() {
  const { can, user: me, online } = useApp();
  const [tab, setTab] = useTabParam('users', ['users', 'roles', 'permissions']);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [editUser, setEditUser] = useState(null);
  const [newRole, setNewRole] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [deletingRole, setDeletingRole] = useState(null);
  const [permUserId, setPermUserId] = useState('');
  const [matrix, setMatrix] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const { msg: toastMsg, show: showToast, clear: clearToast } = useToast();

  const load = useCallback(async () => {
    let serverUsers = null;
    try { serverUsers = await api('/users'); } catch {}
    const r = await api('/roles').catch(() => []);
    setRoles(r);

    let pending = [];
    try { pending = await ldb.userOutbox.where('status').equals('pending').toArray(); } catch {}
    const pendingRows = pending.map((item) => ({ ...item.data, _pending: true, _outboxId: item.id }));

    if (serverUsers) {
      const merged = [...serverUsers, ...pendingRows];
      setUsers(merged);
      if (!permUserId) {
        const first = merged.find((x) => x.role?.name !== 'Superadmin' && x.id !== me?.id && !x._pending);
        if (first) setPermUserId(String(first.id));
      }
    } else {
      setUsers(pendingRows);
    }
  }, [permUserId]);
  useEffect(() => { load().catch((e) => setErr(e.message)); }, [load]);

  const permUser = users.find((u) => String(u.id) === permUserId);
  const permRoleId = permUser?.role?.id ? String(permUser.role.id) : '';
  const permRole = roles.find((r) => String(r.id) === permRoleId);

  useEffect(() => {
    if (tab === 'permissions' && permUserId) api(`/users/${permUserId}/permissions`).then(setMatrix).catch((e) => setErr(e.message));
  }, [tab, permUserId]);

  const saveUser = async () => {
    setBusy(true); setErr('');
    try {
      if (editUser.id) {
        await api(`/users/${editUser.id}`, { method: 'PUT', body: editUser });
      } else if (!online) {
        await ldb.userOutbox.add({ data: editUser, status: 'pending', createdAt: new Date().toISOString() });
        setUsers((prev) => [...prev, { ...editUser, _pending: true }]);
      } else {
        await api('/users', { method: 'POST', body: editUser });
        load();
      }
      setEditUser(null);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const saveRole = async () => {
    setBusy(true); setErr('');
    try {
      if (newRole.id) await api(`/roles/${newRole.id}`, { method: 'PUT', body: newRole });
      else await api('/roles', { method: 'POST', body: newRole });
      setNewRole(null); load();
    }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const removeUser = async () => {
    setBusy(true);
    try { await api(`/users/${deletingUser.id}`, { method: 'DELETE' }); setDeletingUser(null); load(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const removeRole = async () => {
    setBusy(true); setErr('');
    try { await api(`/roles/${deletingRole.id}`, { method: 'DELETE' }); setDeletingRole(null); load(); }
    catch (e) { setErr(e.message); setDeletingRole(null); }
    finally { setBusy(false); }
  };

  const savePermissions = async () => {
    setBusy(true); setErr(''); setSaved(false);
    try {
      await api(`/users/${permUserId}/permissions`, { method: 'PUT', body: { permissions: matrix } });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {err && <p className="text-sm text-kumkum-600 mb-3">{err}</p>}

      {tab === 'users' && (
        <>
          {!online && (
            <div className="mb-3 rounded-md bg-amber-50 border border-amber-300 px-3 py-2 text-sm text-amber-800">
              Offline — new users will be queued and synced when connection is restored.
            </div>
          )}
          {can('users', 'create') && (
            <button className="btn-primary mb-4" onClick={() => setEditUser({ name: '', email: '', phone: '', password: '', roleId: roles[0]?.id })}>
              <Plus size={16} /> Add user
            </button>
          )}
          <DataTable
            columns={[
              { key: 'name', label: 'Name', render: (u) => (
                <span className="font-medium flex items-center gap-2">
                  {u.name}
                  {u._pending && <span className="chip bg-amber-100 text-amber-700 text-xs">Pending sync</span>}
                </span>
              )},
              { key: 'email', label: 'Email' },
              { key: 'role', label: 'Role', render: (u) => u.role?.name ? <span className="chip bg-saffron-100 text-saffron-600">{u.role.name}</span> : <span className="text-ink-400">—</span> },
              { key: 'isActive', label: 'Status', render: (u) => u._pending ? <span className="chip bg-amber-100 text-amber-700">Pending</span> : u.isActive ? <span className="chip-paid">Active</span> : <span className="chip-cancelled">Disabled</span> },
              { key: 'lastLoginAt', label: 'Last login', render: (u) => u._pending ? '—' : u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-MY') : 'Never' },
              { key: 'actions', label: '', render: (u) => !u._pending && <span className="flex gap-1">
                {can('users', 'edit') && u.id !== me?.id && <button className="btn-ghost !p-1.5" onClick={() => setEditUser({ ...u, roleId: u.role?.id, password: '' })}><Pencil size={15} /></button>}
                {can('users', 'delete') && u.id !== me?.id && <button className="btn-ghost !p-1.5 text-kumkum-600" onClick={() => setDeletingUser(u)}><Trash2 size={15} /></button>}
              </span> },
            ]}
            rows={users.filter((u) => u.role?.name !== 'Superadmin' || u._pending)}
          />
        </>
      )}

      {tab === 'roles' && (
        <>
          {can('users', 'create') && (
            <button className="btn-primary mb-4" onClick={() => setNewRole({ name: '', description: '' })}><Plus size={16} /> Add role</button>
          )}
          <DataTable
            columns={[
              { key: 'name', label: 'Role', render: (r) => <span className="font-medium">{r.name}</span> },
              { key: 'description', label: 'Description' },
              { key: '_count', label: 'Users', render: (r) => r._count?.users ?? 0 },
              { key: 'actions', label: '', render: (r) => (
                <div className="flex gap-1">
                  {can('users', 'edit') && <button className="btn-ghost !p-1.5" onClick={() => setNewRole({ id: r.id, name: r.name, description: r.description || '', isSystem: r.isSystem })}><Pencil size={15} /></button>}
                  {can('users', 'delete') && <button className="btn-ghost !p-1.5 text-kumkum-600" onClick={() => setDeletingRole(r)}><Trash2 size={15} /></button>}
                </div>
              ) },
            ]}
            rows={roles.filter((r) => r.name !== 'Superadmin')}
          />
        </>
      )}

      {tab === 'permissions' && (
        <div className="card !overflow-visible p-4">
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="label">User</label>
              <SearchableSelect
                className="!w-64"
                options={users.filter((u) => u.role?.name !== 'Superadmin' && u.id !== me?.id).map((u) => ({ value: u.id, label: `${u.name} (${u.role?.name || '—'})` }))}
                value={permUserId}
                onChange={(v) => setPermUserId(String(v))}
              />
            </div>
            {permUser && (
              <p className="text-sm text-ink-600 pb-2">
                Role: <b className="text-maroon-900">{permRole?.name}</b>
              </p>
            )}
            {can('users', 'edit') && (
              <button
                className="btn-primary"
                disabled={busy}
                onClick={() => { if (!online) { showToast('Offline — cannot save permissions. Connect to the internet first.'); return; } savePermissions(); }}
              >{busy ? 'Saving…' : 'Save permissions'}</button>
            )}
            {saved && <span className="chip-paid pb-2">Saved</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Menu</th>
                  <th className="text-center text-saffron-600">All</th>
                  {ACTIONS.map((a) => <th key={a} className="text-center">{ACTION_LABEL[a]}</th>)}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, i) => {
                  const rowAll = ACTIONS.every((a) => row[a]);
                  return (
                    <tr key={row.menuItemId}>
                      <td className="font-medium">{row.label}</td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-saffron-500"
                          disabled={permRole?.name === 'Superadmin'}
                          checked={permRole?.name === 'Superadmin' ? true : rowAll}
                          onChange={(e) => setMatrix((m) => m.map((r, j) => j === i ? { ...r, ...Object.fromEntries(ACTIONS.map((a) => [a, e.target.checked])) } : r))}
                        />
                      </td>
                      {ACTIONS.map((a) => (
                        <td key={a} className="text-center">
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-saffron-500"
                            disabled={permRole?.name === 'Superadmin'}
                            checked={permRole?.name === 'Superadmin' ? true : row[a]}
                            onChange={(e) => setMatrix((m) => m.map((r, j) => j === i ? { ...r, [a]: e.target.checked } : r))}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal title={editUser?.id ? `Edit ${editUser.name}` : 'Add user'} open={!!editUser} onClose={() => setEditUser(null)}>
        {editUser && (
          <div className="space-y-3">
            <div><label className="label">Name</label><input className="input" placeholder="Full name" value={editUser.name} onChange={(e) => setEditUser({ ...editUser, name: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input" type="email" placeholder="user@example.com" value={editUser.email} onChange={(e) => setEditUser({ ...editUser, email: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" placeholder="e.g. 012-3456789" value={editUser.phone || ''} onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })} /></div>
            <div>
              <label className="label">Role</label>
              <SearchableSelect
                options={roles.filter((r) => r.name !== 'Superadmin').map((r) => ({ value: r.id, label: r.name }))}
                value={editUser.roleId || ''}
                onChange={(v) => setEditUser({ ...editUser, roleId: v })}
              />
            </div>
            <div><label className="label">{editUser.id ? 'New password (leave blank to keep)' : 'Password (min 8 chars)'}</label><PasswordInput placeholder="••••••••" value={editUser.password} onChange={(e) => setEditUser({ ...editUser, password: e.target.value })} /></div>
            {editUser.id && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="w-4 h-4 accent-saffron-500" checked={editUser.isActive ?? true} onChange={(e) => setEditUser({ ...editUser, isActive: e.target.checked })} />
                Account active
              </label>
            )}
            {err && <p className="text-sm text-kumkum-600">{err}</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setEditUser(null)}>Cancel</button>
              <button className="btn-primary" disabled={busy || !editUser.name || !editUser.email} onClick={saveUser}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal title={newRole?.id ? `Edit ${newRole.name}` : 'Add role'} open={!!newRole} onClose={() => setNewRole(null)}>
        {newRole && (
          <div className="space-y-3">
            <div><label className="label">Role name</label><input className="input" placeholder="e.g. Cashier" value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} /></div>
            <div><label className="label">Description</label><input className="input" placeholder="Brief description of this role" value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setNewRole(null)}>Cancel</button>
              <button className="btn-primary" disabled={busy || !newRole.name} onClick={saveRole}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!deletingUser}
        title="Delete user"
        message={`Delete user "${deletingUser?.name}"? This cannot be undone.`}
        onConfirm={removeUser}
        onClose={() => setDeletingUser(null)}
        busy={busy}
      />

      <ConfirmModal
        open={!!deletingRole}
        title="Delete role"
        message={`Delete role "${deletingRole?.name}"? This cannot be undone.`}
        onConfirm={removeRole}
        onClose={() => setDeletingRole(null)}
        busy={busy}
      />

      <Toast message={toastMsg} onClose={clearToast} />
    </div>
  );
}
