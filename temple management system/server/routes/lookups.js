import { Router } from 'express';
import { Op } from 'sequelize';
import { LookupType, LookupValue, TransactionItem } from '../db.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { can } from '../middleware/can.js';
import { audit } from '../middleware/audit.js';

const r = Router();
r.use(requireAuth);

r.get('/', async (req, res, next) => {
  try {
    const showAll = req.query.all === '1';
    const valueWhere = showAll ? {} : { isActive: true };
    const types = await LookupType.findAll({
      include: [{ model: LookupValue, as: 'values', where: valueWhere, required: false }],
      order: [
        ['sortOrder', 'ASC'],
        ['name', 'ASC'],
        [{ model: LookupValue, as: 'values' }, 'sortOrder', 'ASC'],
        [{ model: LookupValue, as: 'values' }, 'nameEn', 'ASC'],
      ],
    });
    const out = {};
    for (const t of types) {
      out[t.code] = { id: t.id, name: t.name, isPosMenu: t.isPosMenu, sortOrder: t.sortOrder, values: t.values };
    }
    res.json(out);
  } catch (e) { next(e); }
});

r.get('/types', requireAuth, async (req, res, next) => {
  try {
    const types = await LookupType.findAll({ order: [['sortOrder', 'ASC'], ['name', 'ASC']] });
    res.json(types);
  } catch (e) { next(e); }
});

r.post('/types', can('temple-config', 'create'), async (req, res, next) => {
  try {
    const { code, name, sortOrder } = req.body;
    if (!code?.trim() || !name?.trim()) return res.status(400).json({ error: 'Code and name are required' });
    const type = await LookupType.create({
      code: code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
      name: name.trim(), isPosMenu: true, sortOrder: sortOrder ?? 0,
    });
    res.status(201).json(type);
  } catch (e) { next(e); }
});

r.put('/types/reorder', can('temple-config', 'edit'), async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
    await Promise.all(ids.map((id, idx) => LookupType.update({ sortOrder: idx }, { where: { id: Number(id) } })));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.put('/types/:id', can('temple-config', 'edit'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, sortOrder, isPosMenu } = req.body;
    const data = {};
    if (name != null) data.name = name;
    if (sortOrder != null) data.sortOrder = sortOrder;
    if (isPosMenu != null) data.isPosMenu = isPosMenu;
    await LookupType.update(data, { where: { id } });
    const type = await LookupType.findByPk(id);
    res.json(type);
  } catch (e) { next(e); }
});

r.delete('/types/:id', can('temple-config', 'delete'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const type = await LookupType.findByPk(id, { include: [{ model: LookupValue, as: 'values' }] });
    if (!type) return res.status(404).json({ error: 'Category not found' });
    if (type.values?.length) {
      const usedCount = await TransactionItem.count({ where: { lookupValueId: type.values.map((v) => v.id) } });
      if (usedCount > 0) return res.status(400).json({ error: 'Cannot delete â€” items in this category have been used in sales' });
      await LookupValue.destroy({ where: { typeId: id } });
    }
    await LookupType.destroy({ where: { id } });
    await audit(req, 'DELETE', 'LookupType', id, type.toJSON(), null);
    res.json({ deleted: true, message: `Category "${type.name}" deleted` });
  } catch (e) { next(e); }
});

r.post('/:typeCode/values', can('lookups', 'create'), async (req, res, next) => {
  try {
    const type = await LookupType.findOne({ where: { code: req.params.typeCode } });
    if (!type) return res.status(404).json({ error: 'Unknown lookup type' });
    const { nameEn, nameTa, price, depositPct, parentId, sortOrder, meta } = req.body;
    if (!nameEn?.trim()) return res.status(400).json({ error: 'Name is required' });
    const value = await LookupValue.create({
      typeId: type.id, nameEn: nameEn.trim(), nameTa, parentId: parentId || null,
      price: price === '' || price == null ? null : price,
      depositPct: depositPct || null, sortOrder: sortOrder ?? 0, meta,
    });
    await audit(req, 'CREATE', 'LookupValue', value.id, null, value.toJSON());
    res.status(201).json(value);
  } catch (e) { next(e); }
});

r.put('/values/reorder', can('temple-config', 'edit'), async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
    await Promise.all(ids.map((id, idx) => LookupValue.update({ sortOrder: idx }, { where: { id: Number(id) } })));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.put('/values/:id', can('lookups', 'edit'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const before = await LookupValue.findByPk(id);
    const { nameEn, nameTa, price, depositPct, parentId, sortOrder, isActive, meta } = req.body;
    await LookupValue.update({
      nameEn, nameTa,
      ...(parentId !== undefined && { parentId }),
      price: price === '' ? null : price,
      depositPct, sortOrder, isActive, meta,
    }, { where: { id } });
    const value = await LookupValue.findByPk(id);
    await audit(req, 'UPDATE', 'LookupValue', id, before?.toJSON(), value?.toJSON());
    res.json(value);
  } catch (e) { next(e); }
});

r.delete('/values/:id', can('lookups', 'delete'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [used, children] = await Promise.all([
      TransactionItem.count({ where: { lookupValueId: id } }),
      LookupValue.count({ where: { parentId: id } }),
    ]);
    if (used > 0 || children > 0) {
      await LookupValue.update({ isActive: false }, { where: { id } });
      const value = await LookupValue.findByPk(id);
      await audit(req, 'DEACTIVATE', 'LookupValue', id, null, value?.toJSON());
      return res.json({ deactivated: true, value, message: 'Value is in use, so it was deactivated instead of deleted' });
    }
    await LookupValue.destroy({ where: { id } });
    await audit(req, 'DELETE', 'LookupValue', id, null, null);
    res.json({ deleted: true });
  } catch (e) { next(e); }
});

export default r;

