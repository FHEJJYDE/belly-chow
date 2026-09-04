import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Enums } from '@/integrations/supabase/types';

type AppRole = Enums<"app_role">;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, role: AppRole, vendorName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper: nuke all Supabase auth keys from localStorage
const clearSupabaseStorage = () => {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sb-'))
      .forEach((k) => localStorage.removeItem(k));
  } catch (_) { /* ignore SSR / private-browsing edge cases */ }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  // Prevents the onAuthStateChange listener from re-hydrating during sign-out
  const isSigningOut = React.useRef(false);

  const fetchRole = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_user_role', { _user_id: userId });
      if (!error && data) {
        setRole(data as AppRole);
        return data as AppRole;
      }
      const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', userId).maybeSingle();
      const userRole = (profile?.role as AppRole) || 'student';
      setRole(userRole);
      return userRole;
    } catch (error) {
      console.error('Error fetching user role:', error);
      setRole('student');
      return 'student' as AppRole;
    }
  };

  // Initialize auth state on app start
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

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
            await fetchRole(session.user.id);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Ignore all events fired while we are deliberately signing out
      if (isSigningOut.current) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchRole(session.user.id);
      } else {
        setRole(null);
      }

      if (event !== 'INITIAL_SESSION') {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [initialized]);

  const signUp = async (email: string, password: string, fullName: string, selectedRole: AppRole, vendorName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
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

    setRole(selectedRole);
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) {
      setUser(data.user);
      setSession(data.session);
      await fetchRole(data.user.id);
    }
  };

  const signOut = async () => {
    isSigningOut.current = true;
    try {
      // Clear React state first so UI responds immediately
      setUser(null);
      setSession(null);
      setRole(null);

      // Try to invalidate the server-side session
      await supabase.auth.signOut({ scope: 'local' }).catch((err) => {
        console.warn('Supabase signOut network error (local session will still be cleared):', err);
      });
    } catch (err) {
      console.error('Error during sign out:', err);
    } finally {
      // Force-clear ALL Supabase keys from localStorage regardless of API outcome
      clearSupabaseStorage();
      setUser(null);
      setSession(null);
      setRole(null);
      setLoading(false);
      // Keep the flag true — reset after a tick so any in-flight events are dropped
      setTimeout(() => { isSigningOut.current = false; }, 500);
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
