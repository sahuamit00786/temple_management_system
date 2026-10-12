import { Router } from 'express';
import { literal } from 'sequelize';
import { Role, MenuItem, RolePermission, User } from '../db.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { can } from '../middleware/can.js';
import { audit } from '../middleware/audit.js';

const r = Router();
r.use(requireAuth);

r.get('/', can('users', 'view'), async (_req, res, next) => {
  try {
    const roles = await Role.findAll({
      attributes: {
        include: [[literal('(SELECT COUNT(*) FROM `user` WHERE `user`.`roleId` = `Role`.`id`)'), 'userCount']],
      },
    });
    res.json(roles.map(r => {
      const { userCount, ...data } = r.toJSON();
      return { ...data, _count: { users: Number(userCount) || 0 } };
    }));
  } catch (e) { next(e); }
});

r.post('/', can('users', 'create'), async (req, res, next) => {
  try {
    const role = await Role.create({ name: req.body.name, description: req.body.description });
    await audit(req, 'CREATE', 'Role', role.id, null, role.toJSON());
    res.status(201).json(role);
  } catch (e) { next(e); }
});

r.put('/:id', can('users', 'edit'), async (req, res, next) => {
  try {
    const role = await Role.findByPk(Number(req.params.id));
    if (!role) return res.status(404).json({ error: 'Role not found' });
    if (role.name === 'Superadmin') return res.status(400).json({ error: 'Superadmin cannot be edited' });
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Role name is required' });
    if (role.isSystem && name !== role.name) return res.status(400).json({ error: 'System role name cannot be changed' });
    const before = role.toJSON();
    await role.update({ name, description: req.body.description });
    await audit(req, 'UPDATE', 'Role', role.id, before, role.toJSON());
    res.json(role);
  } catch (e) { next(e); }
});

r.delete('/:id', can('users', 'delete'), async (req, res, next) => {
  try {
    const role = await Role.findByPk(Number(req.params.id));
    if (!role) return res.status(404).json({ error: 'Role not found' });
    if (role.isSystem || role.name === 'Superadmin') return res.status(400).json({ error: 'System roles cannot be deleted' });
    const inUse = await User.count({ where: { roleId: role.id } });
    if (inUse > 0) return res.status(400).json({ error: `Cannot delete: ${inUse} user(s) still have this role. Reassign them first.` });
    const before = role.toJSON();
    await RolePermission.destroy({ where: { roleId: role.id } });
    await role.destroy();
    await audit(req, 'DELETE', 'Role', role.id, before, null);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.get('/:id/permissions', can('users', 'view'), async (req, res, next) => {
  try {
    const roleId = Number(req.params.id);
    const menus = (await MenuItem.findAll({ order: [['sortOrder', 'ASC']] })).filter((m) => m.key !== 'lookups');
    const perms = await RolePermission.findAll({ where: { roleId } });
    const byMenu = Object.fromEntries(perms.map((p) => [p.menuItemId, p]));
    res.json(menus.map((m) => ({
      menuItemId: m.id, key: m.key, label: m.label,
      canView: byMenu[m.id]?.canView ?? false,
      canCreate: byMenu[m.id]?.canCreate ?? false,
      canEdit: byMenu[m.id]?.canEdit ?? false,
      canDelete: byMenu[m.id]?.canDelete ?? false,
      canExport: byMenu[m.id]?.canExport ?? false,
    })));
  } catch (e) { next(e); }
});

r.put('/:id/permissions', can('users', 'edit'), async (req, res, next) => {
  try {
    const roleId = Number(req.params.id);
    const role = await Role.findByPk(roleId);
    if (role?.name === 'Superadmin') return res.status(400).json({ error: 'Superadmin permissions cannot be changed' });
    for (const p of req.body.permissions) {
      await RolePermission.upsert({
        roleId, menuItemId: p.menuItemId,
        canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete, canExport: p.canExport,
      });
    }
    await audit(req, 'UPDATE', 'RolePermission', roleId, null, req.body.permissions);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;

