# POS Guest Orders (Name & Phone) — Design

## Problem

Create Order in POS currently uses `DevoteeSearch` in `receipt` mode: a search box labeled `"User :"` that autocompletes against existing `Devotee` records, but also accepts free-typed text. Cashiers checking out a walk-in (not an existing devotee) have no dedicated way to capture a phone number, and the "search a person" UX is unnecessary friction for a fast checkout flow.

Separately, once such walk-in ("guest") orders exist, they need to behave sensibly in All Orders: guest orders aren't linked to any `Devotee` record, so soft-cancelling them (today's only delete mechanism, which just flips `status = CANCELLED` and keeps the row) is more ceremony than they need. They should be hard-deletable instead.

## Scope

- Replace the devotee search box in the POS Create Order sidebar with plain Name + Phone text inputs.
- Store the phone captured there.
- Show it in All Orders.
- Add a real hard-delete path for orders with no linked devotee, while leaving devotee-linked orders' cancel behavior untouched.

Out of scope: changes to devotee search/autocomplete anywhere else (Dashboard, Bookings) — those keep `DevoteeSearch` as-is. Printed chit layout is unchanged (phone is captured for records, not printed) unless follow-up asks for it.

## 1. Create Order sidebar

`client/src/pages/Pos.jsx` — the receipt-panel block currently rendering:

```jsx
<DevoteeSearch receipt value={{ name: devoteeName }} onChange={(d) => setDevoteeName(d.name)} />
```

is replaced with two plain inputs in one row, under a single label **"Name & Phone"**:

- Name — free text, replaces current `devoteeName` state (unchanged variable).
- Phone — free text, new `devoteePhone` state.

No autocomplete, no devotee lookup, no `devoteeId` gets set from this flow — every order created through POS from now on has `devoteeId = null`. `DevoteeSearch.jsx`'s `receipt` prop/branch is deleted (it was only consumed here).

`completeSale()` includes `devoteePhone` in the transaction payload sent to `queueTransaction`. `loadFromOrder()` (the "recreate with same items" action) also restores `devoteePhone` into state, matching how it already restores `devoteeName`.

## 2. Data model

`Transaction` gains a nullable `devoteePhone` string column (mirrors the existing `devoteeName` column — both are point-in-time snapshots, not FKs).

- `server/db.js`: add `devoteePhone: DataTypes.STRING` to the `Transaction` model.
- `server/migrations/add_devoteePhone_to_transaction.sql`:
  ```sql
  ALTER TABLE transaction ADD COLUMN devoteePhone VARCHAR(255) NULL AFTER devoteeName;
  ```
  (Manual migration, run by hand against MySQL — matches the existing convention of the other files in `server/migrations/`.)
- `server/routes/transactions.js`: `createTransaction()` accepts and stores `devoteePhone` from the request body.
- Client offline queue (`client/src/db/dexie.js`, `client/src/db/syncEngine.js`): `devoteePhone` flows through the local `localTx` record and sync payload the same way `devoteeName` already does.

## 3. All Orders display

`client/src/pages/Pos.jsx`, All Orders tab:

- Devotee column: when `t.devoteePhone` is present, render `Name · Phone` (same join pattern already used for devotee search results elsewhere), else just the name (unchanged for older/devotee-linked orders with no phone snapshot).
- Order details modal (`viewing`): add a phone line next to the existing devotee name line, shown only when present.
- CSV/PDF export columns (`POS_PRINT_COLS`) — no change; devotee phone is not added to exports (out of scope, can be a follow-up).

## 4. Delete behavior

Two paths, distinguished by whether the order has a `devoteeId`:

**Devotee-linked orders (`devoteeId` set)** — unchanged. Cancel button (`XCircle` icon) → `PATCH /transactions/:id/cancel` → soft-cancel, row stays with `status = CANCELLED`.

**Guest orders (`devoteeId` null)** — new. Delete button (trash icon) → `DELETE /api/v1/transactions/:id` → hard delete.

New server route, `server/routes/transactions.js`:

```
r.delete('/:id', can('pos', 'delete'), async (req, res, next) => {
  // 404 if not found
  // 400 if before.devoteeId is not null — "Linked orders must be cancelled, not deleted"
  // delete TransactionItem rows for this transaction, then delete the Transaction row
  // audit(req, 'DELETE', 'Transaction', id, before.toJSON(), null)
});
```

Same permission gate as cancel (`can('pos', 'delete')`) — "direct" means a different DB operation (hard delete vs soft-cancel), not a different permission check.

Client (`Pos.jsx` All Orders actions column): the existing single action button becomes conditional on `t.devoteeId`:
- `devoteeId` set → today's Cancel button + `ConfirmModal` (unchanged copy).
- `devoteeId` null → Delete button + a `ConfirmModal` with different copy ("Permanently delete receipt {receiptNo}? This cannot be undone.") calling the new `DELETE` endpoint, then `loadOrders()`.

Both remain hidden once already cancelled/deleted (guest rows disappear from the list entirely on delete, so no extra state needed there).

## Testing

- Create a POS order with Name+Phone → order appears in All Orders with `Name · Phone`, `devoteeId` null.
- Since POS no longer links a devotee at all, verify existing devotee-linked historical orders (created before this change) still display and cancel correctly.
- Guest order → Delete → row disappears from All Orders, confirm via a fresh `GET /transactions` that the row and its items are gone.
- Devotee-linked order → Cancel still works exactly as before (regression check).
- Attempt `DELETE /transactions/:id` directly against a devotee-linked order → 400.
- Permission check: user without `pos.delete` sees no Delete/Cancel button and gets 403 if calling the endpoints directly.
