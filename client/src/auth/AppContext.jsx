import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setTokens, getAccessToken, assetUrl } from '../api/client.js';
import { mirrorLookups, readLookups, mirrorSettings, readSettings, mirrorDevotees, mirrorBookings } from '../db/dexie.js';
import { onSyncChange } from '../db/syncEngine.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booted, setBooted] = useState(false);
  const [lookups, setLookups] = useState({});
  const [settings, setSettings] = useState({});
  const [menu, setMenu] = useState([]);
  const [online, setOnline] = useState(true);

  useEffect(() => onSyncChange(({ online }) => setOnline(online)), []);

  // Pull master data online; fall back to the Dexie mirror offline
  const refreshMasterData = useCallback(async () => {
    try {
      const [lk, st, mn, devs, bkgs] = await Promise.all([
        api('/lookups'),
        api('/settings'),
        api('/menu'),
        api('/devotees?pageSize=1000&sortBy=name&sortOrder=asc').catch(() => null),
        api('/bookings?pageSize=300&sortBy=eventDate&sortOrder=desc').catch(() => null),
      ]);
      const st2 = Object.fromEntries(Object.entries(st).map(([k, v]) => [k, typeof v === 'string' && v.startsWith('/uploads/') ? assetUrl(v) : v]));
      setLookups(lk); setSettings(st2); setMenu(mn);
      mirrorLookups(lk); mirrorSettings(st2);
      localStorage.setItem('tmadj.menu', JSON.stringify(mn));
      if (devs) mirrorDevotees(devs.rows || []);
      if (bkgs) mirrorBookings(bkgs.rows || []);
    } catch {
      setLookups(await readLookups());
      setSettings(await readSettings());
      setMenu(JSON.parse(localStorage.getItem('tmadj.menu') || '[]'));
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (getAccessToken()) {
        // Trust the cached session immediately — screen shows right away,
        // token present is enough. Server check below only refreshes it;
        // failure (offline/server down) never kicks back to /login.
        const cached = localStorage.getItem('tmadj.user');
        if (cached) setUser(JSON.parse(cached));
        setLookups(await readLookups());
        setSettings(await readSettings());
        setMenu(JSON.parse(localStorage.getItem('tmadj.menu') || '[]'));
        setBooted(true);
        try {
          const me = await api('/auth/me');
          setUser(me);
          localStorage.setItem('tmadj.user', JSON.stringify(me));
          await refreshMasterData();
        } catch {
          // offline or server unreachable — stay on cached user, token untouched
        }
        return;
      }
      setBooted(true);
    })();
  }, [refreshMasterData]);

  const login = async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    localStorage.setItem('tmadj.user', JSON.stringify(data.user));
    await refreshMasterData();
  };

  const logout = () => {
    setTokens(null, null);
    localStorage.removeItem('tmadj.user');
    setUser(null);
  };

  const can = (menuKey, action = 'view') => {
    if (!user) return false;
    if (user.role === 'Superadmin') return true;
    return Boolean(user.permissions?.[menuKey]?.[action]);
  };

  return (
    <Ctx.Provider value={{ user, booted, login, logout, can, lookups, settings, menu, online, refreshMasterData }}>
      {children}
    </Ctx.Provider>
  );
}
