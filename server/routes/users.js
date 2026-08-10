import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User, Role, RolePermission, UserPermission, MenuItem } from '../db.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { can } from '../middleware/can.js';
import { audit } from '../middleware/audit.js';

const r = Router();
r.use(requireAuth);

r.get('/', can('users', 'view'), async (_req, res, next) => {
  try {
    const users = await User.findAll({ include: [{ model: Role, as: 'role' }], order: [['name', 'ASC']] });
    res.json(users.map(u => { const j = u.toJSON(); delete j.passwordHash; return j; }));
  } catch (e) { next(e); }
});

r.post('/', can('users', 'create'), async (req, res, next) => {
  try {
    const { name, email, phone, password, roleId } = req.body;
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const user = await User.create({ name, email, phone, roleId: Number(roleId), passwordHash: await bcrypt.hash(password, 12), createdAt: new Date() });
    await audit(req, 'CREATE', 'User', user.id, null, { name, email, roleId });
    res.status(201).json({ id: user.id });
  } catch (e) { next(e); }
});

r.put('/:id', can('users', 'edit'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, email, phone, password, roleId, isActive } = req.body;
    const data = { name, email, phone, isActive };
    if (roleId) data.roleId = Number(roleId);
    if (password) data.passwordHash = await bcrypt.hash(password, 12);
    await User.update(data, { where: { id } });
    await audit(req, 'UPDATE', 'User', id, null, { name, email, roleId, isActive });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.delete('/:id', can('users', 'delete'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.user?.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    await User.destroy({ where: { id } });
    await audit(req, 'DELETE', 'User', id, null, {});
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.get('/:id/permissions', can('users', 'view'), async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const user = await User.findByPk(userId, {
      include: [{ model: Role, as: 'role', include: [{ model: RolePermission, as: 'permissions' }] }],
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const menus = (await MenuItem.findAll({ order: [['sortOrder', 'ASC']] })).filter((m) => m.key !== 'lookups');
    const roleByMenu = Object.fromEntries(user.role.permissions.map((p) => [p.menuItemId, p]));
    const overrides = await UserPermission.findAll({ where: { userId } });
    const overrideByMenu = Object.fromEntries(overrides.map((p) => [p.menuItemId, p]));
    res.json(menus.map((m) => {
      const o = overrideByMenu[m.id];
      const base = roleByMenu[m.id];
      return {
        menuItemId: m.id, key: m.key, label: m.label,
        canView: o?.canView ?? base?.canView ?? false,
        canCreate: o?.canCreate ?? base?.canCreate ?? false,
        canEdit: o?.canEdit ?? base?.canEdit ?? false,
        canDelete: o?.canDelete ?? base?.canDelete ?? false,
        canExport: o?.canExport ?? base?.canExport ?? false,
      };
    }));
  } catch (e) { next(e); }
});

r.put('/:id/permissions', can('users', 'edit'), async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const user = await User.findByPk(userId, { include: [{ model: Role, as: 'role' }] });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role?.name === 'Superadmin') return res.status(400).json({ error: 'Superadmin permissions cannot be changed' });
    for (const p of req.body.permissions) {
      await UserPermission.upsert({
        userId, menuItemId: p.menuItemId,
        canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete, canExport: p.canExport,
      });
    }
    await audit(req, 'UPDATE', 'UserPermission', userId, null, req.body.permissions);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;

