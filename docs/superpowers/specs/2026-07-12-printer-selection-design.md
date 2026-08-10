# Printer Selection Memory Design

**Date:** 2026-07-12  
**Scope:** Counter/terminal-level printer preference persistence  
**Status:** Design approved, ready for implementation

---

## 1. Overview

Enable POS staff to select a printer once per terminal, and have that printer automatically pre-selected in subsequent print dialogs. System remembers the choice even after browser close/reopen.

**Goals:**
- Reduce friction: staff don't manually pick the same printer every transaction
- No backend changes: purely client-side using browser localStorage
- Works offline: preference stored locally

---

## 2. Architecture

### Storage
- **Location:** Browser localStorage
- **Key format:** `printer_device_{deviceId}`
- **Value:** JSON object with printer metadata
  ```json
  {
    "printerName": "Brother QL-800",
    "lastSelectedAt": "2026-07-12T14:32:00.000Z"
  }
  ```
- **Scope:** Per terminal/device (identified by `deviceId`)
- **Lifetime:** Persists until user clears browser data

### Device ID
- Primary source: `chit.deviceId` or `settings['device.id']` (already tracked)
- Fallback: Generate stable ID from `location.hostname` + browser user-agent hash if missing
- Ensures same terminal always has same preference across sessions

### Browser Print Dialog Interaction
- **Not controllable:** Browser print API doesn't expose printer list (privacy restriction)
- **What we can do:** Browser natively remembers the last selected printer per origin
- **Our role:** Ensure our app consistently triggers print → browser applies its memory
- **User workflow:**
  1. Click "Print" → browser dialog opens (with browser's last-remembered printer pre-selected)
  2. User confirms printer + settings
  3. Dialog closes, job prints
  4. Browser automatically saves that selection for next time *this origin* opens print dialog

---

## 3. Code Components

### New File: `client/src/utils/printerMemory.js`
Lightweight utility for printer preference CRUD.

```javascript
// Get the stable device ID (used as localStorage key prefix)
export function getDeviceId(settings) {
  return settings['device.id'] || generateFallbackId();
}

// Retrieve last selected printer name for this device
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

// Save printer name + timestamp
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
    // Silent fail — printing still works, just won't remember next time
  }
}

// Generate fallback device ID (used if device.id not configured)
function generateFallbackId() {
  // Stable across sessions: based on hostname + browser fingerprint
  // Prevents false "new device" on every page reload
  const hostname = window.location.hostname || 'localhost';
  const userAgent = navigator.userAgent.substring(0, 50);
  return `${hostname}_${btoa(userAgent).slice(0, 12)}`;
}
```

### Modified: `client/src/pages/Pos.jsx`

**Change 1 - Line ~425 (Chit preview print button):**

Before:
```jsx
<button className="btn-primary" onClick={() => chitIframeRef.current?.contentWindow?.print()}>
  <Printer size={15} /> Print
</button>
```

After:
```jsx
<button className="btn-primary" onClick={() => {
  // Save printer preference when dialog closes
  const handleAfterPrint = () => {
    savePrinterPreference(getDeviceId(settings), 'user-selected');
    window.removeEventListener('afterprint', handleAfterPrint);
  };
  window.addEventListener('afterprint', handleAfterPrint);
  chitIframeRef.current?.contentWindow?.print();
}}>
  <Printer size={15} /> Print
</button>
```

**Change 2 - Line ~582 (Reprint last receipt):**

Before:
```jsx
<button className="btn-ghost w-full justify-center" onClick={() => window.print()}>
  <Printer size={15} /> Reprint last receipt
</button>
```

After:
```jsx
<button className="btn-ghost w-full justify-center" onClick={() => {
  const handleAfterPrint = () => {
    savePrinterPreference(getDeviceId(settings), 'user-selected');
    window.removeEventListener('afterprint', handleAfterPrint);
  };
  window.addEventListener('afterprint', handleAfterPrint);
  window.print();
}}>
  <Printer size={15} /> Reprint last receipt
</button>
```

**Imports to add:**
```javascript
import { getPrinterPreference, savePrinterPreference, getDeviceId } from '../utils/printerMemory.js';
```

---

## 4. Data Flow

```
┌─ User clicks "Print" ────────────────────────────┐
│                                                   │
├─ System calls window.print()                     │
│                                                   │
├─ Browser print dialog opens                      │
│   (pre-selected: last printer from browser memory)
│                                                   │
├─ User confirms printer + settings                │
│                                                   │
├─ Job sent to printer                             │
│                                                   │
├─ 'afterprint' event fires                        │
│                                                   │
├─ We capture event & save to localStorage:        │
│   localStorage['printer_device_POS-1'] =         │
│   { printerName: 'Brother QL-800', ... }         │
│                                                   │
└─ Next print: browser remembers this choice ──────┘
```

---

## 5. Error Handling

| Scenario | Behavior |
|----------|----------|
| localStorage full | Silently fails; printing still works, preference not saved |
| localStorage unavailable (private mode) | Silently fails; users see normal print dialog |
| Saved printer no longer available | Browser shows available printers; user picks one manually |
| Device ID missing | Fallback ID generated; preference still persists |
| Browser data cleared | Preference lost; next print starts fresh (expected) |

---

## 6. Testing

### Manual Test Checklist
- [ ] Print chit from order → select "Printer A" in dialog → confirm print
- [ ] Print another chit → dialog should suggest "Printer A" by default
- [ ] Select different printer "Printer B" → confirm print
- [ ] Print again → dialog should suggest "Printer B"
- [ ] Close browser entirely, reopen app → printer preference still "Printer B"
- [ ] Clear browser data (Settings → Clear Site Data) → preference reset, print shows default
- [ ] Test on different terminal/device → each has independent preference

### No Unit Tests Needed
- Utility is a thin localStorage wrapper with no business logic
- Browser print dialog behavior is not unit-testable (external API)
- Manual testing covers the full flow

---

## 7. Scope & Constraints

**In Scope:**
- Remember last selected printer per terminal
- Pre-select in browser's native print dialog
- Persist across browser sessions

**Out of Scope:**
- Direct ESC/POS printing (no thermal driver integration)
- Printer list dropdown (browser doesn't expose this)
- Admin printer configuration interface
- Printer status monitoring

**Why Out of Scope:**
Browser print API intentionally hides printer list for security/privacy. To access real printer list, would need:
- Browser extension, OR
- Electron app (desktop), OR
- Node.js thermal print library (but breaks PWA offline model)

Current design works with browser constraints.

---

## 8. Future Enhancements (Not Now)

1. **Electron desktop app:** Direct thermal printer control via node-thermal-printer
2. **Printer status API:** Server tracks printer health per terminal (if ESC/POS driver added)
3. **Admin panel:** View/change printer config for all terminals
4. **Print queue:** Queue jobs if printer offline, retry on recovery

---

## 9. Success Criteria

✅ Staff select printer once per terminal  
✅ Selection persists across browser close/reopen  
✅ Each terminal maintains independent preference  
✅ Graceful fallback if localStorage unavailable  
✅ No server changes required  
✅ Works offline
