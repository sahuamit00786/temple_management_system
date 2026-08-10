import cron from 'node-cron';
import { Reminder, HallBooking, Devotee } from './db.js';
import { Op } from 'sequelize';

export function startReminderJob() {
  cron.schedule('0 9 * * *', async () => {
    const due = await Reminder.findAll({
      where: { status: 'SCHEDULED', scheduledAt: { [Op.lte]: new Date() } },
      include: [{ model: HallBooking, as: 'booking', include: [{ model: Devotee, as: 'devotee' }] }],
    });
    for (const rem of due) {
      console.log(`[reminder] Balance due for booking ${rem.booking.bookingNo} - ${rem.booking.devotee.name} (${rem.booking.devotee.phone})`);
      await Reminder.update({ status: 'SENT', sentAt: new Date() }, { where: { id: rem.id } });
    }
  });
}
