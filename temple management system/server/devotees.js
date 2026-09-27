import { Router } from 'express';
import { Op } from 'sequelize';
import { Devotee, DevoteeMembership, DevoteeNote, HallBooking, Transaction, TransactionItem, User } from './db.js';
import { requireAuth } from './authMiddleware.js';
import { can } from './can.js';

const r = Router();
r.use(requireAuth);

const DEVOTEE_SORT = { name: 'name', phone: 'phone', email: 'email', createdAt: 'createdAt' };

r.get('/:id(\\d+)', can('devotees', 'view'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const devotee = await Devotee.findByPk(id);
    if (!devotee) return res.status(404).json({ error: 'Not found' });
    const [bookings, transactions, notes] = await Promise.all([
      HallBooking.findAll({
        where: { devoteeId: id },
        include: [{ model: Transaction, as: 'transactions', attributes: ['id', 'total', 'status'] }],
        order: [['eventDate', 'DESC']],
      }),
      Transaction.findAll({
        where: { devoteeId: id },
        include: [{ model: TransactionItem, as: 'items' }],
        order: [['txDate', 'DESC']],
      }),
      DevoteeNote.findAll({
        where: { devoteeId: id },
        include: [{ model: User, as: 'createdBy', attributes: ['name'] }],
        order: [['createdAt', 'DESC']],
      }),
    ]);

    let memberships = await DevoteeMembership.findAll({
      where: { devoteeId: id },
      order: [['membershipStartDate', 'DESC']],
    });

    // Auto-migrate: if devotee has membership data but no history rows yet, create one
    const dev = devotee.toJSON();
    if (memberships.length === 0 && dev.memberType === 'MEMBER' && dev.membershipTypeId) {
      const migrated = await DevoteeMembership.create({
        devoteeId: id,
        membershipTypeId: dev.membershipTypeId,
        membershipTypeLabel: dev.membershipTypeLabel,
        membershipPrice: dev.membershipPrice,
        membershipMonths: dev.membershipMonths,
        membershipUnit: 'month',
        membershipStartDate: dev.membershipStartDate,
        membershipEndDate: dev.membershipEndDate,
        membershipPaidVia: dev.membershipPaidVia,
        createdAt: dev.createdAt || new Date(),
      });
      memberships = [migrated];
    }

    res.json({ devotee, bookings, transactions, notes, memberships });
  } catch (e) { next(e); }
});

r.get('/', can('devotees', 'view'), async (req, res, next) => {
  try {
    const { search = '', memberType = '', page = 1, pageSize = 25, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const conditions = [];
    if (search) conditions.push({ [Op.or]: [{ name: { [Op.like]: `%${search}%` } }, { phone: { [Op.like]: `%${search}%` } }, { icNumber: { [Op.like]: `%${search}%` } }] });
    if (memberType) conditions.push({ memberType });
    const where = conditions.length ? { [Op.and]: conditions } : {};
    const sortField = DEVOTEE_SORT[sortBy] ?? 'createdAt';
    const [rows, total] = await Promise.all([
      Devotee.findAll({ where, offset: (Number(page) - 1) * Number(pageSize), limit: Number(pageSize), order: [[sortField, sortOrder === 'asc' ? 'ASC' : 'DESC']] }),
      Devotee.count({ where }),
    ]);
    res.json({ rows, total });
  } catch (e) { next(e); }
});

r.post('/', can('devotees', 'create'), async (req, res, next) => {
  try {
    const { name, phone, altPhone, icNumber, address, addressTa, email,
            memberType, membershipTypeId, membershipTypeLabel,
            membershipPrice, membershipMonths, membershipStartDate, membershipEndDate, membershipPaidVia } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (phone?.trim()) {
      const dup = await Devotee.findOne({ where: { phone: phone.trim() } });
      if (dup) return res.status(409).json({ error: `Phone number already registered to ${dup.name}` });
    }
    const devotee = await Devotee.create({
      name: name.trim(), phone, altPhone, icNumber, address, addressTa, email,
      memberType: memberType || null, membershipTypeId: membershipTypeId || null,
      membershipTypeLabel: membershipTypeLabel || null, membershipPrice: membershipPrice || null,
      membershipMonths: membershipMonths || null, membershipStartDate: membershipStartDate || null,
      membershipEndDate: membershipEndDate || null, membershipPaidVia: membershipPaidVia || null,
      createdAt: new Date(),
    });
    res.status(201).json(devotee);
  } catch (e) { next(e); }
});

r.put('/:id', can('devotees', 'edit'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, phone, altPhone, icNumber, address, addressTa, email,
            memberType, membershipTypeId, membershipTypeLabel,
            membershipPrice, membershipMonths, membershipStartDate, membershipEndDate, membershipPaidVia } = req.body;
    if (phone?.trim()) {
      const dup = await Devotee.findOne({ where: { phone: phone.trim(), id: { [Op.ne]: id } } });
      if (dup) return res.status(409).json({ error: `Phone number already registered to ${dup.name}` });
    }
    await Devotee.update({
      name, phone, altPhone, icNumber, address, addressTa, email,
      memberType: memberType || null, membershipTypeId: membershipTypeId || null,
      membershipTypeLabel: membershipTypeLabel || null, membershipPrice: membershipPrice || null,
      membershipMonths: membershipMonths || null, membershipStartDate: membershipStartDate || null,
      membershipEndDate: membershipEndDate || null, membershipPaidVia: membershipPaidVia || null,
    }, { where: { id } });
    res.json(await Devotee.findByPk(id));
  } catch (e) { next(e); }
});

r.delete('/:id', can('devotees', 'delete'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [txCount, bookingCount] = await Promise.all([
      Transaction.count({ where: { devoteeId: id } }),
      HallBooking.count({ where: { devoteeId: id } }),
    ]);
    if (txCount > 0 || bookingCount > 0) {
      return res.status(409).json({
        error: `Cannot delete — devotee has ${[txCount && `${txCount} transaction(s)`, bookingCount && `${bookingCount} booking(s)`].filter(Boolean).join(' and ')}`,
      });
    }
    await Devotee.destroy({ where: { id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.post('/:id(\\d+)/memberships', can('devotees', 'edit'), async (req, res, next) => {
  try {
    const devoteeId = Number(req.params.id);
    const { membershipTypeId, membershipTypeLabel, membershipPrice, membershipMonths, membershipUnit,
            membershipStartDate, membershipEndDate, membershipPaidVia } = req.body;
    const membership = await DevoteeMembership.create({
      devoteeId, membershipTypeId: membershipTypeId || null, membershipTypeLabel: membershipTypeLabel || null,
      membershipPrice: membershipPrice || null, membershipMonths: membershipMonths || null,
      membershipUnit: membershipUnit || null, membershipStartDate: membershipStartDate || null,
      membershipEndDate: membershipEndDate || null, membershipPaidVia: membershipPaidVia || null,
      createdAt: new Date(),
    });
    // Keep devotee flat fields in sync with the latest membership
    await Devotee.update({
      memberType: 'MEMBER', membershipTypeId: membershipTypeId || null,
      membershipTypeLabel: membershipTypeLabel || null, membershipPrice: membershipPrice || null,
      membershipMonths: membershipMonths || null, membershipStartDate: membershipStartDate || null,
      membershipEndDate: membershipEndDate || null, membershipPaidVia: membershipPaidVia || null,
    }, { where: { id: devoteeId } });
    res.status(201).json(membership);
  } catch (e) { next(e); }
});

r.put('/:devoteeId(\\d+)/memberships/:memId(\\d+)', can('devotees', 'edit'), async (req, res, next) => {
  try {
    const devoteeId = Number(req.params.devoteeId);
    const memId = Number(req.params.memId);
    const { membershipTypeId, membershipTypeLabel, membershipPrice, membershipMonths, membershipUnit,
            membershipStartDate, membershipEndDate, membershipPaidVia } = req.body;
    await DevoteeMembership.update({
      membershipTypeId: membershipTypeId || null, membershipTypeLabel: membershipTypeLabel || null,
      membershipPrice: membershipPrice || null, membershipMonths: membershipMonths || null,
      membershipUnit: membershipUnit || null, membershipStartDate: membershipStartDate || null,
      membershipEndDate: membershipEndDate || null, membershipPaidVia: membershipPaidVia || null,
    }, { where: { id: memId, devoteeId } });
    // If this is the latest membership, sync devotee flat fields too
    const latest = await DevoteeMembership.findOne({ where: { devoteeId }, order: [['membershipStartDate', 'DESC']] });
    if (latest?.id === memId) {
      await Devotee.update({
        membershipTypeId: membershipTypeId || null, membershipTypeLabel: membershipTypeLabel || null,
        membershipPrice: membershipPrice || null, membershipMonths: membershipMonths || null,
        membershipStartDate: membershipStartDate || null, membershipEndDate: membershipEndDate || null,
        membershipPaidVia: membershipPaidVia || null,
      }, { where: { id: devoteeId } });
    }
    res.json(await DevoteeMembership.findByPk(memId));
  } catch (e) { next(e); }
});

r.post('/:id/notes', can('devotees', 'edit'), async (req, res, next) => {
  try {
    const devoteeId = Number(req.params.id);
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Note body is required' });
    const note = await DevoteeNote.create({ devoteeId, body: body.trim(), createdById: req.user.id, createdAt: new Date() });
    const full = await DevoteeNote.findByPk(note.id, { include: [{ model: User, as: 'createdBy', attributes: ['name'] }] });
    res.status(201).json(full);
  } catch (e) { next(e); }
});

r.put('/:devoteeId/notes/:noteId', can('devotees', 'edit'), async (req, res, next) => {
  try {
    const id = Number(req.params.noteId);
    const devoteeId = Number(req.params.devoteeId);
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Note body is required' });
    await DevoteeNote.update({ body: body.trim() }, { where: { id, devoteeId } });
    const note = await DevoteeNote.findByPk(id, { include: [{ model: User, as: 'createdBy', attributes: ['name'] }] });
    res.json(note);
  } catch (e) { next(e); }
});

r.delete('/:devoteeId/notes/:noteId', can('devotees', 'edit'), async (req, res, next) => {
  try {
    const id = Number(req.params.noteId);
    const devoteeId = Number(req.params.devoteeId);
    await DevoteeNote.destroy({ where: { id, devoteeId } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
