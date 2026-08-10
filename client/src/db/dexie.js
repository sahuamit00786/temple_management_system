import Dexie from 'dexie';

export const ldb = new Dexie('tmadj');

ldb.version(1).stores({
  lookups: 'code',
  settings: 'key',
  outbox: 'clientUuid, status, createdAtLocal',
  localTx: 'clientUuid, txDate',
});

ldb.version(2).stores({
  lookups: 'code',
  settings: 'key',
  outbox: 'clientUuid, status, createdAtLocal',
  localTx: 'clientUuid, txDate',
  devotees: 'id, name, phone, icNumber',
  cachedBookings: 'id, eventDate, status',
});

ldb.version(3).stores({
  lookups: 'code',
  settings: 'key',
  outbox: 'clientUuid, status, createdAtLocal',
  localTx: 'clientUuid, txDate',
  devotees: 'id, name, phone, icNumber',
  cachedBookings: 'id, eventDate, status',
  devoteeOutbox: '++id, status, createdAt',
});

ldb.version(4).stores({
  lookups: 'code',
  settings: 'key',
  outbox: 'clientUuid, status, createdAtLocal',
  localTx: 'clientUuid, txDate',
  devotees: 'id, name, phone, icNumber',
  cachedBookings: 'id, eventDate, status',
  devoteeOutbox: '++id, status, createdAt',
  userOutbox: '++id, status, createdAt',
});

ldb.version(5).stores({
  lookups: 'code',
  settings: 'key',
  outbox: 'clientUuid, status, createdAtLocal',
  localTx: 'clientUuid, txDate',
  devotees: 'id, name, phone, icNumber',
  cachedBookings: 'id, eventDate, status',
  devoteeOutbox: '++id, status, createdAt',
  userOutbox: '++id, status, createdAt',
  bookingOutbox: '++id, status, createdAt',
  paymentOutbox: '++id, bookingId, status, createdAt',
});

/* ── Lookups ── */
export async function mirrorLookups(data) {
  await ldb.lookups.clear();
  await ldb.lookups.bulkPut(Object.entries(data).map(([code, v]) => ({ code, ...v })));
}
export async function readLookups() {
  const rows = await ldb.lookups.toArray();
  return Object.fromEntries(rows.map((r) => [r.code, { name: r.name, values: r.values }]));
}

/* ── Settings ── */
export async function mirrorSettings(obj) {
  await ldb.settings.bulkPut(Object.entries(obj).map(([key, value]) => ({ key, value })));
}
export async function readSettings() {
  const rows = await ldb.settings.toArray();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/* ── Devotees ── */
export async function mirrorDevotees(rows) {
  if (!rows?.length) return;
  await ldb.devotees.bulkPut(rows);
}
export async function readDevotees(query = '', limit = 10) {
  const q = query.trim().toLowerCase();
  if (!q) return ldb.devotees.orderBy('name').limit(limit).toArray();
  return ldb.devotees
    .filter((d) =>
      d.name?.toLowerCase().includes(q) ||
      d.phone?.includes(q) ||
      d.icNumber?.toLowerCase().includes(q)
    )
    .limit(limit)
    .toArray();
}

/* ── Bookings ── */
export async function mirrorBookings(rows) {
  if (!rows?.length) return;
  await ldb.cachedBookings.bulkPut(rows);
}
export async function readBookings(limit = 10, offset = 0) {
  const all = await ldb.cachedBookings.orderBy('eventDate').reverse().toArray();
  return { rows: all.slice(offset, offset + limit), total: all.length };
}
