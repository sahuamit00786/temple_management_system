import { useState, useEffect, useRef } from 'react';
import { useApp } from '../auth/AppContext.jsx';
import { api } from '../api/client.js';

const LS_BOOKINGS = 'tmadj.dismissedBookings';
const LS_MEMBERS = 'tmadj.dismissedMembers';

const readLocal = () => ({
  bookingIds: (() => { try { return JSON.parse(localStorage.getItem(LS_BOOKINGS) || '[]'); } catch { return []; } })(),
  memberIds: (() => { try { return JSON.parse(localStorage.getItem(LS_MEMBERS) || '[]'); } catch { return []; } })(),
});

const persist = (bIds, mIds) => {
  localStorage.setItem(LS_BOOKINGS, JSON.stringify(bIds));
  localStorage.setItem(LS_MEMBERS, JSON.stringify(mIds));
};

export function useDismissals() {
  const { online } = useApp();
  const local = readLocal();
  const [bookingIds, setBookingIds] = useState(local.bookingIds);
  const [memberIds, setMemberIds] = useState(local.memberIds);
  const synced = useRef(false);

  const applyMerged = (bIds, mIds) => {
    setBookingIds(bIds);
    setMemberIds(mIds);
    persist(bIds, mIds);
  };

  useEffect(() => {
    if (!online) { synced.current = false; return; }
    if (synced.current) return;
    synced.current = true;
    (async () => {
      try {
        const server = await api('/settings/dismissals');
        const loc = readLocal();
        const merged = {
          bookingIds: [...new Set([...(server.bookingIds || []), ...loc.bookingIds])],
          memberIds: [...new Set([...(server.memberIds || []), ...loc.memberIds])],
        };
        applyMerged(merged.bookingIds, merged.memberIds);
        await api('/settings/dismissals', { method: 'POST', body: merged });
      } catch {}
    })();
  }, [online]);

  const dismissBooking = (id) => {
    const next = [...new Set([...bookingIds, id])];
    applyMerged(next, memberIds);
    if (online) api('/settings/dismissals', { method: 'POST', body: { bookingIds: next, memberIds } }).catch(() => {});
  };

  const dismissMember = (id) => {
    const next = [...new Set([...memberIds, id])];
    applyMerged(bookingIds, next);
    if (online) api('/settings/dismissals', { method: 'POST', body: { bookingIds, memberIds: next } }).catch(() => {});
  };

  return { dismissedIds: bookingIds, dismissedMemberIds: memberIds, dismissBooking, dismissMember };
}
