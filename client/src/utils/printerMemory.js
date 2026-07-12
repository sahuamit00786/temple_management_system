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
