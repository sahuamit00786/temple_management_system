import { Router } from 'express';
import { EventType, HallBooking } from '../db.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { can } from '../middleware/can.js';
import { audit } from '../middleware/audit.js';

const r = Router();
r.use(requireAuth);

const clean = (b) => ({
  nameEn: b.nameEn?.trim(),
  nameTa: b.nameTa?.trim() || null,
  price: b.price === '' || b.price == null ? null : b.price,
  depositPct: b.depositPct === '' || b.depositPct == null ? 50 : Number(b.depositPct),
});

r.get('/', async (req, res, next) => {
  try {
    const where = req.query.all === '1' ? {} : { isActive: true };
    res.json(await EventType.findAll({ where, order: [['sortOrder', 'ASC'], ['nameEn', 'ASC']] }));
  } catch (e) { next(e); }
});

r.post('/', can('temple-config', 'create'), async (req, res, next) => {
  try {
    const data = clean(req.body);
    if (!data.nameEn) return res.status(400).json({ error: 'Name is required' });
    const max = (await EventType.max('sortOrder')) ?? 0;
    const row = await EventType.create({ ...data, sortOrder: req.body.sortOrder ?? max + 1 });
    await audit(req, 'CREATE', 'EventType', row.id, null, row.toJSON());
    res.status(201).json(row);
  } catch (e) { next(e); }
});

r.put('/reorder', can('temple-config', 'edit'), async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
    await Promise.all(ids.map((id, idx) => EventType.update({ sortOrder: idx }, { where: { id: Number(id) } })));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.put('/:id', can('temple-config', 'edit'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const before = await EventType.findByPk(id);
    if (!before) return res.status(404).json({ error: 'Event type not found' });
    const data = clean(req.body);
    if (!data.nameEn) return res.status(400).json({ error: 'Name is required' });
    if (req.body.isActive != null) data.isActive = !!req.body.isActive;
    await EventType.update(data, { where: { id } });
    const row = await EventType.findByPk(id);
    await audit(req, 'UPDATE', 'EventType', id, before.toJSON(), row.toJSON());
    res.json(row);
  } catch (e) { next(e); }
});

r.delete('/:id', can('temple-config', 'delete'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await EventType.findByPk(id);
    if (!row) return res.status(404).json({ error: 'Event type not found' });
    if (await HallBooking.count({ where: { eventTypeId: id } })) {
      await row.update({ isActive: false });
      await audit(req, 'DEACTIVATE', 'EventType', id, null, row.toJSON());
      return res.json({ deactivated: true, value: row, message: 'Event type is used by bookings, so it was deactivated instead of deleted' });
    }
    await row.destroy();
    await audit(req, 'DELETE', 'EventType', id, row.toJSON(), null);
    res.json({ deleted: true });
  } catch (e) { next(e); }
});

export default r;
