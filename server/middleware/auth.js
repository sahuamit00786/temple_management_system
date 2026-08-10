import jwt from 'jsonwebtoken';
import { db } from '../db.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db.user.findUnique({
      where: { id: payload.sub },
      include: { role: { include: { permissions: { include: { menuItem: true } } } } },
    });
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
  return map;
}
