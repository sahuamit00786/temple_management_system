import { Router } from 'express';
import { Op, fn, col } from 'sequelize';
import { Transaction, TransactionItem, HallBooking, Devotee, User } from '../db.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { can } from '../middleware/can.js';

const r = Router();
r.use(requireAuth);

const ORDER_KINDS = ['ARCHANAI', 'DONATION', 'ANNADHANAM'];

r.get('/', async (req, res, next) => {
  try {
    const { dateFrom, dateTo, type, paymentMode, status, search, page = 1, pageSize = 25, sortBy = 'txDate', sortOrder = 'desc' } = req.query;

    const where = {
      ...(type === 'booking' && { kind: 'HALL_PAYMENT' }),
      ...(type === 'order' && { kind: { [Op.in]: ORDER_KINDS } }),
      ...(paymentMode && { paymentMode }),
      ...(status && { status }),
      ...(dateFrom || dateTo ? { txDate: { ...(dateFrom && { [Op.gte]: new Date(dateFrom + 'T00:00:00') }), ...(dateTo && { [Op.lte]: new Date(dateTo + 'T23:59:59.999') }) } } : {}),
    };

    if (search) {
      const [matchedDevotees, matchedBookings, matchedStaff] = await Promise.all([
        Devotee.findAll({ where: { [Op.or]: [{ name: { [Op.like]: `%${search}%` } }, { phone: { [Op.like]: `%${search}%` } }] }, attributes: ['id'] }),
        HallBooking.findAll({ where: { bookingNo: { [Op.like]: `%${search}%` } }, attributes: ['id'] }),
        User.findAll({ where: { name: { [Op.like]: `%${search}%` } }, attributes: ['id'] }),
      ]);
      const dIds = matchedDevotees.map((d) => d.id);
      const bIds = matchedBookings.map((b) => b.id);
      const sIds = matchedStaff.map((u) => u.id);
      where[Op.or] = [
        { receiptNo: { [Op.like]: `%${search}%` } },
        { devoteeName: { [Op.like]: `%${search}%` } },
        ...(dIds.length ? [{ devoteeId: { [Op.in]: dIds } }] : []),
        ...(bIds.length ? [{ bookingId: { [Op.in]: bIds } }] : []),
        ...(sIds.length ? [{ createdById: { [Op.in]: sIds } }] : []),
      ];
    }

    const SORT_MAP = { txDate: 'txDate', total: 'total', receiptNo: 'receiptNo' };
    const sortField = SORT_MAP[sortBy] ?? 'txDate';

    const [rows, total, sumAgg] = await Promise.all([
      Transaction.findAll({
        where,
        include: [
          { model: User, as: 'createdBy', attributes: ['id', 'name'] },
          { model: HallBooking, as: 'booking', attributes: ['bookingNo', 'eventDate'], required: false },
          { model: Devotee, as: 'devotee', attributes: ['name', 'phone'], required: false },
          { model: TransactionItem, as: 'items', attributes: ['nameSnapshot', 'qty', 'priceSnapshot'] },
        ],
        order: [[sortField, sortOrder === 'asc' ? 'ASC' : 'DESC']],
        offset: (Number(page) - 1) * Number(pageSize),
        limit: Number(pageSize),
        subQuery: false,
      }),
      Transaction.count({ where }),
      Transaction.findOne({
        where: { ...where, status: 'PAID' },
        attributes: [[fn('SUM', col('total')), 'sum']],
        raw: true,
      }),
    ]);

    res.json({
      rows: rows.map((t) => ({ ...t.toJSON(), total: Number(t.total), type: t.kind === 'HALL_PAYMENT' ? 'booking' : 'order' })),
      total,
      sum: Number(sumAgg?.sum || 0),
    });
  } catch (e) { next(e); }
});

r.get('/membership', async (req, res, next) => {
  try {
    const { dateFrom, dateTo, paymentMode, search, page = 1, pageSize = 25, sortBy = 'membershipStartDate', sortOrder = 'desc' } = req.query;
    const where = {
      memberType: { [Op.in]: ['MEMBER', 'COMMITTEE'] },
      membershipPrice: { [Op.ne]: null },
      ...(paymentMode && { membershipPaidVia: paymentMode }),
      ...(dateFrom || dateTo ? {
        membershipStartDate: {
          ...(dateFrom && { [Op.gte]: dateFrom }),
          ...(dateTo && { [Op.lte]: dateTo }),
        },
      } : {}),
      ...(search && { [Op.or]: [{ name: { [Op.like]: `%${search}%` } }, { phone: { [Op.like]: `%${search}%` } }] }),
    };
    const SORT_MAP = { membershipStartDate: 'membershipStartDate', total: 'membershipPrice', name: 'name' };
    const sortField = SORT_MAP[sortBy] ?? 'membershipStartDate';
    const [rows, total, sumAgg] = await Promise.all([
      Devotee.findAll({ where, order: [[sortField, sortOrder === 'asc' ? 'ASC' : 'DESC']], offset: (Number(page) - 1) * Number(pageSize), limit: Number(pageSize) }),
      Devotee.count({ where }),
      Devotee.findOne({ where, attributes: [[fn('SUM', col('membershipPrice')), 'sum']], raw: true }),
    ]);
    res.json({ rows: rows.map((d) => d.toJSON()), total, sum: Number(sumAgg?.sum || 0) });
  } catch (e) { next(e); }
});

export default r;

