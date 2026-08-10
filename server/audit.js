import { AuditLog } from './db.js';

export async function audit(req, action, entity, entityId, before, after) {
  try {
    await AuditLog.create({
      userId: req.user.id, action, entity,
      entityId: entityId != null ? String(entityId) : null,
      before: before ?? null, after: after ?? null,
      ip: req.ip,
      createdAt: new Date(),
    });
  } catch (e) {
    console.error('audit failed', e.message);
  }
}
