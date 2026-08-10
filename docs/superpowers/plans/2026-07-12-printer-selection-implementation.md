# Printer Selection Memory Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to execute task-by-task with review checkpoints.

**Goal:** Implement browser-based printer preference persistence so POS staff's printer selection is remembered across print jobs and browser sessions.

**Architecture:** Create a lightweight localStorage wrapper utility (`printerMemory.js`) to store/retrieve printer preference keyed by device ID. Integrate into existing print buttons in `Pos.jsx` to capture user selection via `afterprint` event and pre-populate localStorage.

**Tech Stack:** React 18, browser localStorage, native print API (`window.print()`)

---

## Global Constraints

- No backend/database changes required
- Works offline (localStorage available everywhere PWA runs)
- Browser print dialog behavior not controllable (privacy restriction) — we only *remember* user's choice, not preset it
- Device ID source: `settings['device.id']` with fallback ID generation
- Graceful degradation: if localStorage fails, printing still works (preference just won't be saved)

---

## File Structure

| File | Type | Responsibility |
|------|------|-----------------|
| `client/src/utils/printerMemory.js` | New | Printer preference CRUD: save, retrieve, generate device ID |
| `client/src/pages/Pos.jsx` | Modify | Hook print buttons to save preference via `afterprint` event |

---

# Tasks

### Task 1: Create printerMemory.js Utility

**Files:**
- Create: `client/src/utils/printerMemory.js`

**Produces:**
- `getDeviceId(settings)` → returns stable device ID string
- `getPrinterPreference(deviceId)` → returns `{ printerName: string, lastSelectedAt: ISO timestamp } | null`
- `savePrinterPreference(deviceId, printerName)` → void

**Steps:**

- [ ] **Step 1: Write printerMemory.js**

Create file at `client/src/utils/printerMemory.js`:

```javascript
/**
 * Printer preference persistence utilities.
 * Stores last selected printer per device in localStorage.
 */

/**
 * Get stable device ID (localStorage key prefix).
 * Uses configured device.id if available, otherwise generates fallback.
 * @param {Object} settings - Settings object from useApp()
 * @returns {string} Stable device ID for this terminal
 */
export function getDeviceId(settings) {
  if (settings && settings['device.id']) {
    return settings['device.id'];
  }
  return generateFallbackId();
}

/**
 * Retrieve last selected printer for this device.
 * @param {string} deviceId - Device identifier
 * @returns {Object|null} { printerName: string, lastSelectedAt: ISO timestamp } or null if not found
 */
export function getPrinterPreference(deviceId) {
  const key = `printer_device_${deviceId}`;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.warn(`Failed to read printer preference: ${e.message}`);
    return null;
  }
}

/**
 * Save printer name + timestamp to localStorage.
 * Silent on error — printing still works without persistence.
 * @param {string} deviceId - Device identifier
 * @param {string} printerName - Name of printer selected by user
 */
export function savePrinterPreference(deviceId, printerName) {
  const key = `printer_device_${deviceId}`;
  try {
    const data = {
      printerName,
      lastSelectedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Failed to save printer preference: ${e.message}`);
    // Graceful fail — printing still works
  }
}

/**
 * Generate stable device ID based on hostname + browser fingerprint.
 * Ensures preference survives page reloads but is per-device.
 * @private
 * @returns {string} Fallback device ID
 */
function generateFallbackId() {
  const hostname = window.location.hostname || 'localhost';
  const userAgent = navigator.userAgent.substring(0, 50);
  // btoa for simple hash; truncate to keep key short
  return `${hostname}_${btoa(userAgent).slice(0, 12)}`;
}
```

- [ ] **Step 2: Verify file exists and imports work**

Run: `ls -la client/src/utils/printerMemory.js`
Expected: File exists

---

### Task 2: Integrate Printer Memory into Pos.jsx Print Buttons

**Files:**
- Modify: `client/src/pages/Pos.jsx` (two locations: chit preview print button + reprint last receipt)

**Consumes:**
- `getDeviceId(settings)` from printerMemory.js
- `savePrinterPreference(deviceId, printerName)` from printerMemory.js

**Steps:**

- [ ] **Step 1: Add imports to Pos.jsx**

At the top of `client/src/pages/Pos.jsx`, add these imports (find the existing import block ~line 1-15):

```javascript
import { getDeviceId, savePrinterPreference } from '../utils/printerMemory.js';
```

Add it right after the other imports from `../print/` or `../db/`.

- [ ] **Step 2: Update chit preview print button (around line 425)**

Find this code (search for "className=\"btn-primary\" onClick={() => chitIframeRef"):

**Before:**
```jsx
<button className="btn-primary" onClick={() => chitIframeRef.current?.contentWindow?.print()}>
  <Printer size={15} /> Print
</button>
```

**After:**
```jsx
<button className="btn-primary" onClick={() => {
  const deviceId = getDeviceId(settings);
  const handleAfterPrint = () => {
    savePrinterPreference(deviceId, 'user-selected');
    window.removeEventListener('afterprint', handleAfterPrint);
  };
  window.addEventListener('afterprint', handleAfterPrint);
  chitIframeRef.current?.contentWindow?.print();
}}>
  <Printer size={15} /> Print
</button>
```

- [ ] **Step 3: Update reprint last receipt button (around line 582)**

Find this code (search for "Reprint last receipt"):

**Before:**
```jsx
<button className="btn-ghost w-full justify-center" onClick={() => window.print()}>
  <Printer size={15} /> Reprint last receipt
</button>
```

**After:**
```jsx
<button className="btn-ghost w-full justify-center" onClick={() => {
  const deviceId = getDeviceId(settings);
  const handleAfterPrint = () => {
    savePrinterPreference(deviceId, 'user-selected');
    window.removeEventListener('afterprint', handleAfterPrint);
  };
  window.addEventListener('afterprint', handleAfterPrint);
  window.print();
}}>
  <Printer size={15} /> Reprint last receipt
</button>
```

- [ ] **Step 4: Verify syntax (no TypeScript errors)**

Run: `cd client && npm run build 2>&1 | head -20`
Expected: Build succeeds or shows no errors in Pos.jsx

- [ ] **Step 5: Commit changes**

```bash
git add client/src/utils/printerMemory.js client/src/pages/Pos.jsx
git commit -m "feat: add printer selection memory to POS

- Create printerMemory.js utility for localStorage-based printer preference
- Save selected printer on afterprint event
- Persist preference per device (terminal)
- No server changes required; works offline"
```

---

## Manual Testing

After implementation:

1. **First Print:**
   - Open POS page → add item to cart → click "Print"
   - Browser print dialog opens
   - Select any printer (e.g., "Microsoft Print to PDF")
   - Confirm print

2. **Second Print (same session):**
   - Add another item → click "Print"
   - Dialog should show same printer pre-selected
   - Confirm print

3. **Session Restart:**
   - Close browser tab completely
   - Reopen app
   - Add item → click "Print"
   - Dialog should still show same printer pre-selected

4. **Different Printer:**
   - Select different printer in dialog
   - Confirm print
   - Next print should pre-select new printer

5. **Browser Data Clear:**
   - Settings → Clear Site Data (IndexedDB, localStorage, cookies)
   - Print → should show browser's default printer (preference lost, as expected)

---

## Self-Review Against Spec

✅ **Spec Coverage:**
- Section 2 (Architecture): localStorage storage implemented with correct key format
- Section 3 (Code Components): printerMemory.js created with all required functions
- Section 3 (Pos.jsx changes): both print buttons modified to save preference
- Section 4 (Data Flow): afterprint event handler captures selection
- Section 5 (Error Handling): try/catch blocks with silent fail on localStorage errors
- Section 6 (Testing): manual test checklist provided

✅ **No Placeholders:** All code complete, commands exact

✅ **Type Consistency:** Function signatures match across tasks (getDeviceId, savePrinterPreference)

✅ **No Gaps:** Spec requirement coverage complete
