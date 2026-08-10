import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { LogOut, Wifi, WifiOff, RefreshCw, Menu as MenuIcon, ChevronLeft } from 'lucide-react';
import { useApp } from '../auth/AppContext.jsx';
import { onSyncChange, flush } from '../db/syncEngine.js';

function SyncBadge() {
  const [state, setState] = useState({ online: navigator.onLine, pending: 0 });
  useEffect(() => onSyncChange(setState), []);

  if (!state.online) {
    return (
      <button className="chip bg-kumkum-500/15 text-kumkum-600 !px-3 !py-1.5 gap-1.5" onClick={flush} title="No server connection — tap to retry">
        <WifiOff size={13} /> Server offline{state.pending > 0 ? ` · ${state.pending} queued` : ''}
      </button>
    );
  }
  if (state.pending > 0) {
    return (
      <button className="chip bg-saffron-100 text-saffron-600 !px-3 !py-1.5 gap-1.5" onClick={flush} title="Tap to sync now">
        <RefreshCw size={13} className="animate-spin" /> {state.pending} pending
      </button>
    );
  }
  return (
    <span className="chip bg-leaf-600/15 text-leaf-700 !px-3 !py-1.5 gap-1.5">
      <Wifi size={13} /> Synced
    </span>
  );
}

export default function Layout() {
  const { user, logout, menu, settings } = useApp();
  const nav = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const pageTitle = menu.find((m) => m.path === '/' ? location.pathname === '/' : location.pathname.startsWith(m.path))?.label || '';
  const templeName = settings['temple.name'] || 'TMADJ Temple';
  const logo = settings['temple.logoUrl'];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky lg:top-0 lg:h-screen inset-y-0 left-0 z-40 ${collapsed ? 'w-16' : 'w-64'} flex flex-col transition-all duration-200 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`} style={{ backgroundColor: '#a6704e' }}>
        <div className={`py-5 flex flex-col items-center gap-2 border-b border-white/20 ${collapsed ? 'px-2' : 'px-5'}`}>
          {logo ? (
            <img src={logo} alt="" className={`${collapsed ? 'w-8 h-8' : 'w-14 h-14'} shrink-0 rounded-full object-contain ring-2 ring-gold-400 bg-cream-50 p-0.5 transition-all duration-200`} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <img src="/icons/diya.svg" alt="" className={`${collapsed ? 'w-8 h-8' : 'w-14 h-14'} shrink-0 rounded-full ring-2 ring-gold-400 bg-cream-50 p-2 transition-all duration-200`} />
          )}
          {!collapsed && (
            <div className="text-center">
              <p className="font-display text-cream-50 leading-tight break-words">{templeName}</p>
              <p className="text-[11px] text-gold-300 tracking-widest uppercase mt-0.5">Management</p>
            </div>
          )}
        </div>
        <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto">
          {menu.map((m) => {
            const Icon = Icons[m.icon] || Icons.Circle;
            return (
              <NavLink key={m.key} to={m.path} end={m.path === '/'}
                className={({ isActive }) => `side-link ${isActive ? 'side-link-active' : ''} ${collapsed ? '!justify-center !px-2 !gap-0' : ''}`}
                title={collapsed ? m.label : ''}
                onClick={() => setOpen(false)}>
                <Icon size={18} className="shrink-0" />
                {!collapsed && m.label}
              </NavLink>
            );
          })}
        </nav>
        <div className={`py-4 border-t border-white/20 flex items-center gap-2 ${collapsed ? 'justify-center px-2' : 'justify-between px-5'}`}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <img src="/icons/diya.svg" alt="" className="w-5 h-5 opacity-80" />
            </div>
          )}
          <button
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-cream-100 transition-colors shrink-0"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft size={14} className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 bg-maroon-950/40 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-cream-50/90 backdrop-blur border-b border-gold-300/50 px-4 lg:px-6 py-3 flex items-center gap-3">
          <button className="btn-ghost !p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><MenuIcon size={20} /></button>
          {pageTitle && <h1 className="text-lg font-display text-maroon-900 leading-tight">{pageTitle}</h1>}
          <div className="flex-1" />
          <SyncBadge />
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-maroon-900 leading-tight">{user?.name}</p>
            <p className="text-xs text-ink-600">{user?.role}</p>
          </div>
          <button className="btn-ghost !p-2" title="Log out" onClick={() => { logout(); nav('/login'); }}><LogOut size={18} /></button>
        </header>
        <main className="flex-1 p-4 lg:p-6 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
