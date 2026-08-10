import { Setting, Transaction, HallBooking } from '../db.js';

async function getSetting(key, fallback) {
  const row = await Setting.findByPk(key);
  return row?.value != null ? String(row.value) : fallback;
}

async function randomUnique(prefix, digits, checkFn) {
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  for (let i = 0; i < 20; i++) {
    const num = Math.floor(Math.random() * (max - min + 1)) + min;
    const candidate = `${prefix}-${num}`;
    if (!(await checkFn(candidate))) return candidate;
  }
  throw new Error('Could not generate a unique number â€” try again');
}

export async function nextReceiptNo() {
  const prefix = await getSetting('numbering.receiptPrefix', 'ORD');
  const digits = Number(await getSetting('numbering.receiptDigits', '6'));
  return randomUnique(prefix, digits, async (v) =>
    !!(await Transaction.findOne({ where: { receiptNo: v } }))
  );
}

export async function nextBookingNo() {
  const prefix = await getSetting('numbering.bookingPrefix', 'HB');
  const digits = Number(await getSetting('numbering.bookingDigits', '6'));
  return randomUnique(prefix, digits, async (v) =>
    !!(await HallBooking.findOne({ where: { bookingNo: v } }))
  );
}

