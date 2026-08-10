import jwt from 'jsonwebtoken';
import { User, Role, RolePermission, UserPermission, MenuItem } from './db.js';

const USER_INCLUDE = [
  {
    model: Role, as: 'role',
    include: [{ model: RolePermission, as: 'permissions', include: [{ model: MenuItem, as: 'menuItem' }] }],
  },
  { model: UserPermission, as: 'permissions', include: [{ model: MenuItem, as: 'menuItem' }] },
];

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(payload.sub, { include: USER_INCLUDE });
    if (!user || !user.isActive) return res.status(401).json({ error: 'Account disabled' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired' });
  }
}

export function flattenPermissions(user) {
  const map = {};
  for (const p of user.role.permissions) {
    map[p.menuItem.key] = {
      view: p.canView, create: p.canCreate, edit: p.canEdit, delete: p.canDelete, export: p.canExport,
    };
  }
  for (const p of user.permissions) {
    map[p.menuItem.key] = {
      view: p.canView, create: p.canCreate, edit: p.canEdit, delete: p.canDelete, export: p.canExport,
    };
  }
  return map;
}

export { USER_INCLUDE };
