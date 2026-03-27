import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '../utils/supabase/client';
import type { Session } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'teacher';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const ROLE_CACHE_KEY = 'nust_cached_user_roles';
const SEEDED_ADMIN_EMAILS = ['iumertahir12@gmail.com'];

function readRoleCache(): Record<string, User['role']> {
  try {
    const raw = localStorage.getItem(ROLE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeRoleCache(cache: Record<string, User['role']>) {
  localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify(cache));
}

function normalizeRole(role: any): User['role'] | null {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'admin' || normalized === 'teacher') return normalized;
  return null;
}

function resolveFallbackRole(sessionUser: any): User['role'] | null {
  return (
    normalizeRole(sessionUser?.user_metadata?.role)
    || normalizeRole(sessionUser?.raw_user_meta_data?.role)
    || normalizeRole(sessionUser?.app_metadata?.role)
    || null
  );
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const applySessionToken = (session: Session | null) => {
    if (session?.access_token) {
      sessionStorage.setItem('access_token', session.access_token);
    } else {
      sessionStorage.removeItem('access_token');
    }
  };

  const clearAuthState = () => {
    setUser(null);
    sessionStorage.removeItem('access_token');
  };

  const setUserWithCache = (nextUser: User) => {
    setUser(nextUser);
    const emailKey = String(nextUser.email || '').toLowerCase();
    if (!emailKey) return;
    const cache = readRoleCache();
    cache[emailKey] = nextUser.role;
    writeRoleCache(cache);
  };

  const loadUserProfile = async (
    userId: string,
    fallbackEmail: string,
    fallbackRole: User['role'] | null,
    fallbackName?: string
  ) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', userId)
      .single();

    if (error || !data || !data.role || !['admin', 'teacher'].includes(data.role)) {
      if (fallbackRole) {
        setUserWithCache({
          id: userId,
          email: fallbackEmail,
          name: fallbackName || fallbackEmail,
          role: fallbackRole
        });
        return;
      }

      const cachedRole = readRoleCache()[String(fallbackEmail || '').toLowerCase()] || null;
      if (cachedRole) {
        setUserWithCache({
          id: userId,
          email: fallbackEmail,
          name: fallbackName || fallbackEmail,
          role: cachedRole
        });
        return;
      }

      if (error) {
        throw new Error('Unable to load user profile. Please contact administrator.');
      }

      throw new Error('Your role is not assigned. Please contact administrator.');
    }

    setUserWithCache({
      id: data.id,
      email: data.email || fallbackEmail,
      name: data.full_name || fallbackEmail,
      role: data.role
    });
  };

  const hydrateFromSession = async (session: Session | null) => {
    applySessionToken(session);

    if (!session?.user) {
      setUser(null);
      return;
    }

    const fallbackRole = resolveFallbackRole(session.user);
    const fallbackName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email || '';
    await loadUserProfile(session.user.id, session.user.email || '', fallbackRole, fallbackName);
  };

  useEffect(() => {
    let active = true;

    const init = async () => {
      setLoading(true);
      try {
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Auth session request timed out')), 10000);
          })
        ]);

        const { data, error } = sessionResult as Awaited<ReturnType<typeof supabase.auth.getSession>>;
        if (error) {
          throw new Error(error.message);
        }
        if (active) {
          await hydrateFromSession(data.session);
        }
      } catch (error) {
        if (active) {
          clearAuthState();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      // Run auth state hydration asynchronously to avoid blocking the auth event loop.
      void (async () => {
        try {
          if (event === 'SIGNED_OUT' || !session?.user) {
            clearAuthState();
            return;
          }

          await hydrateFromSession(session);
        } catch {
          // Avoid forced logout loops on transient fetch/RLS/network issues during token refresh.
          // Keep current session/user and let explicit sign-in flow handle hard failures.
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      })();
    });

    init();

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          throw new Error('Invalid email or password.');
        }
        if (error.message.toLowerCase().includes('email not confirmed')) {
          throw new Error('This teacher account exists but email is not confirmed. Ask admin to confirm the user in Supabase Authentication > Users, or disable email confirmations for this project.');
        }
        throw new Error(error.message);
      }

      try {
        await hydrateFromSession(data.session);
      } catch (profileError: any) {
        const normalizedEmail = String(data.session?.user?.email || email || '').toLowerCase();
        const metadataRole = resolveFallbackRole(data.session?.user);
        const cachedRole = readRoleCache()[normalizedEmail] || null;
        const emergencyRole: User['role'] | null =
          metadataRole
          || cachedRole
          || (SEEDED_ADMIN_EMAILS.includes(normalizedEmail) ? 'admin' : null);

        if (data.session?.user && emergencyRole) {
          applySessionToken(data.session);
          setUserWithCache({
            id: data.session.user.id,
            email: data.session.user.email || email,
            name: data.session.user.user_metadata?.full_name || data.session.user.user_metadata?.name || data.session.user.email || email,
            role: emergencyRole
          });
          return;
        }

        throw profileError;
      }
    } catch (error: any) {
      if (error instanceof TypeError) {
        throw new Error('Network error while contacting Supabase. Check URL, key, and internet connection.');
      }
      clearAuthState();
      throw new Error(error?.message || 'Login failed.');
    }
  };

  const signOut = async () => {
    let shouldWarn = false;

    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        shouldWarn = true;
      }
    } catch {
      shouldWarn = true;
    } finally {
      // Always clear local auth state so the UI can return to login even if remote sign-out fails.
      clearAuthState();
    }

    if (shouldWarn) {
      console.warn('Sign-out completed locally, but remote session revocation failed.');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
