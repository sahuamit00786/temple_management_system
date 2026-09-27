import { Router } from 'express';
import crypto from 'crypto';
import { Op, fn, col } from 'sequelize';
import { Transaction, TransactionItem, User, Role } from '../db.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { can } from '../middleware/can.js';
import { audit } from '../middleware/audit.js';
import { nextReceiptNo } from '../utils/receiptNo.js';

const r = Router();
r.use(requireAuth);

export async function createTransaction(req, body) {
  const { clientUuid, kind, devoteeId, devoteeName, starNatchathiram, items, paymentMode, localChitNo, deviceId, bookingId, txDate } = body;
  const uuid = clientUuid || crypto.randomUUID();
  const existing = await Transaction.findOne({ where: { clientUuid: uuid }, include: [{ model: TransactionItem, as: 'items' }] });
  if (existing) return { tx: existing, duplicate: true };

  const total = items.reduce((s, i) => s + Number(i.priceSnapshot) * (i.qty || 1), 0);
  // Reuse the number already printed on the POS chit so the receipt in hand matches the stored order.
  // Only mint a fresh one if it's missing or collides with an existing receipt.
  let receiptNo = localChitNo;
  if (!receiptNo || await Transaction.findOne({ where: { receiptNo } })) {
    receiptNo = await nextReceiptNo();
  }
  const tx = await Transaction.create({
    clientUuid: uuid,
    receiptNo,
    localChitNo, kind,
    devoteeId: devoteeId || null, devoteeName, starNatchathiram,
    total, paymentMode, deviceId, bookingId: bookingId || null,
    createdById: req.user.id,
    txDate: txDate ? new Date(txDate) : new Date(),
    syncedAt: new Date(),
    items: items.map((i) => ({
      lookupValueId: i.lookupValueId,
      nameSnapshot: i.nameSnapshot,
      nameTa: i.nameTa || null,
      priceSnapshot: i.priceSnapshot,
      qty: i.qty || 1,
      lineTotal: Number(i.priceSnapshot) * (i.qty || 1),
    })),
  }, { include: [{ model: TransactionItem, as: 'items' }] });
  return { tx, duplicate: false };
}

r.post('/', can('pos', 'create'), async (req, res, next) => {
  try {
    const { tx } = await createTransaction(req, req.body);
    await audit(req, 'CREATE', 'Transaction', tx.id, null, { receiptNo: tx.receiptNo, total: tx.total });
    res.status(201).json(tx);
  } catch (e) { next(e); }
});

const TX_SORT = { receiptNo: 'receiptNo', txDate: 'txDate', total: 'total', devoteeName: 'devoteeName', paymentMode: 'paymentMode', kind: 'kind' };
const ORDER_KINDS = ['ARCHANAI', 'DONATION', 'ANNADHANAM'];

r.get('/', can('pos', 'view'), async (req, res, next) => {
  try {
    const { dateFrom, dateTo, kind, type, paymentMode, status, staffId, search, page = 1, pageSize = 25, sortBy = 'txDate', sortOrder = 'desc' } = req.query;
    const where = {
      ...(kind
        ? { kind }
        : type === 'order'
          ? { kind: { [Op.in]: ORDER_KINDS } }
          : type === 'booking'
            ? { kind: 'HALL_PAYMENT' }
            : { kind: { [Op.ne]: 'HALL_PAYMENT' } }),
      ...(paymentMode && { paymentMode }),
      ...(status && { status }),
      ...(staffId && { createdById: Number(staffId) }),
      ...(search && { [Op.or]: [{ receiptNo: { [Op.like]: `%${search}%` } }, { devoteeName: { [Op.like]: `%${search}%` } }] }),
      ...(dateFrom || dateTo ? { txDate: { ...(dateFrom && { [Op.gte]: new Date(dateFrom + 'T00:00:00') }), ...(dateTo && { [Op.lte]: new Date(dateTo + 'T23:59:59.999') }) } } : {}),
    };
    const sortField = TX_SORT[sortBy] ?? 'txDate';
    const [rows, total, sumRow] = await Promise.all([
      Transaction.findAll({
        where,
        include: [{ model: TransactionItem, as: 'items' }, { model: User, as: 'createdBy', attributes: ['name'], include: [{ model: Role, as: 'role', attributes: ['name'] }] }],
        order: [[sortField, sortOrder === 'asc' ? 'ASC' : 'DESC']],
        offset: (Number(page) - 1) * Number(pageSize),
        limit: Number(pageSize),
      }),
      Transaction.count({ where }),
      Transaction.findOne({
        where: { ...where, status: 'PAID' },
        attributes: [[fn('SUM', col('total')), 'sum']],
        raw: true,
      }),
    ]);
    res.json({ rows, total, sumTotal: sumRow?.sum || 0 });
  } catch (e) { next(e); }
});

r.put('/:id', can('pos', 'edit'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { paymentMode, devoteeName, devoteeId } = req.body;
    const before = await Transaction.findByPk(id);
    if (!before) return res.status(404).json({ error: 'Not found' });
    if (before.status === 'CANCELLED') return res.status(400).json({ error: 'Cannot edit a cancelled transaction' });
    const data = {};
    if (paymentMode) data.paymentMode = paymentMode;
    if (devoteeName !== undefined) data.devoteeName = devoteeName;
    if (devoteeId !== undefined) data.devoteeId = devoteeId || null;
    await Transaction.update(data, { where: { id } });
    const tx = await Transaction.findByPk(id, {
      include: [{ model: TransactionItem, as: 'items' }, { model: User, as: 'createdBy', attributes: ['name'], include: [{ model: Role, as: 'role', attributes: ['name'] }] }],
    });
    await audit(req, 'UPDATE', 'Transaction', id, before.toJSON(), { paymentMode, devoteeName });
    res.json(tx);
  } catch (e) { next(e); }
});

r.delete('/:id', can('pos', 'delete'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const before = await Transaction.findByPk(id);
    if (!before) return res.status(404).json({ error: 'Not found' });
    await Transaction.destroy({ where: { id } });
    await audit(req, 'DELETE', 'Transaction', id, before.toJSON(), null);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;

