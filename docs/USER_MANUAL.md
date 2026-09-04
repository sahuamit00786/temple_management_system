# TMADJ Temple POS — User Manual

A simple guide to using the temple counter system: sales, hall bookings, devotee records, and reports.

---

## 1. What this system does

This app helps temple staff:
- Sell at the counter — archanai, donations, annadhanam, and print a receipt ("chit") for the devotee
- Manage hall bookings — book the temple hall for weddings, functions, etc., collect deposits and balances
- Keep devotee records — names, contact details, memberships, notes
- View reports — daily collections, bookings, payments, devotees
- Work offline — if the internet drops, the counter keeps working and syncs later

It works on a computer, tablet, or phone browser. On the counter machine you'll usually use it full-screen next to a receipt printer.

**One-time counter setup — silent printing (no print popup):** By default, printing a chit shows the browser's print dialog every time. This can be eliminated with a one-time setup on the counter PC — no extra software installed. See [SETUP.md](SETUP.md) for exact steps.

---

## 2. Logging in

1. Open the app in your browser.
2. Enter your email and password, then click Sign in.
3. Forgot your password? Click Forgot password? on the login screen:
   - Enter your email — you'll receive a one-time code (OTP) by email
   - Enter the code, then set a new password

Ask your administrator if you don't have a login yet (see [Users & Roles](#10-users--roles-admins)).

---

## 3. Dashboard

The Dashboard is your home screen after logging in. It shows:
- Collection summary — how much has come in
- Calendar — hall bookings for the month; tap a day to see or add bookings
- Upcoming reminders — deposits/balances due soon
- Quick actions — jump straight into a new booking or payment

---

## 4. Counter Sales (POS)

Go to POS in the sidebar.

### Making a sale
1. Pick a category tab at the top (e.g. Archanai, Donation, Annadhanam — these are set up by your admin in [Temple Config](#9-lookups--temple-config-admins)).
2. Tap an item tile to add it to the cart. Tap again, or use the + / – buttons, to change quantity.
3. If donations have sub-categories, they'll appear grouped under a heading.
4. Optionally search for or type in a devotee name on the right-hand receipt panel — this prints on the chit and links the sale to that devotee's history.
5. For Archanai, you can pick the devotee's star (Natchathiram) if relevant.
6. Check the live receipt preview on the right as you build the cart.

### Taking payment
1. Once the cart has items, click Cash or DuitNow QR.
   - Cash: enter the amount received — the system calculates change automatically. Confirm to complete the sale.
   - DuitNow QR: the QR code (set up in Settings) appears full-screen for the devotee to scan. Click Confirm payment received once paid.
2. The receipt (chit) prints automatically. It shows item names in English (and Tamil if configured), the total, payment mode, and a receipt number.
3. If the internet is down, the sale still completes and prints instantly with a local receipt number (like `C1-0042`). It syncs to the server automatically once you're back online, and receives the official receipt number.

### All Orders tab
Switch to the All Orders tab to:
- Search and filter past sales by date, payment mode, or status
- View the printed chit again or reprint it
- View full item details of an order
- Cancel an order (cancelled sales are kept on record, never deleted)
- Re-create an order (loads the same items into a new sale)
- Export the list to CSV or PDF

---

## 5. Hall Bookings

Go to Bookings in the sidebar.

### Calendar view
- Browse by month using the arrows, or click the month name to jump to any month/year.
- Days with bookings are highlighted. Tap a day to see its bookings or start a new one.
- Tap an empty future date to start a new booking for that date.

### Creating a booking
1. Click New booking.
2. Choose the event type (e.g. Wedding, Function) — its hall rate and suggested deposit appear automatically.
3. Set the start/end date and time. The system checks automatically for a scheduling clash and warns you if the hall is already booked.
4. Enter the devotee's details (name, phone, alternate phone, IC/passport, address) — or search for an existing devotee.
5. Add any notes (special requirements, remarks).
6. Optionally collect an advance payment now (amount + payment mode). The suggested deposit is usually 50% of the hall rate but can vary by event type.
7. Click Save booking.

### Booking statuses
A booking moves through these stages automatically based on payments:
- Deposit pending — nothing paid yet
- Balance due — deposit paid, balance still owed
- Balance overdue — balance due date has passed and it's still unpaid
- Fully paid — hall rate fully collected
- Cancelled — booking was cancelled

### Managing a booking
From the Bookings List or Calendar, open a booking to:
- Pay — record a deposit or balance payment (cash or other mode)
- View details — devotee info, financial summary, full payment history
- Add/edit/delete notes
- Send a WhatsApp message — quick reminder using a pre-set message template
- Cancel the booking (kept on record, not deleted)
- Download Invoice PDF

If offline, new bookings and payments are queued and sync automatically once you're back online.

---

## 6. Devotees

Go to Devotees in the sidebar.

- Search by name, phone, or IC number.
- Add Member to create a new devotee record: name, contact numbers, IC/passport, address (English and Tamil), email.
- Set a Member Type: Devotee (default), Member, or Committee.
  - For Member, choose a membership plan (fee and duration are pre-set by your admin), how it was paid, and the start date — the end date calculates automatically.
  - For Committee, record the term/role, amount, payment method, and term dates.
- IC/passport numbers are partially hidden in the list for privacy — hover to reveal.
- Click a devotee's name to open their profile: full details, transaction history, and notes.
- Send a WhatsApp message directly from the list.
- Export the devotee list to CSV or PDF.

---

## 7. Payments Ledger

Go to Payments in the sidebar. This is a combined view of every payment collected — counter sales, hall booking payments, and memberships — in one searchable list.

- Filter by date range, type (Hall Booking / POS Order / Membership), payment mode, or status.
- See a running total of payments matching your filters.
- Click the eye icon on any row to see the full item breakdown.

---

## 8. Reports

Go to Reports in the sidebar. Choose a tab:

| Tab | Shows |
|---|---|
| Daily Collection | All counter sales — with totals by payment mode and type |
| Hall Bookings | All bookings — with totals collected/outstanding by status |
| Hall Payments | Just the hall-booking payments |
| Devotees | Devotee registrations, new this month, membership stats |
| Audit Log | Who changed what and when (Superadmin only) |

Every report has date range, search, and relevant filters, plus summary cards at the top. Use Export to download as CSV or PDF.

---

## 9. Lookups & Temple Config (admins)

These two screens control the dropdown values and POS items used throughout the system — no code changes needed.

### Temple Config
Go to Temple Config. This controls what appears on the POS screen:
- Add category — a new tab on the POS screen (e.g. "Prayers / Pooja").
- Within a category, Add group to create a section heading (e.g. "Ubhayam"), or Add item for a sellable item with a price.
- Drag rows (or category tabs) to reorder them.
- Deactivate (eye icon) hides an item from the counter without deleting its sales history; Delete removes it, but if it's already been used in a sale it will be deactivated instead of deleted.

### Lookups
Go to Lookups for all the other dropdown lists used across the system (payment modes, hall event types, membership types, Natchathiram/star list, etc.). Add, edit, deactivate, or delete values the same way.

---

## 10. Users & Roles (admins)

Go to Users.

- Users tab — add staff logins (name, email, phone, role, password). Edit or deactivate accounts; deactivated users can't log in.
- Roles tab — create roles (e.g. "Cashier", "Manager") to group permissions.
- Menu Permissions tab — for a chosen staff member, tick which pages they can View / Create / Edit / Delete / Export. This overrides their role's default permissions for that person only.

The built-in Superadmin role always has full access everywhere and cannot be restricted.

---

## 11. Settings (admins)

Go to Settings:

| Tab | What it configures |
|---|---|
| Temple Profile & Logo | Temple name (English/Tamil), address, phone, logo image — shown in the sidebar, login screen, and on receipts |
| Receipt / Chit | Paper width (80mm/58mm), footer blessing text, receipt language |
| Payment QR | Upload your bank's DuitNow QR image, shown full-screen at checkout |
| Numbering | Prefix and digit count for POS order numbers and hall booking numbers |
| Message Templates | Pre-written WhatsApp messages (e.g. booking reminders) with placeholders that auto-fill devotee/booking details |

---

## 12. Working offline

If the internet connection drops:
- The POS screen keeps working — sales complete instantly with a local receipt number and print normally.
- Hall bookings and payments made while offline are queued and marked "Pending sync."
- Devotees and users can also be added while offline and will sync later.
- Some screens (like Reports) require an internet connection and will show a message if you're offline.
- Once your connection returns, everything syncs automatically in the background — look for the sync status indicator in the header. Synced items lose their "Pending sync" tag and receive their official receipt/booking numbers.

---

## 13. Glossary

| Term | Meaning |
|---|---|
| Archanai / Ubhayam | A puja/ritual offering purchased at the counter |
| Annadhanam | Food offering/donation (e.g. Ponggal, Puli Soru) |
| Chit | The printed receipt from a counter sale |
| DuitNow QR | Malaysian QR payment method |
| Devotee | A registered member/customer of the temple |
| Hall Booking | A reservation of the temple hall for an event |
| Deposit / Balance | Initial partial payment for a hall booking, and the remaining amount owed |
| Local chit number | Temporary receipt number (e.g. `C1-0042`) assigned while offline, replaced by the official number once synced |
