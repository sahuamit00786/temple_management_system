// Fetch wrapper with JWT + auto-refresh + full localStorage API cache
import API_HOST from '../config.js';
const API_BASE = API_HOST.replace(/\/$/, '') + '/api/v1';
const CACHE_PFX = 'tmadj.apicache.';

let accessToken = localStorage.getItem('tmadj.access');
let refreshToken = localStorage.getItem('tmadj.refresh');

export function setTokens(a, r) {
  accessToken = a; refreshToken = r;
  if (a) localStorage.setItem('tmadj.access', a); else localStorage.removeItem('tmadj.access');
  if (r) localStorage.setItem('tmadj.refresh', r); else localStorage.removeItem('tmadj.refresh');
}
export function getAccessToken() { return accessToken; }

// ── localStorage API cache ──────────────────────────────────────────────────
function cacheWrite(key, data) {
  try {
    const str = JSON.stringify({ data, ts: Date.now() });
    if (str.length > 600 * 1024) return; // skip single responses > 600 KB
    try {
      localStorage.setItem(CACHE_PFX + key, str);
    } catch {
      // Quota exceeded — evict oldest half then retry
      const entries = Object.keys(localStorage)
        .filter((k) => k.startsWith(CACHE_PFX))
        .map((k) => { try { return { k, ts: JSON.parse(localStorage.getItem(k)).ts }; } catch { return { k, ts: 0 }; } })
        .sort((a, b) => a.ts - b.ts);
      entries.slice(0, Math.ceil(entries.length / 2)).forEach(({ k }) => localStorage.removeItem(k));
      try { localStorage.setItem(CACHE_PFX + key, str); } catch {}
    }
  } catch {}
}

function cacheRead(key) {
  try {
    const raw = localStorage.getItem(CACHE_PFX + key);
    if (!raw) return null;
    return JSON.parse(raw).data;
  } catch { return null; }
}

// ── Token refresh ───────────────────────────────────────────────────────────
async function refresh() {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error('refresh failed');
  const data = await res.json();
  setTokens(data.accessToken, data.refreshToken);
}

export async function api(path, { method = 'GET', body, formData } = {}) {
  const doFetch = () => fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(formData ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: formData || (body ? JSON.stringify(body) : undefined),
  });

  try {
    let res = await doFetch();
    if (res.status === 401 && refreshToken) {
      try { await refresh(); res = await doFetch(); }
      catch { setTokens(null, null); window.location.href = '/login'; throw new Error('Session expired'); }
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);

    // Cache every successful GET response
    if (method === 'GET') cacheWrite(path, data);

    return data;
  } catch (e) {
    // Network failure on a GET — serve stale cache if available
    if (method === 'GET') {
      const cached = cacheRead(path);
      if (cached !== null) return cached;
    }
    throw e;
  }
}

export function assetUrl(path) {
  if (!path) return path;
  if (path.startsWith('http')) return path;
  return API_HOST + path;
}

export function qs(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== '' && v != null) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}
