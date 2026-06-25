'use client';

import { createContext, useContext, useMemo, useCallback } from 'react';
import { SessionProvider, signIn, signOut, useSession } from 'next-auth/react';

const AuthContext = createContext(null);

function AuthProviderInner({ children }) {
  const { data: session, status } = useSession();

  const user = useMemo(() => {
    if (session?.user) {
      return {
        // @ts-ignore
        uid: session.user.uid || session.user.email,
        name: session.user.name || session.user.email?.split('@')[0] || 'NeuralForge User',
        email: session.user.email || '',
        avatar_url: session.user.image || '',
      };
    }
    return null;
  }, [session]);

  const loading = status === 'loading';

  const login = useCallback(async (provider) => {
    if (provider === 'google') {
      return signIn('google', { callbackUrl: '/dashboard' });
    } else {
      throw new Error(`${provider} login is not supported yet.`);
    }
  }, []);

  const logout = useCallback(async () => {
    return signOut({ callbackUrl: '/' });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }) {
  return (
    <SessionProvider>
      <AuthProviderInner>{children}</AuthProviderInner>
    </SessionProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
