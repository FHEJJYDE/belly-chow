import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Location {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface LocationContextType {
  location: Location | null;
  error: string | null;
  loading: boolean;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role } = useAuth();
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const lastUpdated = useRef<number>(0);
  const activeOrderRef = useRef<string | null>(null);

  // 1. Fetch current active order to update
  useEffect(() => {
    if (!user) {
      activeOrderRef.current = null;
      return;
    }

    const fetchActiveOrder = async () => {
      try {
        if (role === 'rider') {
          const { data } = await supabase
            .from('orders')
            .select('id')
            .eq('rider_id', user.id)
            .in('status', ['accepted', 'preparing', 'ready', 'picked_up', 'delivering', 'arrived'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          activeOrderRef.current = data?.id || null;
        } else if (role === 'student') {
          const { data } = await supabase
            .from('orders')
            .select('id')
            .eq('student_id', user.id)
            .in('status', ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'delivering', 'arrived'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          activeOrderRef.current = data?.id || null;
        }
      } catch (err) {
        console.error('Error fetching active order for location tracking:', err);
      }
    };

    fetchActiveOrder();

    // Subscribe to database changes to update the active order in real time
    const channel = supabase
      .channel('location-order-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => fetchActiveOrder()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role]);

  // 2. Track GPS continuously
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    let watchId: number | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const handleSuccess = async (pos: GeolocationPosition) => {
      if (!active) return;
      const coords = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };

      setLocation(coords);
      setLoading(false);
      setError(null);

      // Throttled database update (once every 4 seconds)
      const now = Date.now();
      if (now - lastUpdated.current < 4000) return;
      lastUpdated.current = now;

      // Skip database update if simulating in Rider Dashboard
      const isSimulating = localStorage.getItem(`rider_sim_${activeOrderRef.current}`) === 'true';
      if (isSimulating && role === 'rider') return;

      if (user && activeOrderRef.current) {
        try {
          if (role === 'rider') {
            await supabase
              .from('orders')
              .update({
                rider_lat: coords.lat,
                rider_lng: coords.lng,
              } as any)
              .eq('id', activeOrderRef.current);
          } else if (role === 'student') {
            await supabase
              .from('orders')
              .update({
                delivery_lat: coords.lat,
                delivery_lng: coords.lng,
              } as any)
              .eq('id', activeOrderRef.current);
          }
        } catch (dbErr) {
          console.error('Error updating live location in database:', dbErr);
        }
      }
    };

    const startWatch = () => {
      if (!active) return;
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      watchId = navigator.geolocation.watchPosition(
        handleSuccess,
        (err) => {
          if (!active) return;
          switch (err.code) {
            case 1: setError('Location permission denied. Please allow access in browser settings.'); break;
            case 2:
              setError('GPS signal lost. Retrying…');
              retryTimer = setTimeout(() => startWatch(), 8000);
              break;
            case 3:
              setError('GPS timed out. Retrying…');
              retryTimer = setTimeout(() => startWatch(), 8000);
              break;
            default: setError(err.message);
          }
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
      );
    };

    // Immediately get a one-shot fix so the UI has coords right away
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      () => { /* ignore one-shot error; watch will handle it */ },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    startWatch();

    return () => {
      active = false;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [user, role]);

  return (
    <LocationContext.Provider value={{ location, error, loading }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useLocation must be used within LocationProvider');
  return context;
};
