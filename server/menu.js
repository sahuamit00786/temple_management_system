import { Router } from 'express';
import { MenuItem } from './db.js';
import { requireAuth } from './authMiddleware.js';

const r = Router();

r.get('/', requireAuth, async (req, res, next) => {
  try {
    const items = await MenuItem.findAll({ order: [['sortOrder', 'ASC']] });
    if (req.user.role.name === 'Superadmin') return res.json(items);
    const byMenu = new Map(req.user.role.permissions.map((p) => [p.menuItemId, p]));
    for (const p of req.user.permissions) byMenu.set(p.menuItemId, p);
    const allowed = new Set([...byMenu.values()].filter((p) => p.canView).map((p) => p.menuItemId));
    res.json(items.filter((i) => allowed.has(i.id) && i.key !== 'lookups'));
  } catch (e) { next(e); }
});

export default r;
