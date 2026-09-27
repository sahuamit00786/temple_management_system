import { Router } from 'express';
import { Op, fn, col } from 'sequelize';
import { Transaction, HallBooking, Devotee } from '../db.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const r = Router();
r.use(requireAuth);

r.get('/summary', async (req, res, next) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const week = new Date(today); week.setDate(week.getDate() + 7);
    const sevenAgo = new Date(today); sevenAgo.setDate(sevenAgo.getDate() - 6);
    const in30 = new Date(today); in30.setDate(today.getDate() + 30);

    const [todayTx, upcoming, hallBookingsToday, totalMembers, pendingBalance, last7raw, recentBookings, membershipExpiry] = await Promise.all([
      Transaction.findAll({ where: { txDate: { [Op.gte]: today, [Op.lt]: tomorrow }, status: 'PAID' }, attributes: ['kind', 'total'] }),
      HallBooking.count({ where: { eventDate: { [Op.gte]: today, [Op.lt]: week }, status: { [Op.ne]: 'CANCELLED' } } }),
      HallBooking.count({ where: { eventDate: { [Op.gte]: today, [Op.lt]: tomorrow }, status: { [Op.ne]: 'CANCELLED' } } }),
      Devotee.count({ where: { isActive: true } }),
      HallBooking.findAll({ where: { status: { [Op.in]: ['CONFIRMED', 'BALANCE_DUE'] }, balancePaidAt: null }, attributes: ['hallRate', 'depositDue', 'balanceDueAt'] }),
      Transaction.findAll({
        where: { txDate: { [Op.gte]: sevenAgo }, status: 'PAID' },
        attributes: [[fn('DATE', col('txDate')), 'day'], [fn('SUM', col('total')), 'sum']],
        group: [fn('DATE', col('txDate'))],
        raw: true,
      }),
      HallBooking.findAll({
        where: { eventDate: { [Op.gte]: today }, status: { [Op.ne]: 'CANCELLED' } },
        include: [
          { model: Devotee, as: 'devotee' },
          { model: Transaction, as: 'transactions', where: { status: 'PAID' }, required: false, attributes: ['total'] },
        ],
        order: [['eventDate', 'ASC']],
        limit: 8,
        subQuery: false,
      }),
      Devotee.findAll({
        where: { memberType: 'MEMBER', membershipEndDate: { [Op.gte]: today, [Op.lte]: in30 } },
        attributes: ['id', 'name', 'phone', 'memberType', 'membershipTypeLabel', 'membershipEndDate', 'membershipStartDate', 'membershipPrice', 'membershipPaidVia'],
        order: [['membershipEndDate', 'ASC']],
      }),
    ]);

    const sum = (arr) => arr.reduce((s, t) => s + Number(t.total), 0);
    const byKind = (k) => todayTx.filter((t) => t.kind === k);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenAgo); d.setDate(d.getDate() + i);
      const dayStr = d.toISOString().slice(0, 10);
      const dayTotal = last7raw.filter((g) => g.day === dayStr).reduce((s, g) => s + Number(g.sum || 0), 0);
      days.push({ date: dayStr, total: dayTotal });
    }
    const now = new Date();
    const recentBookingsMapped = recentBookings.map((b) => {
      const j = b.toJSON();
      const totalPaid = (j.transactions || []).reduce((s, t) => s + Number(t.total), 0);
      delete j.transactions;
      return { ...j, totalPaid };
    });
    res.json({
      cards: {
        totalToday: sum(todayTx),
        archanaiCount: byKind('ARCHANAI').length,
        donationsToday: sum(byKind('DONATION')),
        ordersToday: todayTx.filter((t) => t.kind !== 'HALL_PAYMENT').length,
        hallBookingsToday,
        totalMembers,
        upcomingBookings: upcoming,
        pendingBalance: pendingBalance.reduce((s, b) => s + (Number(b.hallRate) - Number(b.depositDue)), 0),
        overdueBalances: pendingBalance.filter((b) => new Date(b.balanceDueAt) < now).length,
      },
      last7Days: days,
      recentBookings: recentBookingsMapped,
      membershipExpiry: membershipExpiry.map((d) => d.toJSON()),
    });
  } catch (e) { next(e); }
});

export default r;

