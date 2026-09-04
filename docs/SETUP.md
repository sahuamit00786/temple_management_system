# Counter Printer Setup — Silent Printing (No Print Popup)

By default, printing a chit shows the browser's print dialog and staff must click through it every sale. This guide sets up **silent printing**: prints go straight to the printer with zero dialog, zero clicks.

**How it works:** Chrome/Edge has a launch flag, `--kiosk-printing`, that skips the print dialog and sends every print job straight to whatever is set as the Windows **default printer**. We create a desktop shortcut that launches the browser with this flag. No extra software is installed — it's the same browser already on the PC, just started differently.

**Trade-off:** this only supports one printer per terminal (whatever is set as Windows default) — there's no in-app printer picker. Fine for a counter with a single thermal receipt printer.

---

## Prerequisites

- Windows PC used as the counter terminal
- The thermal receipt printer installed and working in Windows (test-print a page from Windows first)
- Google Chrome or Microsoft Edge installed
- The POS app's live URL (ask whoever deployed it, e.g. `https://your-pos-url`)

---

## Step 1 — Set the thermal printer as Windows default

1. Windows Settings → Bluetooth & devices → Printers & scanners.
2. Click the thermal printer → **Set as default**.

Every silent print goes to whichever printer is default at print time — this is the only printer selection this setup has.

---

## Step 2 — Run the setup script (one time per PC)

The script is at [`scripts/setup-kiosk-printer.ps1`](../scripts/setup-kiosk-printer.ps1) in this repo.

1. Copy `setup-kiosk-printer.ps1` onto the counter PC (a USB stick or shared folder is fine — it doesn't need the rest of the repo).
2. Open PowerShell on that PC and run:
   ```powershell
   powershell -ExecutionPolicy Bypass -File setup-kiosk-printer.ps1
   ```
   This defaults to `https://temple.insur-vault.com`. To point at a different URL instead, add `-PosUrl "https://other-url"`.
3. This creates a **"Temple POS"** shortcut on the Desktop. That's it — nothing else installed.

---

## Step 3 — Daily use

- Staff open the POS **only** from the "Temple POS" desktop shortcut — not a browser bookmark, not a typed URL, not a taskbar-pinned regular Chrome icon.
- The shortcut opens a borderless browser window (no tabs/address bar) — this is expected, it's kiosk mode.
- Every chit print from here on is silent: no dialog, straight to the default printer.
- To close, use Alt+F4 or close it from the taskbar/Task Manager (there's no window "X" visible in some kiosk layouts, depending on Chrome version).

---

## Troubleshooting

**Popup still appears:**
- Confirm Chrome/Edge was **fully closed** before opening the "Temple POS" shortcut. Chrome is single-instance — if it was already running, the shortcut just opens a new tab in the existing (non-flagged) window instead of a fresh flagged process. Close all Chrome windows (check Task Manager for lingering `chrome.exe` processes) and try again.
- Confirm they actually launched via the "Temple POS" shortcut, not a different icon/bookmark.

**Prints to the wrong printer / nothing prints:**
- Re-check Step 1 — the printer must be the Windows **default**, not just installed. If the default printer changes (new printer added, driver reinstalled), redo Step 1.

**Need to switch printers sometimes:**
- Not supported by this approach — it always uses whichever printer is Windows-default at print time. If a terminal genuinely needs to switch between multiple printers, this setup isn't enough; a different approach (e.g. a local print agent with an in-app picker) would be needed instead.

**Script fails with "Could not find Chrome or Edge":**
- Install either browser first, then re-run the script.

**Script won't run / "execution policy" error:**
- Make sure you're running the exact command in Step 2 (`-ExecutionPolicy Bypass -File ...`), which bypasses the machine's default script-blocking policy for just this one run — it doesn't change any system-wide setting.
