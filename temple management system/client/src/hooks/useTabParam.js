import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

// Tab state kept in the URL (?tab=key by default). Other query params are preserved.
// `valid` = allowed keys (anything else falls back to `def`); pass null for dynamic tabs.
export function useTabParam(def, valid = null, param = 'tab') {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(param);
  const tab = raw && (!valid || valid.includes(raw)) ? raw : def;

  const setTab = useCallback((key) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (key) next.set(param, key); else next.delete(param);
      return next;
    }, { replace: true });
  }, [setSearchParams, param]);

  return [tab, setTab];
}
