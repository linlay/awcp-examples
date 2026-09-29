import { useCallback, useEffect, useState } from 'react';

export interface BrowserPath {
  readonly pathname: string;
  navigate(path: string): void;
}

export function useBrowserPath(): BrowserPath {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const syncPath = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, []);

  const navigate = useCallback((path: string) => {
    if (window.location.pathname === path) return;
    window.history.pushState(null, '', path);
    setPathname(window.location.pathname);
  }, []);

  return { pathname, navigate };
}
