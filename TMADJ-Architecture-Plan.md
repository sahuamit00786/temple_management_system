# TMADJ Temple Management & POS System
## Full Architecture, Planning & Design Document

**Stack:** Node.js + Express.js (API) · React.js + Vite (Frontend) · Offline-First PWA
**Currency:** RM (Malaysia) · **Payments:** DuitNow QR / Cash
**Version:** 1.0 · Prepared June 2026

---

# 1. Vision & Scope

A beautiful, temple-themed, offline-first Point-of-Sale and management system for the temple counter. Staff select archanai/chit types, donations, annadhanam offerings, or hall bookings on a desktop/laptop; the devotee pays by DuitNow QR or cash; a thermal chit/receipt prints instantly — **even when the internet is down**, with automatic database sync when connectivity returns.

**Core modules**

1. Counter POS (archanai / chit billing)
2. Donations (main + sub-categories)
3. Hall Booking (calendar, 50% deposit, balance reminder)
4. Annadhanam / Offerings (Ponggal, Puli Soru, Kacang…)
5. Devotee registry
6. Lookups / Master Data (fully temple-customizable)
7. Reports (multi-filter, export)
8. Dashboard (cards + recent bookings table)
9. Users, Roles & Menu Permissions (Superadmin / Manager / Staff)
10. Settings (temple profile, **logo upload**, receipt config, QR config)

---

# 2. High-Level Architecture

```
┌──────────────────────────── BROWSER (PWA) ────────────────────────────┐
│  React 18 + Vite + TypeScript                                         │
│  ├─ UI Layer: Tailwind CSS + shadcn/ui (temple theme tokens)          │
│  ├─ State: TanStack Query (server cache) + Zustand (UI state)         │
│  ├─ Offline Layer:                                                    │
│  │   • Service Worker (Workbox) — app shell + asset precache          │
│  │   • IndexedDB (Dexie.js) — local mirror of lookups, devotees,      │
│  │     bookings + an OUTBOX queue of unsynced transactions            │
│  │   • Background Sync — flushes outbox when online                   │
│  ├─ Printing: browser print CSS (80mm/58mm) or QZ Tray → ESC/POS      │
│  └─ Routing: React Router v6 (permission-guarded routes)              │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ HTTPS / JSON  (JWT access + refresh)
┌───────────────────────────────▼───────────────────────────────────────┐
│  Node.js 20 + Express.js (REST API)                                   │
│  ├─ Auth: JWT + bcrypt + role/permission middleware                   │
│  ├─ Validation: Zod                                                   │
│  ├─ ORM: Prisma → MySQL 8 (or PostgreSQL — same schema)               │
│  ├─ Sync endpoint: idempotent batch ingest (client UUIDs)             │
│  ├─ Jobs: node-cron → booking balance reminders (email/WhatsApp/SMS)  │
│  ├─ Uploads: multer + sharp → /uploads (logo, QR image)               │
│  └─ Audit log middleware on every mutation                            │
└───────────────────────────────┬───────────────────────────────────────┘
                        MySQL 8 (Prisma migrations)
```

**Why relational (MySQL/Prisma)?** Reporting is a first-class requirement — date-range, category, payment-mode, staff and status filters are far cleaner with SQL aggregation than a document store. Offline writes are handled at the client (IndexedDB outbox), not by the server DB choice.

---

# 3. Offline-First PWA Strategy (the heart of the system)

### 3.1 What works fully offline
- Counter POS billing (archanai, donation, annadhanam)
- Receipt/chit printing (templates + lookups are cached)
- Devotee quick-add
- Viewing today's transactions & cached bookings

### 3.2 Mechanics
1. **App shell precache** — Workbox `precacheAndRoute` caches JS/CSS/fonts/icons/logo so the app boots with zero network.
2. **Lookup mirror** — on every login/online start, all lookup tables, price lists, receipt template, temple profile, and the QR image are pulled into Dexie tables (`lookups`, `settings`, `devotees`).
3. **Outbox pattern** — every POS sale/booking is written **first** to Dexie with a client-generated `uuid v4`, `status: 'pending'`, `createdAtLocal`. The UI confirms and prints immediately from local data.
4. **Sync engine** — a small worker:
   - listens to `online` events + Workbox Background Sync,
   - POSTs batches to `POST /api/sync/transactions`,
   - server upserts by `client_uuid` (idempotent — retries can never duplicate a sale),
   - on `201/200`, marks rows `synced` and stores the server receipt number.
5. **Receipt numbering offline** — each counter device gets a prefix (e.g., `C1-`), local sequence continues offline; server assigns the canonical running number on sync and the local record is updated. Both numbers print on the chit (`Chit No: C1-0042 / TMADJ-2026-01187`).
6. **Conflict policy** — POS rows are append-only (no conflicts). Hall bookings made offline are saved as **"Pending confirmation"** and validated against the calendar on sync; a clash flags the booking for manager action (no silent overwrite).
7. **Visible sync status** — header badge: 🟢 Online · 🟠 Syncing (n pending) · 🔴 Offline (n queued).

---

# 4. Theme & Visual Design — "Divya" Theme

A warm, devotional, premium look inspired by temple lamps, sandalwood, kumkum and gopuram gold.

### 4.1 Color palette
| Token | Hex | Use |
|---|---|---|
| `--maroon-900` | `#5C1A1B` | Sidebar background, headings |
| `--maroon-700` | `#7E2625` | Sidebar hover, accents |
| `--saffron-500` | `#E8852B` | Primary buttons, active menu, links |
| `--gold-400` | `#D4A943` | Borders, dividers, card icon rings, highlights |
| `--kumkum-500` | `#C8401F` | Danger/cancel, kumkum dot accents |
| `--cream-50` | `#FBF6EC` | Page background (sandal cream) |
| `--cream-100` | `#F4EAD8` | Card/table-stripe background |
| `--leaf-600` | `#3E7C4F` | Success, "Paid", mango-leaf toran accents |
| `--ink-900` | `#2B1B12` | Body text (warm brown-black) |

Subtle background texture: a 3% opacity **kolam/rangoli SVG pattern** on the page; a thin **gold gradient bar** (`gold-400 → saffron-500`) on top of every card; sidebar footer carries a small diya 🪔 motif.

### 4.2 Typography (Google Fonts)
- **Headings / temple name:** `Marcellus` (serif with a carved-stone, classical feel)
- **Body / UI:** `Inter` (crisp, highly legible for POS)
- **Numbers on receipts/cards:** `Inter` tabular-nums
- Optional Tamil support on receipts: `Noto Sans Tamil`

### 4.3 Icons
- **Lucide React** for all UI (consistent stroke icons)
- Custom inline SVG motif set for branding & empty states: **diya (lamp), temple bell, gopuram silhouette, om, lotus, kolam corner flourishes**
- Module icons: POS → `ReceiptText` · Donations → `HandCoins` · Hall → `CalendarDays` · Annadhanam → `Soup` · Devotees → `Users` · Reports → `BarChart3` · Lookups → `ListTree` · Users/Roles → `ShieldCheck` · Settings → `Settings`

### 4.4 Components style
Rounded-xl cards, soft warm shadows (`shadow-[0_4px_20px_rgba(92,26,27,.08)]`), gold 1px borders, saffron primary buttons with hover glow, maroon sidebar with gold active-item left bar, light/dark not required (single devotional light theme keeps the counter UI consistent).

---

# 5. Sidebar Menu (permission-driven)

```
🪔 TMADJ  [temple logo]
├── 🏠 Dashboard
├── 🧾 Counter (POS)            ← default landing for Staff
├── 🙏 Archanai / Ubhayam
├── 🤲 Donations
├── 🏛️ Hall Booking
│     ├── Calendar
│     └── Bookings List
├── 🍲 Annadhanam
├── 👥 Devotees
├── 📊 Reports
│     ├── Daily Collection
│     ├── Archanai Report
│     ├── Donation Report
│     ├── Hall Booking Report
│     ├── Annadhanam Report
│     └── Audit Log
├── 🗂️ Lookups (Master Data)
│     ├── Archanai Types
│     ├── Donation Categories / Sub-categories
│     ├── Hall & Event Types
│     ├── Annadhanam Types
│     └── Payment Modes
├── 🛡️ User Management
│     ├── Users
│     ├── Roles
│     └── Menu Permissions
└── ⚙️ Settings
      ├── Temple Profile & Logo
      ├── Receipt / Chit Template
      ├── Payment QR Setup
      └── Reminder Settings
```

Menu items render only if the logged-in role has `view` permission for that key (see §8).

---

# 6. Database Schema (Prisma → MySQL)

```prisma
model User {
  id            Int       @id @default(autoincrement())
  name          String
  email         String    @unique
  phone         String?
  passwordHash  String
  roleId        Int
  role          Role      @relation(fields: [roleId], references: [id])
  isActive      Boolean   @default(true)
  lastLoginAt   DateTime?
  createdAt     DateTime  @default(now())
  transactions  Transaction[]
  auditLogs     AuditLog[]
}

model Role {                       // SUPERADMIN, MANAGER, STAFF + custom
  id          Int     @id @default(autoincrement())
  name        String  @unique
  description String?
  isSystem    Boolean @default(false)   // superadmin not deletable
  users       User[]
  permissions RolePermission[]
}

model MenuItem {                   // drives sidebar + permissions
  id        Int     @id @default(autoincrement())
  key       String  @unique        // "pos", "reports.daily", "lookups"
  label     String
  icon      String?
  parentId  Int?
  sortOrder Int     @default(0)
  permissions RolePermission[]
}

model RolePermission {
  id         Int      @id @default(autoincrement())
  roleId     Int
  menuItemId Int
  canView    Boolean  @default(false)
  canCreate  Boolean  @default(false)
  canEdit    Boolean  @default(false)
  canDelete  Boolean  @default(false)
  canExport  Boolean  @default(false)
  role       Role     @relation(fields: [roleId], references: [id])
  menuItem   MenuItem @relation(fields: [menuItemId], references: [id])
  @@unique([roleId, menuItemId])
}

model LookupType {                 // "ARCHANAI", "DONATION", "HALL_EVENT",
  id      Int          @id @default(autoincrement())
  code    String       @unique    // "ANNADHANAM", "PAYMENT_MODE"...
  name    String
  values  LookupValue[]
}

model LookupValue {                // self-referencing → sub-categories
  id           Int        @id @default(autoincrement())
  typeId       Int
  type         LookupType @relation(fields: [typeId], references: [id])
  parentId     Int?       // Donation main → sub category
  parent       LookupValue?  @relation("SubValues", fields: [parentId], references: [id])
  children     LookupValue[] @relation("SubValues")
  nameEn       String
  nameTa       String?    // Tamil label for chit printing
  price        Decimal?   @db.Decimal(10,2)   // archanai fee, hall rate
  depositPct   Int?       // hall: 50
  meta         Json?      // capacity, duration, etc.
  isActive     Boolean    @default(true)
  sortOrder    Int        @default(0)
}

model Devotee {
  id            Int      @id @default(autoincrement())
  name          String
  phone         String?  @index
  altPhone      String?  // secondary contact
  icNumber      String?  // IC details (encrypted at rest)
  address       String?
  email         String?
  createdAt     DateTime @default(now())
  transactions  Transaction[]
  bookings      HallBooking[]
}

model Transaction {                // POS sales: archanai/donation/annadhanam
  id            Int       @id @default(autoincrement())
  clientUuid    String    @unique          // offline idempotency key
  receiptNo     String    @unique          // TMADJ-2026-01187
  localChitNo   String?                    // C1-0042
  kind          TxKind                     // ARCHANAI | DONATION | ANNADHANAM | HALL_PAYMENT
  devoteeId     Int?
  devotee       Devotee?  @relation(fields: [devoteeId], references: [id])
  devoteeName   String?                    // walk-in quick name
  starNatchathiram String?                 // for archanai chit
  items         TransactionItem[]
  total         Decimal   @db.Decimal(10,2)
  paymentMode   String                     // CASH | DUITNOW_QR | CARD
  status        TxStatus  @default(PAID)   // PAID | CANCELLED | REFUNDED
  bookingId     Int?                       // links deposit/balance to booking
  createdById   Int
  createdBy     User      @relation(fields: [createdById], references: [id])
  deviceId      String?                    // counter terminal
  txDate        DateTime  @default(now())
  syncedAt      DateTime?
}

model TransactionItem {
  id            Int         @id @default(autoincrement())
  transactionId Int
  transaction   Transaction @relation(fields: [transactionId], references: [id])
  lookupValueId Int
  nameSnapshot  String      // name & price frozen at sale time
  priceSnapshot Decimal     @db.Decimal(10,2)
  qty           Int         @default(1)
  lineTotal     Decimal     @db.Decimal(10,2)
}

model HallBooking {
  id            Int       @id @default(autoincrement())
  clientUuid    String    @unique
  bookingNo     String    @unique
  devoteeId     Int
  devotee       Devotee   @relation(fields: [devoteeId], references: [id])
  eventTypeId   Int                       // Wedding RM1000, Engagement RM5000...
  eventDate     DateTime
  startTime     DateTime
  endTime       DateTime
  hallRate      Decimal   @db.Decimal(10,2)
  depositDue    Decimal   @db.Decimal(10,2)  // 50%
  depositPaidAt DateTime?
  balanceDueAt  DateTime                     // eventDate - 7 days
  balancePaidAt DateTime?
  status        BookingStatus @default(PENDING_DEPOSIT)
  // PENDING_DEPOSIT → CONFIRMED → BALANCE_DUE → FULLY_PAID → COMPLETED | CANCELLED
  notes         String?
  reminders     Reminder[]
  createdAt     DateTime  @default(now())
}

model Reminder {
  id          Int         @id @default(autoincrement())
  bookingId   Int
  booking     HallBooking @relation(fields: [bookingId], references: [id])
  channel     String      // WHATSAPP | SMS | EMAIL
  scheduledAt DateTime    // balanceDueAt minus configured lead days
  sentAt      DateTime?
  status      String      @default("SCHEDULED")
}

model Setting {                    // temple profile, logo, QR, receipt config
  key   String @id               // "temple.name", "temple.logoUrl",
  value Json                     // "qr.imageUrl", "receipt.footerText",
}                                // "reminder.leadDays" ...

model AuditLog {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  action    String   // CREATE/UPDATE/DELETE/LOGIN/EXPORT/CANCEL
  entity    String
  entityId  String?
  before    Json?
  after     Json?
  ip        String?
  createdAt DateTime @default(now())
}
```

The **self-referencing `LookupValue`** elegantly covers the client's "Donation (Main) → Sub Category" requirement and lets the temple add Kanda Shasti, Navarathiri, Ponggal, Puli Soru, Kacang, etc. without code changes.

---

# 7. API Design (REST, `/api/v1`)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` (returns user + flattened permissions) |
| Users/Roles | CRUD `/users`, `/roles` · `GET/PUT /roles/:id/permissions` (matrix save) |
| Menu | `GET /menu` (filtered by role) |
| Lookups | `GET /lookups` (all, for offline mirror) · CRUD `/lookup-types/:code/values` (supports `parentId`) |
| Devotees | CRUD + `GET /devotees?search=phone|name|ic` |
| POS | `POST /transactions` · `POST /sync/transactions` (batch, idempotent by `clientUuid`) · `PATCH /transactions/:id/cancel` |
| Hall | `GET /bookings/calendar?month=` · CRUD `/bookings` · `POST /bookings/:id/payments` (deposit/balance → creates linked Transaction) |
| Reports | `GET /reports/daily-collection` · `/reports/archanai` · `/reports/donations` · `/reports/bookings` · `/reports/annadhanam` · `/reports/audit` — all accept the common filter set + `&format=csv|pdf` |
| Settings | `GET/PUT /settings` · `POST /settings/logo` (multipart; sharp → optimized PNG + favicon + receipt monochrome version) · `POST /settings/qr-image` |
| Dashboard | `GET /dashboard/summary?range=today` |

**Common report filters (query params):** `dateFrom, dateTo, kind, categoryId, subCategoryId, paymentMode, status, staffId, devoteeSearch, minAmount, maxAmount, deviceId, page, pageSize, sortBy, sortDir`.

---

# 8. Roles & Menu Permission System

- **Superadmin** — everything, including Roles, Menu Permissions, Settings, Audit Log, cancellations/refunds.
- **Manager** — operations + all reports + lookups + booking confirm/cancel; no user/role management (configurable).
- **Staff** — Counter POS, Devotees, today's own transactions; print/reprint own chits.

**Menu Permissions screen:** a matrix grid — rows = menu items (tree), columns = View / Create / Edit / Delete / Export — checkboxes per role, saved to `RolePermission`. Frontend guards routes with `<RequirePermission menu="reports.daily" action="view">`; backend enforces the same via middleware `can('reports.daily','view')`. **UI hiding is convenience; the API is the real gate.**

---

# 9. Page-by-Page Specification

### 9.1 Dashboard
- **Cards (today):** Total Collection (RM) · Archanai Count · Donations (RM) · Annadhanam Count · Upcoming Bookings (7 days) · Pending Balance (RM, overdue highlighted in kumkum red)
- **Recent Bookings table** — sorted by *nearest upcoming event date first*, columns: Booking No, Devotee, Event Type, Date/Time, Deposit ✓, Balance status chip, Actions
- Mini bar chart: last 7 days collection · Donut: collection by category
- Filters on dashboard: date range (Today / Week / Month / Custom)

### 9.2 Counter POS
- Left: big tappable category tiles (Archanai · Donation · Annadhanam) → item grid with prices; search box
- Right: cart with qty steppers, devotee quick-attach (search by phone), name + natchathiram fields for archanai chit
- Pay panel: **Cash** (tendered/change calc) or **DuitNow QR** (shows temple QR full-screen for devotee to scan) → **Print Chit**
- Reprint, hold/recall cart, offline badge always visible

### 9.3 Hall Booking
- Month/week **calendar** (booked = maroon, tentative = saffron, available = cream); click a day → booking drawer
- Form captures: Name, Contact, Secondary contact, Address, **IC details**, event type (auto rate: Wedding RM1000, Engagement RM5000…), date/time
- Auto-computes 50% deposit; "Collect Deposit" jumps to POS payment; balance due auto-set to event − 7 days; reminder auto-scheduled
- List view with filters: status, event type, date range, devotee, payment state

### 9.4 Reports (every report = same shell)
Filter bar (sticky) → summary chips (count, total RM) → data table (sortable, paginated) → **Export CSV / PDF / Print**. Audit Log report is Superadmin-only.

### 9.5 Lookups
Tabbed per type; tree editing for donation sub-categories; inline price edit; drag sort; activate/deactivate (never hard-delete a value used in transactions — snapshots protect history anyway).

### 9.6 Settings
- **Temple Profile & Logo:** name (EN/TA), address, phone, registration no; logo dropzone with live preview in sidebar + receipt header; auto-generates favicon & PWA icons
- **Receipt Template:** paper width 58/80mm, header/footer blessing text (e.g., "ஓம் சக்தி"), show/hide QR on chit, language EN/TA/both
- **Payment QR:** upload DuitNow QR image shown on POS pay screen & optionally printed on chit
- **Reminders:** lead days, channel (WhatsApp link/SMS/Email), message template with placeholders

---

# 10. Receipt / Chit Printing

- Print-CSS template at exact 80mm (or 58mm) width: logo (monochrome), temple name EN/TA, chit no (local + server), date/time, devotee name + natchathiram, items, total RM, payment mode, blessing footer, optional QR
- Default path: silent-ish browser print to the OS thermal driver
- Optional upgrade: **QZ Tray** for true silent ESC/POS printing + cash-drawer kick
- Works offline (template + logo precached)

---

# 11. Project Folder Structure

```
tmadj/
├── server/
│   ├── prisma/schema.prisma · seed.ts (roles, menus, lookups, demo data)
│   ├── src/
│   │   ├── app.ts · server.ts
│   │   ├── middleware/ (auth.ts, can.ts, audit.ts, error.ts)
│   │   ├── modules/
│   │   │   ├── auth/ users/ roles/ menu/
│   │   │   ├── lookups/ devotees/ transactions/ sync/
│   │   │   ├── bookings/ reminders/ reports/ dashboard/ settings/
│   │   ├── jobs/reminder.cron.ts
│   │   └── utils/ (receiptNo.ts, pdf.ts, csv.ts)
│   └── uploads/ (logo, qr)
├── client/
│   ├── vite.config.ts (vite-plugin-pwa, Workbox)
│   ├── src/
│   │   ├── app/ (router.tsx, providers.tsx, permissions.tsx)
│   │   ├── theme/ (tokens.css, kolam.svg, motifs/)
│   │   ├── db/ (dexie.ts, outbox.ts, syncEngine.ts)
│   │   ├── components/ (ui/, layout/Sidebar.tsx, SyncBadge.tsx, FilterBar.tsx, DataTable.tsx)
│   │   ├── features/
│   │   │   ├── dashboard/ pos/ archanai/ donations/
│   │   │   ├── bookings/ annadhanam/ devotees/
│   │   │   ├── reports/ lookups/ users/ settings/
│   │   └── print/ChitTemplate.tsx
│   └── public/ (manifest.webmanifest, icons/)
└── docker-compose.yml (mysql, server, client, nginx)
```

---

# 12. Security & Non-Functional

- bcrypt(12) passwords · JWT 15-min access + 7-day rotating refresh (httpOnly)
- Zod validation on every endpoint · rate-limit on auth · helmet + CORS allowlist
- IC numbers encrypted at rest (AES-256-GCM) and masked in UI (`XXXXXX-XX-1234`) except for permitted roles
- Full audit trail on mutations; cancelled sales are status-changed, never deleted
- Nightly `mysqldump` backup job; uploads backed up alongside
- HTTPS mandatory (PWA service workers require it)

---

# 13. Delivery Plan (8 weeks)

| Phase | Weeks | Deliverables |
|---|---|---|
| 1. Foundation | 1–2 | Repo, Prisma schema + seed, auth, roles, menu permissions, themed app shell + sidebar, settings + **logo upload** |
| 2. Lookups & Devotees | 2–3 | Full lookup manager (with sub-categories), devotee registry |
| 3. Counter POS + Printing | 3–4 | POS screen, cash/QR pay, chit template, receipt numbering |
| 4. Offline/PWA | 4–5 | Workbox, Dexie mirror + outbox, sync engine, sync badge, offline print |
| 5. Hall Booking | 5–6 | Calendar, deposit/balance flow, reminder cron |
| 6. Reports & Dashboard | 6–7 | All 6 reports with filters + CSV/PDF export, dashboard cards & recent-bookings table |
| 7. Hardening & UAT | 7–8 | Audit log, backups, docker deploy, training, go-live |

---

# 14. Seed Data (from client doc)

- **Archanai/Ubhayam:** Kanda Shasti, Navarathiri (+ placeholder rows the temple edits)
- **Donations:** main categories with sub-categories (editable tree)
- **Hall events:** Wedding RM 1,000 · Engagement RM 5,000 · Bangle Ceremony · Baby Shower · Temple Archanai Wedding (deposit 50%, balance due 1 week before)
- **Annadhanam:** Ponggal, Puli Soru, Kacang
- **Payment modes:** Cash, DuitNow QR
- **Roles:** Superadmin, Manager, Staff with sensible default permission matrix
