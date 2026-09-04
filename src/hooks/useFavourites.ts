import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useFavourites() {
  const { user } = useAuth();
  const storageKey = `bellychow_favs_${user?.id || 'guest'}`;

  const [favouriteVendorIds, setFavouriteVendorIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const fetchFavs = async () => {
      try {
        const { data, error } = await (supabase.from('favourites') as any)
          .select('vendor_id')
          .eq('user_id', user.id);
        
        if (!error && data) {
          const dbFavs = (data || []).map((f: any) => f.vendor_id);
          setFavouriteVendorIds(prev => {
            const merged = new Set([...Array.from(prev), ...dbFavs]);
            try { localStorage.setItem(storageKey, JSON.stringify(Array.from(merged))); } catch {}
            return merged;
          });
        }
      } catch (err) {
        console.warn('Supabase favourites fetch skipped/failed, using local storage fallback:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFavs();
  }, [user, storageKey]);

  const toggleFavourite = useCallback(async (vendorId: string) => {
    const isFav = favouriteVendorIds.has(vendorId);
    const nextSet = new Set(favouriteVendorIds);
    if (isFav) {
      nextSet.delete(vendorId);
    } else {
      nextSet.add(vendorId);
    }
    
    // Update local state and localStorage instantly
    setFavouriteVendorIds(nextSet);
    try { localStorage.setItem(storageKey, JSON.stringify(Array.from(nextSet))); } catch {}

    if (!user) return;

    try {
      if (isFav) {
        await (supabase.from('favourites') as any).delete().eq('user_id', user.id).eq('vendor_id', vendorId);
      } else {
        await (supabase.from('favourites') as any).insert({ user_id: user.id, vendor_id: vendorId });
      }
    } catch (err) {
      console.warn('Supabase favourite toggle background sync error:', err);
    }
  }, [user, favouriteVendorIds, storageKey]);

  const isFavourite = useCallback((vendorId: string) => favouriteVendorIds.has(vendorId), [favouriteVendorIds]);

  return { favouriteVendorIds, isFavourite, toggleFavourite, loading };
}
