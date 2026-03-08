import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useFavourites() {
  const { user } = useAuth();
  const [favouriteVendorIds, setFavouriteVendorIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const fetch = async () => {
      const { data } = await (supabase.from('favourites') as any)
        .select('vendor_id')
        .eq('user_id', user.id);
      setFavouriteVendorIds(new Set((data || []).map((f: any) => f.vendor_id)));
      setLoading(false);
    };
    fetch();
  }, [user]);

  const toggleFavourite = useCallback(async (vendorId: string) => {
    if (!user) return;
    const isFav = favouriteVendorIds.has(vendorId);
    if (isFav) {
      await (supabase.from('favourites') as any).delete().eq('user_id', user.id).eq('vendor_id', vendorId);
      setFavouriteVendorIds(prev => { const next = new Set(prev); next.delete(vendorId); return next; });
    } else {
      await (supabase.from('favourites') as any).insert({ user_id: user.id, vendor_id: vendorId });
      setFavouriteVendorIds(prev => new Set([...prev, vendorId]));
    }
  }, [user, favouriteVendorIds]);

  const isFavourite = useCallback((vendorId: string) => favouriteVendorIds.has(vendorId), [favouriteVendorIds]);

  return { favouriteVendorIds, isFavourite, toggleFavourite, loading };
}
