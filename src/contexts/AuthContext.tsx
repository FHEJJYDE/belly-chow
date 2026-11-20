import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Enums } from '@/integrations/supabase/types';

type AppRole = Enums<'app_role'>;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: AppRole,
    vendorName?: string
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROLE_CACHE_PREFIX = 'belly_chow_role_';

const getCachedRole = (userId: string, userMetaRole?: string): AppRole | null => {
  try {
    const cached = localStorage.getItem(`${ROLE_CACHE_PREFIX}${userId}`);
    if (cached && ['student', 'vendor', 'rider', 'admin'].includes(cached)) {
      return cached as AppRole;
    }
  } catch {
    /* ignore */
  }
  if (userMetaRole && ['student', 'vendor', 'rider', 'admin'].includes(userMetaRole)) {
    return userMetaRole as AppRole;
  }
  return null;
};

const setCachedRole = (userId: string, userRole: AppRole) => {
  try {
    localStorage.setItem(`${ROLE_CACHE_PREFIX}${userId}`, userRole);
  } catch {
    /* ignore */
  }
};

// Helper: nuke all Supabase auth keys and role cache from localStorage
const clearSupabaseStorage = () => {
  try {
    Object.keys(localStorage)
      .filter((k) => k === 'belly_chow_auth_token' || k.startsWith('sb-') || k.startsWith(ROLE_CACHE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch (_) {
    /* ignore SSR / private-browsing edge cases */
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const isSigningOut = React.useRef(false);

  const fetchRole = async (userId: string, fallbackMetaRole?: string): Promise<AppRole> => {
    // 1. Hydrate immediately from cache / JWT metadata so UI never blocks on DB latency
    const instantRole = getCachedRole(userId, fallbackMetaRole);
    if (instantRole) {
      setRole(instantRole);
    }

    // 2. Verify authoritative role from database in parallel/background
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (profile?.role) {
        const verifiedRole = profile.role as AppRole;
        setRole(verifiedRole);
        setCachedRole(userId, verifiedRole);
        return verifiedRole;
      }

      const { data: rpcRole, error } = await supabase.rpc('get_user_role', { _user_id: userId });
      if (!error && rpcRole) {
        const verifiedRole = rpcRole as AppRole;
        setRole(verifiedRole);
        setCachedRole(userId, verifiedRole);
        return verifiedRole;
      }

      const finalFallback = instantRole || ('student' as AppRole);
      setRole(finalFallback);
      setCachedRole(userId, finalFallback);
      return finalFallback;
    } catch (error) {
      console.error('Error fetching user role:', error);
      const fallback = instantRole || ('student' as AppRole);
      setRole(fallback);
      return fallback;
    }
  };

  // Initialize auth state on app start
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
          if (isMounted) {
            setLoading(false);
            setInitialized(true);
          }
          return;
        }

        if (isMounted) {
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            const cached = getCachedRole(session.user.id, session.user.user_metadata?.role);
            if (cached) {
              // Unblock page rendering immediately (<5ms) while verifying DB role in background
              setRole(cached);
              setLoading(false);
              setInitialized(true);
              fetchRole(session.user.id, session.user.user_metadata?.role);
              return;
            }
            await fetchRole(session.user.id, session.user.user_metadata?.role);
          } else {
            setRole(null);
          }

          setLoading(false);
          setInitialized(true);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (isMounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    if (!initialized) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (isSigningOut.current) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const cached = getCachedRole(session.user.id, session.user.user_metadata?.role);
        if (cached) {
          setRole(cached);
          if (event !== 'INITIAL_SESSION') setLoading(false);
          fetchRole(session.user.id, session.user.user_metadata?.role);
          return;
        }
        await fetchRole(session.user.id, session.user.user_metadata?.role);
      } else {
        setRole(null);
      }

      if (event !== 'INITIAL_SESSION') {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [initialized]);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    selectedRole: AppRole,
    vendorName?: string
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role: selectedRole },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    if (!data.user) throw new Error('Signup failed');

    const { error: signupError } = await supabase.rpc('handle_user_signup', {
      user_id: data.user.id,
      user_role: selectedRole,
      vendor_name: vendorName || null,
    });
    if (signupError) throw signupError;

    setCachedRole(data.user.id, selectedRole);
    if (data.session) {
      setUser(data.user);
      setSession(data.session);
    } else {
      setUser(data.user);
    }
    setRole(selectedRole);
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) {
      setUser(data.user);
      setSession(data.session);
      await fetchRole(data.user.id, data.user.user_metadata?.role);
    }
  };

  const signOut = async () => {
    isSigningOut.current = true;
    try {
      setUser(null);
      setSession(null);
      setRole(null);

      await supabase.auth.signOut({ scope: 'local' }).catch((err) => {
        console.warn('Supabase signOut network error (local session will still be cleared):', err);
      });
    } catch (err) {
      console.error('Error during sign out:', err);
    } finally {
      clearSupabaseStorage();
      setUser(null);
      setSession(null);
      setRole(null);
      setLoading(false);
      setTimeout(() => {
        isSigningOut.current = false;
      }, 500);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
