import { ldb } from './dexie.js';
import { api } from '../api/client.js';
import API_HOST from '../config.js';

const listeners = new Set();
export function onSyncChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

let serverReachable = true;

async function notify() {
  const txPending = await ldb.outbox.where('status').equals('pending').count();
  let devPending = 0, userPending = 0, bkgPending = 0, payPending = 0;
  try { devPending = await ldb.devoteeOutbox.where('status').equals('pending').count(); } catch {}
  try { userPending = await ldb.userOutbox.where('status').equals('pending').count(); } catch {}
  try { bkgPending = await ldb.bookingOutbox.where('status').equals('pending').count(); } catch {}
  try { payPending = await ldb.paymentOutbox.where('status').equals('pending').count(); } catch {}
  listeners.forEach((fn) => fn({ online: serverReachable, pending: txPending + devPending + userPending + bkgPending + payPending }));
}

async function flushDevoteeOutbox() {
  let pending = [];
  try { pending = await ldb.devoteeOutbox.where('status').equals('pending').toArray(); } catch { return; }
  for (const item of pending) {
    try {
      const created = await api('/devotees', { method: 'POST', body: item.data });
      await ldb.devotees.delete(item.tempId);
      await ldb.devotees.put(created);
      await ldb.devoteeOutbox.delete(item.id);
    } catch (e) {
      await ldb.devoteeOutbox.update(item.id, { status: 'error', error: e.message });
    }
  }
}

async function flushUserOutbox() {
  let pending = [];
  try { pending = await ldb.userOutbox.where('status').equals('pending').toArray(); } catch { return; }
  for (const item of pending) {
    try {
      await api('/users', { method: 'POST', body: item.data });
      await ldb.userOutbox.delete(item.id);
    } catch (e) {
      await ldb.userOutbox.update(item.id, { status: 'error', error: e.message });
    }
  }
}

async function flushBookingOutbox() {
  let pending = [];
  try { pending = await ldb.bookingOutbox.where('status').equals('pending').toArray(); } catch { return; }
  for (const item of pending) {
    try {
      const created = await api('/bookings', { method: 'POST', body: item.data });
      await ldb.cachedBookings.put(created);
      await ldb.bookingOutbox.delete(item.id);
    } catch (e) {
      await ldb.bookingOutbox.update(item.id, { status: 'error', error: e.message });
    }
  }
}

async function flushPaymentOutbox() {
  let pending = [];
  try { pending = await ldb.paymentOutbox.where('status').equals('pending').toArray(); } catch { return; }
  for (const item of pending) {
    try {
      await api(`/bookings/${item.bookingId}/payments`, { method: 'POST', body: item.data });
      await ldb.paymentOutbox.delete(item.id);
    } catch (e) {
      await ldb.paymentOutbox.update(item.id, { status: 'error', error: e.message });
    }
  }
}

export async function queueTransaction(tx) {
  await ldb.outbox.put({ ...tx, status: 'pending', createdAtLocal: Date.now() });
  await ldb.localTx.put({ ...tx, status: 'PAID' });
  notify();
  flush();
}

let flushing = false;
export async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    // Fast-fail if browser itself reports no network
    if (!navigator.onLine) throw new Error('offline');

    await fetch(`${API_HOST}/api/v1/health`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    serverReachable = true;

    const pending = await ldb.outbox.where('status').equals('pending').toArray();
    if (pending.length) {
      const { results } = await api('/sync/transactions', { method: 'POST', body: { transactions: pending } });
      for (const r of results) {
        if (r.ok) {
          await ldb.outbox.delete(r.clientUuid);
          await ldb.localTx.update(r.clientUuid, { receiptNo: r.receiptNo, synced: true });
        } else {
          await ldb.outbox.update(r.clientUuid, { status: 'error', error: r.error });
        }
      }
    }
    await flushDevoteeOutbox();
    await flushUserOutbox();
    await flushBookingOutbox();
    await flushPaymentOutbox();
  } catch {
    serverReachable = false;
  } finally {
    flushing = false;
    notify();
  }
}

export function startSyncEngine() {
  window.addEventListener('online', () => { serverReachable = false; flush(); });
  window.addEventListener('offline', () => { serverReachable = false; notify(); });
  setInterval(flush, 10_000);
  flush();
}
