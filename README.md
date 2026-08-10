# 🪔 TMADJ Temple Management & POS System

Offline-first PWA for temple counter billing, donations, hall bookings, annadhanam and reporting.
**Stack:** Node.js + Express + Prisma + MySQL · React + Vite + Tailwind · Workbox PWA + Dexie (IndexedDB).

---

## Quick start

### 1. Database
```bash
# Create a MySQL 8 database named `tmadj`
mysql -u root -p -e "CREATE DATABASE tmadj CHARACTER SET utf8mb4;"
```

### 2. Server
```bash
cd server
cp .env.example .env        # set DATABASE_URL + strong JWT secrets
npm install
npx prisma migrate dev --name init
npm run db:seed             # roles, menus, permissions, lookups, demo prices
npm run dev                 # http://localhost:4000
```

### 3. Client
```bash
cd client
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000)
```

**Login:** `admin@tmadj.com` / `Admin@123` (Superadmin — change it immediately).

### Production
```bash
cd client && npm run build      # outputs dist/ with service worker
# Serve dist/ behind nginx with HTTPS (service workers require HTTPS),
# and reverse-proxy /api and /uploads to the Node server.
```

---

## What's inside

| Area | Details |
|---|---|
| **Counter POS** | Archanai / Donations / Annadhanam tabs, tap-to-add tiles, cash with change calc, DuitNow QR full-screen, 80mm chit print, reprint |
| **Offline-first** | Sales save to IndexedDB outbox and the chit prints instantly with a local chit number (`C1-0042`); when internet returns they sync automatically (idempotent — never duplicated) and receive the official receipt number |
| **Hall Booking** | Calendar + Bookings List tabs, clash detection, devotee capture (name, contact, secondary contact, address, IC), auto 50% deposit, balance due 1 week before event, auto-scheduled reminder (9 AM cron — plug your WhatsApp/SMS gateway in `server/src/jobs.js`) |
| **Lookups** | Every dropdown in the system is lookup-driven. Add / edit / delete / deactivate values in Lookups (tabs per type), including Donation main → sub-categories, with inline quick-add (+) on dropdowns for permitted users |
| **Tabs everywhere** | Every page's submenus are tabs: Reports (6 reports), Lookups (6 types), User Management (Users / Roles / Menu Permissions), Settings (Profile & Logo / Receipt / QR / Reminders), Hall Booking (Calendar / List) |
| **Reports** | Date range, category, payment mode, status, staff and text filters on every report, summary chips, CSV export, Superadmin-only audit log |
| **Roles & permissions** | Superadmin / Manager / Staff seeded; per-menu View/Create/Edit/Delete/Export matrix; UI hides what the API also enforces |
| **Settings** | Temple profile + logo upload (sidebar, login, chit), DuitNow QR upload, receipt paper width & blessing footer, reminder lead days |
| **Theme** | "Divya" devotional theme — maroon, saffron, gold, sandal cream, kolam texture, Marcellus + Inter fonts, diya motifs, Lucide icons |

## Structure
```
server/   Express API · prisma/schema.prisma · prisma/seed.js · routes per module
client/   React PWA · src/pages · src/components · src/db (Dexie outbox + sync engine)
```

## Counter device setup
On each counter machine, set a device prefix once in the browser console:
`localStorage.setItem('tmadj.deviceId', 'C1')` — offline chit numbers become `C1-0001`, `C1-0002`…

## Notes
- Cancelled sales are status-changed, never deleted; lookup values used in sales deactivate instead of deleting; item names/prices are snapshotted on every sale so history never changes.
- Schedule nightly `mysqldump` + back up `server/uploads/`.
