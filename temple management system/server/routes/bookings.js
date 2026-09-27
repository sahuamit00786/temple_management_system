import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Op, fn, col } from 'sequelize';
import { sequelize, HallBooking, Devotee, Transaction, TransactionItem, BookingNote, BookingCancelNote, Reminder, LookupValue, Setting, User } from '../db.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { can } from '../middleware/can.js';
import { audit } from '../middleware/audit.js';
import { nextBookingNo } from '../utils/receiptNo.js';
import { createTransaction } from './transactions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cancelLogFile = path.join(__dirname, '..', 'server.log');
function cancelLog(msg) {
  const line = `[${new Date().toISOString()}] [CANCEL-ROUTE] ${msg}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(cancelLogFile, line); } catch {}
}

const r = Router();
r.use(requireAuth);

async function applyPayment(req, booking, amt, paymentMode = 'CASH') {
  await createTransaction(req, {
    kind: 'HALL_PAYMENT',
    devoteeId: booking.devoteeId,
    devoteeName: booking.devotee.name,
    paymentMode,
    bookingId: booking.id,
    items: [{ lookupValueId: booking.eventTypeId, nameSnapshot: `Hall payment - ${booking.bookingNo}`, priceSnapshot: amt, qty: 1 }],
  });
  const agg = await Transaction.findOne({
    where: { bookingId: booking.id, status: 'PAID' },
    attributes: [[fn('SUM', col('total')), 'total']],
    raw: true,
  });
  const newTotal = Number(agg?.total || 0);
  const update = {};
  if (!booking.depositPaidAt && newTotal >= Number(booking.depositDue)) { update.depositPaidAt = new Date(); update.status = 'CONFIRMED'; }
  if (newTotal >= Number(booking.hallRate)) { update.balancePaidAt = new Date(); update.status = 'FULLY_PAID'; }
  if (Object.keys(update).length) await HallBooking.update(update, { where: { id: booking.id } });
}

// Recomputes status/depositPaidAt/balancePaidAt from scratch against current PAID transactions —
// used after editing or cancelling a payment, since totals can move up or down (unlike applyPayment, which only ever advances).
async function recomputeBookingStatus(booking) {
  if (booking.status === 'CANCELLED') return;
  const agg = await Transaction.findOne({
    where: { bookingId: booking.id, status: 'PAID' },
    attributes: [[fn('SUM', col('total')), 'total']],
    raw: true,
  });
  const newTotal = Number(agg?.total || 0);
  const hallRate = Number(booking.hallRate);
  const depositDue = Number(booking.depositDue);
  let status = 'PENDING_DEPOSIT';
  let depositPaidAt = null;
  let balancePaidAt = null;
  if (hallRate > 0 && newTotal >= hallRate) {
    status = 'FULLY_PAID';
    depositPaidAt = booking.depositPaidAt || new Date();
    balancePaidAt = booking.balancePaidAt || new Date();
  } else if (depositDue > 0 && newTotal >= depositDue) {
    status = 'CONFIRMED';
    depositPaidAt = booking.depositPaidAt || new Date();
  }
  await HallBooking.update({ status, depositPaidAt, balancePaidAt }, { where: { id: booking.id } });
}

r.get('/check-conflict', can('bookings', 'view'), async (req, res, next) => {
  try {
    const { startTime, endTime, excludeId } = req.query;
    if (!startTime || !endTime) return res.json({ conflict: null });
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) return res.json({ conflict: null });
    const clash = await HallBooking.findOne({
      where: {
        status: { [Op.ne]: 'CANCELLED' },
        ...(excludeId && { id: { [Op.ne]: Number(excludeId) } }),
        startTime: { [Op.lt]: end },
        endTime: { [Op.gt]: start },
      },
      include: [{ model: Devotee, as: 'devotee', attributes: ['name'] }],
    });
    res.json({ conflict: clash || null });
  } catch (e) { next(e); }
});

r.get('/calendar', can('bookings', 'view'), async (req, res, next) => {
  try {
    const { month } = req.query;
    const start = new Date(`${month}-01T00:00:00`);
    const end = new Date(start); end.setMonth(end.getMonth() + 1);
    const rows = await HallBooking.findAll({
      where: { eventDate: { [Op.gte]: start, [Op.lt]: end }, status: { [Op.ne]: 'CANCELLED' } },
      include: [{ model: Devotee, as: 'devotee' }],
      order: [['eventDate', 'ASC']],
    });
    res.json(rows);
  } catch (e) { next(e); }
});

const BOOKING_SORT = { bookingNo: 'bookingNo', eventDate: 'eventDate', hallRate: 'hallRate', status: 'status', createdAt: 'createdAt' };

r.get('/', can('bookings', 'view'), async (req, res, next) => {
  try {
    const { status, eventTypeId, devoteeId, dateFrom, dateTo, search, page = 1, pageSize = 25, sortBy = 'eventDate', sortOrder = 'asc' } = req.query;
    const where = {
      ...(status && { status }),
      ...(eventTypeId && { eventTypeId: Number(eventTypeId) }),
      ...(devoteeId && { devoteeId: Number(devoteeId) }),
      ...(dateFrom || dateTo ? { eventDate: { ...(dateFrom && { [Op.gte]: new Date(dateFrom + 'T00:00:00') }), ...(dateTo && { [Op.lte]: new Date(dateTo + 'T23:59:59.999') }) } } : {}),
    };
    if (search) {
      const matchedDevotees = await Devotee.findAll({
        where: { [Op.or]: [{ name: { [Op.like]: `%${search}%` } }, { phone: { [Op.like]: `%${search}%` } }] },
        attributes: ['id'],
      });
      const dIds = matchedDevotees.map((d) => d.id);
      where[Op.or] = [
        { bookingNo: { [Op.like]: `%${search}%` } },
        ...(dIds.length ? [{ devoteeId: { [Op.in]: dIds } }] : []),
      ];
    }
    const sortField = BOOKING_SORT[sortBy] ?? 'eventDate';
    const [rows, total] = await Promise.all([
      HallBooking.findAll({
        where,
        include: [
          { model: Devotee, as: 'devotee' },
          { model: Transaction, as: 'transactions', where: { status: 'PAID' }, required: false, attributes: ['total'] },
        ],
        order: [[sortField, sortOrder === 'asc' ? 'ASC' : 'DESC']],
        offset: (Number(page) - 1) * Number(pageSize),
        limit: Number(pageSize),
        subQuery: false,
      }),
      HallBooking.count({ where }),
    ]);
    const mapped = rows.map((b) => {
      const j = b.toJSON();
      const totalPaid = (j.transactions || []).reduce((s, t) => s + Number(t.total), 0);
      delete j.transactions;
      return { ...j, totalPaid };
    });
    res.json({ rows: mapped, total });
  } catch (e) { next(e); }
});

r.post('/', can('bookings', 'create'), async (req, res, next) => {
  try {
    const { clientUuid, devotee, devoteeId, eventTypeId, eventDate, startTime, endTime, notes, advanceAmount, paymentMode: advPayMode } = req.body;
    const eventType = await LookupValue.findByPk(Number(eventTypeId));
    if (!eventType) return res.status(400).json({ error: 'Choose an event type' });

    const clash = await HallBooking.findOne({
      where: { status: { [Op.ne]: 'CANCELLED' }, startTime: { [Op.lt]: new Date(endTime) }, endTime: { [Op.gt]: new Date(startTime) } },
    });
    if (clash) return res.status(409).json({ error: `Hall is already booked for this time (${clash.bookingNo})` });

    let dId = devoteeId;
    if (!dId) {
      if (devotee?.phone?.trim()) {
        const dup = await Devotee.findOne({ where: { phone: devotee.phone.trim() } });
        if (dup) return res.status(409).json({ error: `Phone number already registered to ${dup.name} â€” search and select them instead` });
      }
      const d = await Devotee.create({ ...devotee, createdAt: new Date() });
      dId = d.id;
    }
    const rate = Number(eventType.price || 0);
    const depositPct = eventType.depositPct ?? 50;
    const leadSetting = await Setting.findByPk('reminder.leadDays');
    const leadDays = Number(leadSetting?.value ?? 7);
    const balanceDueAt = new Date(eventDate); balanceDueAt.setDate(balanceDueAt.getDate() - 7);
    const remindAt = new Date(balanceDueAt); remindAt.setDate(remindAt.getDate() - (leadDays - 7 > 0 ? leadDays - 7 : 0));

    const booking = await HallBooking.create({
      clientUuid: clientUuid || crypto.randomUUID(),
      bookingNo: await nextBookingNo(),
      devoteeId: dId, eventTypeId: Number(eventTypeId),
      eventDate: new Date(eventDate), startTime: new Date(startTime), endTime: new Date(endTime),
      hallRate: rate, depositDue: (rate * depositPct) / 100,
      balanceDueAt, notes,
      createdAt: new Date(),
      reminders: [{ scheduledAt: remindAt }],
    }, { include: [{ model: Reminder, as: 'reminders' }] });

    const bookingWithDevotee = await HallBooking.findByPk(booking.id, { include: [{ model: Devotee, as: 'devotee' }] });
    await audit(req, 'CREATE', 'HallBooking', booking.id, null, { bookingNo: booking.bookingNo });

    if (Number(advanceAmount) > 0) {
      await applyPayment(req, bookingWithDevotee, Math.min(Number(advanceAmount), rate), advPayMode || 'CASH');
    }
    res.status(201).json(bookingWithDevotee);
  } catch (e) { next(e); }
});

r.post('/:id/payments', can('bookings', 'edit'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { amount, paymentMode } = req.body;
    const booking = await HallBooking.findByPk(id, { include: [{ model: Devotee, as: 'devotee' }] });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status === 'CANCELLED') return res.status(400).json({ error: 'Booking is cancelled' });

    const agg = await Transaction.findOne({
      where: { bookingId: id, status: 'PAID' },
      attributes: [[fn('SUM', col('total')), 'total']],
      raw: true,
    });
    const alreadyPaid = Number(agg?.total || 0);
    const remaining = Number(booking.hallRate) - alreadyPaid;
    if (remaining <= 0) return res.status(400).json({ error: 'Booking is already fully paid' });

    const amt = Number(amount) > 0 ? Math.min(Number(amount), remaining) : remaining;
    if (amt <= 0) return res.status(400).json({ error: 'Invalid amount' });

    await applyPayment(req, booking, amt, paymentMode || 'CASH');
    const updated = await HallBooking.findByPk(id, { include: [{ model: Devotee, as: 'devotee' }] });
    res.json({ booking: updated });
  } catch (e) { next(e); }
});

r.put('/:id/payments/:txId', can('bookings', 'edit'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const txId = Number(req.params.txId);
    const { amount, paymentMode } = req.body;
    const booking = await HallBooking.findByPk(id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    const tx = await Transaction.findOne({ where: { id: txId, bookingId: id } });
    if (!tx) return res.status(404).json({ error: 'Payment not found' });
    if (tx.status === 'CANCELLED') return res.status(400).json({ error: 'Cannot edit a cancelled payment' });

    const newAmt = Number(amount);
    if (!(newAmt > 0)) return res.status(400).json({ error: 'Invalid amount' });

    const othersAgg = await Transaction.findOne({
      where: { bookingId: id, status: 'PAID', id: { [Op.ne]: txId } },
      attributes: [[fn('SUM', col('total')), 'total']],
      raw: true,
    });
    const otherTotal = Number(othersAgg?.total || 0);
    if (otherTotal + newAmt > Number(booking.hallRate)) {
      return res.status(400).json({ error: `Cannot exceed hall rate of RM ${Number(booking.hallRate).toFixed(2)}` });
    }

    const before = tx.toJSON();
    await Transaction.update({ total: newAmt, ...(paymentMode && { paymentMode }) }, { where: { id: txId } });
    await TransactionItem.update({ priceSnapshot: newAmt, lineTotal: newAmt }, { where: { transactionId: txId } });
    await recomputeBookingStatus(booking);
    await audit(req, 'UPDATE', 'Transaction', txId, before, { total: newAmt, paymentMode });

    const updated = await HallBooking.findByPk(id, {
      include: [{ model: Devotee, as: 'devotee' }, { model: Transaction, as: 'transactions', required: false, include: [{ model: TransactionItem, as: 'items' }], order: [['txDate', 'ASC']] }],
    });
    res.json(updated);
  } catch (e) { next(e); }
});

r.delete('/:id/payments/:txId', can('bookings', 'edit'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const txId = Number(req.params.txId);
    const booking = await HallBooking.findByPk(id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    const tx = await Transaction.findOne({ where: { id: txId, bookingId: id } });
    if (!tx) return res.status(404).json({ error: 'Payment not found' });
    if (tx.status === 'CANCELLED') return res.status(400).json({ error: 'Payment is already cancelled' });

    const before = tx.toJSON();
    await Transaction.update({ status: 'CANCELLED' }, { where: { id: txId } });
    await recomputeBookingStatus(booking);
    await audit(req, 'CANCEL', 'Transaction', txId, before, { status: 'CANCELLED' });

    const updated = await HallBooking.findByPk(id, {
      include: [{ model: Devotee, as: 'devotee' }, { model: Transaction, as: 'transactions', required: false, include: [{ model: TransactionItem, as: 'items' }], order: [['txDate', 'ASC']] }],
    });
    res.json(updated);
  } catch (e) { next(e); }
});

r.put('/:id', can('bookings', 'edit'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { devotee, devoteeId, eventTypeId, eventDate, startTime, endTime, notes } = req.body;
    const existing = await HallBooking.findByPk(id, { include: [{ model: Devotee, as: 'devotee' }] });
    if (!existing) return res.status(404).json({ error: 'Booking not found' });
    if (existing.status === 'CANCELLED') return res.status(400).json({ error: 'Cannot edit a cancelled booking' });
    if (new Date(existing.startTime) <= new Date()) return res.status(400).json({ error: 'Cannot edit a booking that has already started' });

    const eventType = await LookupValue.findByPk(Number(eventTypeId));
    if (!eventType) return res.status(400).json({ error: 'Choose an event type' });

    const clash = await HallBooking.findOne({
      where: {
        status: { [Op.ne]: 'CANCELLED' },
        id: { [Op.ne]: id },
        startTime: { [Op.lt]: new Date(endTime) },
        endTime: { [Op.gt]: new Date(startTime) },
      },
    });
    if (clash) return res.status(409).json({ error: `Hall is already booked for this time (${clash.bookingNo})` });

    let dId = devoteeId;
    if (!dId) {
      if (devotee?.phone?.trim()) {
        const dup = await Devotee.findOne({ where: { phone: devotee.phone.trim(), id: { [Op.ne]: existing.devoteeId } } });
        if (dup) return res.status(409).json({ error: `Phone number already registered to ${dup.name} — search and select them instead` });
      }
      await Devotee.update({ ...devotee }, { where: { id: existing.devoteeId } });
      dId = existing.devoteeId;
    }

    const rate = Number(eventType.price || 0);
    const depositPct = eventType.depositPct ?? 50;
    const balanceDueAt = new Date(eventDate); balanceDueAt.setDate(balanceDueAt.getDate() - 7);

    const before = existing.toJSON();
    await HallBooking.update({
      devoteeId: dId, eventTypeId: Number(eventTypeId),
      eventDate: new Date(eventDate), startTime: new Date(startTime), endTime: new Date(endTime),
      hallRate: rate, depositDue: (rate * depositPct) / 100,
      balanceDueAt, notes,
    }, { where: { id } });

    const updated = await HallBooking.findByPk(id, { include: [{ model: Devotee, as: 'devotee' }] });
    await audit(req, 'UPDATE', 'HallBooking', id, before, updated.toJSON());
    res.json(updated);
  } catch (e) { next(e); }
});

r.get('/:id', can('bookings', 'view'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const booking = await HallBooking.findByPk(id, {
      include: [
        { model: Devotee, as: 'devotee' },
        { model: Transaction, as: 'transactions', required: false, include: [{ model: TransactionItem, as: 'items' }], order: [['txDate', 'ASC']] },
        { model: BookingNote, as: 'bookingNotes', include: [{ model: User, as: 'createdBy', attributes: ['name'] }], order: [['createdAt', 'DESC']] },
        { model: BookingCancelNote, as: 'cancelNote', include: [{ model: User, as: 'cancelledBy', attributes: ['name'] }] },
      ],
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json(booking);
  } catch (e) { next(e); }
});

r.patch('/:id/notes', can('bookings', 'edit'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await HallBooking.update({ notes: req.body.notes ?? null }, { where: { id } });
    res.json(await HallBooking.findByPk(id));
  } catch (e) { next(e); }
});

r.post('/:id/booking-notes', can('bookings', 'edit'), async (req, res, next) => {
  try {
    const bookingId = Number(req.params.id);
    const { note } = req.body;
    if (!note?.trim()) return res.status(400).json({ error: 'Note cannot be empty' });
    const created = await BookingNote.create({ bookingId, note: note.trim(), createdById: req.user.id, createdAt: new Date(), updatedAt: new Date() });
    const full = await BookingNote.findByPk(created.id, { include: [{ model: User, as: 'createdBy', attributes: ['name'] }] });
    res.status(201).json(full);
  } catch (e) { next(e); }
});

r.put('/:id/booking-notes/:noteId', can('bookings', 'edit'), async (req, res, next) => {
  try {
    const id = Number(req.params.noteId);
    const { note } = req.body;
    if (!note?.trim()) return res.status(400).json({ error: 'Note cannot be empty' });
    await BookingNote.update({ note: note.trim(), updatedAt: new Date() }, { where: { id } });
    const updated = await BookingNote.findByPk(id, { include: [{ model: User, as: 'createdBy', attributes: ['name'] }] });
    res.json(updated);
  } catch (e) { next(e); }
});

r.delete('/:id/booking-notes/:noteId', can('bookings', 'edit'), async (req, res, next) => {
  try {
    await BookingNote.destroy({ where: { id: Number(req.params.noteId) } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.post('/:id/cancel', (req, res, next) => {
  cancelLog(`HIT ${req.method} ${req.originalUrl} origin=${req.headers.origin || '-'} auth=${req.headers.authorization ? 'present' : 'missing'} ip=${req.ip}`);
  res.on('finish', () => cancelLog(`DONE id=${req.params.id} status=${res.statusCode}`));
  next();
}, can('bookings', 'delete'), async (req, res, next) => {
  let responded = false;
  const watchdog = setTimeout(() => {
    if (responded || res.headersSent) return;
    responded = true;
    cancelLog(`TIMEOUT booking id=${req.params.id} - handler still running after 8s, likely DB lock/pool stall`);
    res.status(504).json({ error: 'Cancel request timed out — please check the booking status and retry' });
  }, 8000);

  try {
    const id = Number(req.params.id);
    const note = (req.body?.note || '').trim();
    cancelLog(`processing booking id=${id} user=${req.user?.id}`);

    if (!note) {
      clearTimeout(watchdog);
      if (responded) return;
      responded = true;
      return res.status(400).json({ error: 'Cancellation note is required' });
    }
    const existing = await HallBooking.findByPk(id);
    if (!existing) {
      clearTimeout(watchdog);
      if (responded) return;
      responded = true;
      return res.status(404).json({ error: 'Booking not found' });
    }
    if (existing.status === 'CANCELLED') {
      clearTimeout(watchdog);
      if (responded) return;
      responded = true;
      return res.status(400).json({ error: 'Booking is already cancelled' });
    }

    const before = existing.toJSON();
    await sequelize.transaction(async (t) => {
      await HallBooking.update({ status: 'CANCELLED' }, { where: { id }, transaction: t });
      await Transaction.update({ status: 'CANCELLED' }, { where: { bookingId: id, status: 'PAID' }, transaction: t });
      await BookingCancelNote.create({ bookingId: id, note, cancelledById: req.user.id, createdAt: new Date() }, { transaction: t });
    });
    const booking = await HallBooking.findByPk(id);
    await audit(req, 'CANCEL', 'HallBooking', id, before, { ...booking?.toJSON(), cancelNote: note });
    clearTimeout(watchdog);
    if (responded) return;
    responded = true;
    cancelLog(`success booking id=${id}`);
    res.json(booking);
  } catch (e) {
    clearTimeout(watchdog);
    cancelLog(`ERROR booking id=${req.params.id}: ${e.stack || e.message}`);
    if (responded) return;
    responded = true;
    next(e);
  }
});

export default r;

