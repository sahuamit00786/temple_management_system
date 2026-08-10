import { Router } from 'express';
import { Op, fn, col, literal } from 'sequelize';
import { Transaction, TransactionItem, HallBooking, Devotee, AuditLog, User } from '../db.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { can } from '../middleware/can.js';

const r = Router();
r.use(requireAuth, can('reports', 'view'));

function buildTxWhere(q, kindOverride) {
  const kind = kindOverride !== undefined ? kindOverride : (q.kind || undefined);
  const { dateFrom, dateTo, paymentMode, status, staffId } = q;
  return {
    ...(kind && { kind }),
    ...(paymentMode && { paymentMode }),
    ...(status ? { status } : {}),
    ...(staffId && { createdById: Number(staffId) }),
    ...(dateFrom || dateTo ? { txDate: { ...(dateFrom && { [Op.gte]: new Date(dateFrom + 'T00:00:00') }), ...(dateTo && { [Op.lte]: new Date(dateTo + 'T23:59:59.999') }) } } : {}),
  };
}

async function txReport(req, res, next, kindOverride) {
  try {
    const { page = 1, pageSize = 25, sortBy = 'txDate', sortOrder = 'desc', search, categoryId } = req.query;
    const where = buildTxWhere(req.query, kindOverride);

    if (search) {
      where[Op.or] = [{ receiptNo: { [Op.like]: `%${search}%` } }, { devoteeName: { [Op.like]: `%${search}%` } }];
    }
    if (categoryId) {
      const txIds = await TransactionItem.findAll({ where: { lookupValueId: Number(categoryId) }, attributes: ['transactionId'], raw: true });
      where.id = { [Op.in]: txIds.map((t) => t.transactionId) };
    }

    const paidWhere = { ...where, status: 'PAID' };
    const cancelledWhere = { ...where, status: 'CANCELLED' };

    const [rows, total, aggRow, cancelledCount, byModeRaw, byKindRaw] = await Promise.all([
      Transaction.findAll({
        where,
        include: [
          { model: TransactionItem, as: 'items' },
          { model: User, as: 'createdBy', attributes: ['name'] },
          { model: Devotee, as: 'devotee', required: false },
        ],
        order: [[sortBy || 'txDate', sortOrder === 'asc' ? 'ASC' : 'DESC']],
        offset: (Number(page) - 1) * Number(pageSize),
        limit: Number(pageSize),
      }),
      Transaction.count({ where }),
      Transaction.findOne({ where: paidWhere, attributes: [[fn('SUM', col('total')), 'sum'], [fn('COUNT', col('id')), 'cnt']], raw: true }),
      Transaction.count({ where: cancelledWhere }),
      Transaction.findAll({ where: paidWhere, attributes: ['paymentMode', [fn('SUM', col('total')), 'sum'], [fn('COUNT', col('id')), 'cnt']], group: ['paymentMode'], raw: true }),
      !kindOverride
        ? Transaction.findAll({ where: paidWhere, attributes: ['kind', [fn('SUM', col('total')), 'sum'], [fn('COUNT', col('id')), 'cnt']], group: ['kind'], raw: true })
        : Promise.resolve([]),
    ]);

    const byMode = byModeRaw.map((r) => ({ paymentMode: r.paymentMode, _sum: { total: r.sum }, _count: { _all: r.cnt } }));
    const byKind = byKindRaw.map((r) => ({ kind: r.kind, _sum: { total: r.sum }, _count: { _all: r.cnt } }));

    res.json({
      rows, total,
      sumTotal: aggRow?.sum || 0,
      paidCount: aggRow?.cnt || 0,
      cancelledCount,
      byMode, byKind,
    });
  } catch (e) { next(e); }
}

r.get('/daily-collection', (req, res, next) => txReport(req, res, next, undefined));
r.get('/archanai',         (req, res, next) => txReport(req, res, next, 'ARCHANAI'));
r.get('/donations',        (req, res, next) => txReport(req, res, next, 'DONATION'));
r.get('/annadhanam',       (req, res, next) => txReport(req, res, next, 'ANNADHANAM'));
r.get('/payments',         (req, res, next) => txReport(req, res, next, 'HALL_PAYMENT'));

r.get('/bookings', async (req, res, next) => {
  try {
    const { dateFrom, dateTo, status, eventTypeId, page = 1, pageSize = 25, sortBy = 'eventDate', sortOrder = 'desc', search } = req.query;
    const where = {
      ...(status && { status }),
      ...(eventTypeId && { eventTypeId: Number(eventTypeId) }),
      ...(dateFrom || dateTo ? { eventDate: { ...(dateFrom && { [Op.gte]: new Date(dateFrom + 'T00:00:00') }), ...(dateTo && { [Op.lte]: new Date(dateTo + 'T23:59:59.999') }) } } : {}),
    };
    if (search) {
      const matchedDevotees = await Devotee.findAll({ where: { name: { [Op.like]: `%${search}%` } }, attributes: ['id'] });
      const dIds = matchedDevotees.map((d) => d.id);
      where[Op.or] = [
        { bookingNo: { [Op.like]: `%${search}%` } },
        ...(dIds.length ? [{ devoteeId: { [Op.in]: dIds } }] : []),
      ];
    }

    const [rows, total, aggRate, countByStatusRaw, allIds] = await Promise.all([
      HallBooking.findAll({
        where,
        include: [
          { model: Devotee, as: 'devotee' },
          { model: Transaction, as: 'transactions', where: { status: 'PAID' }, required: false, attributes: ['total'] },
        ],
        order: [[sortBy || 'eventDate', sortOrder === 'asc' ? 'ASC' : 'DESC']],
        offset: (Number(page) - 1) * Number(pageSize),
        limit: Number(pageSize),
        subQuery: false,
      }),
      HallBooking.count({ where }),
      HallBooking.findOne({ where, attributes: [[fn('SUM', col('hallRate')), 'sum']], raw: true }),
      HallBooking.findAll({ where, attributes: ['status', [fn('COUNT', col('id')), 'cnt']], group: ['status'], raw: true }),
      HallBooking.findAll({ where, attributes: ['id'], raw: true }),
    ]);

    const aggPaid = await Transaction.findOne({
      where: { bookingId: { [Op.in]: allIds.map((b) => b.id) }, status: 'PAID' },
      attributes: [[fn('SUM', col('total')), 'sum']],
      raw: true,
    });

    const sumRate = Number(aggRate?.sum || 0);
    const sumPaid = Number(aggPaid?.sum || 0);
    const countByStatus = countByStatusRaw.reduce((acc, g) => ({ ...acc, [g.status]: Number(g.cnt) }), {});

    res.json({
      rows: rows.map((b) => {
        const j = b.toJSON();
        const totalPaid = (j.transactions || []).reduce((s, t) => s + Number(t.total), 0);
        delete j.transactions;
        return { ...j, totalPaid };
      }),
      total, sumRate, sumPaid,
      outstanding: Math.max(0, sumRate - sumPaid),
      countByStatus,
    });
  } catch (e) { next(e); }
});

r.get('/devotees', async (req, res, next) => {
  try {
    const { search, dateFrom, dateTo, memberType, page = 1, pageSize = 25, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const where = {
      ...(search && { [Op.or]: [{ name: { [Op.like]: `%${search}%` } }, { phone: { [Op.like]: `%${search}%` } }, { icNumber: { [Op.like]: `%${search}%` } }] }),
      ...(memberType && { memberType }),
      ...(dateFrom || dateTo ? { createdAt: { ...(dateFrom && { [Op.gte]: new Date(dateFrom + 'T00:00:00') }), ...(dateTo && { [Op.lte]: new Date(dateTo + 'T23:59:59.999') }) } } : {}),
    };
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

    const [rows, total, totalAll, thisMonth, withIc, withEmail] = await Promise.all([
      Devotee.findAll({
        where,
        attributes: {
          include: [
            [literal('(SELECT COUNT(*) FROM `hallbooking` WHERE `hallbooking`.`devoteeId` = `Devotee`.`id`)'), 'bookingsCount'],
            [literal('(SELECT COUNT(*) FROM `transaction` WHERE `transaction`.`devoteeId` = `Devotee`.`id`)'), 'transactionsCount'],
          ],
        },
        order: [[sortBy || 'createdAt', sortOrder === 'asc' ? 'ASC' : 'DESC']],
        offset: (Number(page) - 1) * Number(pageSize),
        limit: Number(pageSize),
      }),
      Devotee.count({ where }),
      Devotee.count(),
      Devotee.count({ where: { createdAt: { [Op.gte]: startOfMonth } } }),
      Devotee.count({ where: { icNumber: { [Op.ne]: null } } }),
      Devotee.count({ where: { email: { [Op.ne]: null } } }),
    ]);

    res.json({
      rows: rows.map((d) => {
        const { bookingsCount, transactionsCount, ...data } = d.toJSON();
        return { ...data, _count: { bookings: Number(bookingsCount) || 0, transactions: Number(transactionsCount) || 0 } };
      }),
      total, totalAll, thisMonth, withIc, withEmail,
    });
  } catch (e) { next(e); }
});

r.get('/audit', async (req, res, next) => {
  try {
    if (req.user.role.name !== 'Superadmin') return res.status(403).json({ error: 'Audit log is Superadmin only' });
    const { dateFrom, dateTo, userId, entity, action, page = 1, pageSize = 50 } = req.query;
    const where = {
      ...(userId && { userId: Number(userId) }),
      ...(entity && { entity }),
      ...(action && { action }),
      ...(dateFrom || dateTo ? { createdAt: { ...(dateFrom && { [Op.gte]: new Date(dateFrom + 'T00:00:00') }), ...(dateTo && { [Op.lte]: new Date(dateTo + 'T23:59:59.999') }) } } : {}),
    };
    const [rows, total, byActionRaw] = await Promise.all([
      AuditLog.findAll({ where, include: [{ model: User, as: 'user', attributes: ['name'] }], order: [['createdAt', 'DESC']], offset: (Number(page) - 1) * Number(pageSize), limit: Number(pageSize) }),
      AuditLog.count({ where }),
      AuditLog.findAll({ where, attributes: ['action', [fn('COUNT', col('id')), 'cnt']], group: ['action'], raw: true }),
    ]);
    const byAction = byActionRaw.map((r) => ({ action: r.action, _count: { _all: Number(r.cnt) } }));
    res.json({ rows, total, byAction });
  } catch (e) { next(e); }
});

export default r;

