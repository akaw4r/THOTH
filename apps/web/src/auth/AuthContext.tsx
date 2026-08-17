import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { MeResponse, SessionUser } from '@thoth/shared';
import { api } from '../api/client';

interface AuthState {
  user: SessionUser | null;
  localAdminEnabled: boolean;
  loading: boolean;
  refresh: () => Promise<MeResponse>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [localAdminEnabled, setLocalAdminEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const me = await api.me();
    setUser(me.user);
    setLocalAdminEnabled(me.localAdminEnabled);
    return me;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    setUser(null);
    await refresh().catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    refresh()
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [refresh]);

  const value = useMemo(
    () => ({ user, localAdminEnabled, loading, refresh, logout }),
    [user, localAdminEnabled, loading, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
