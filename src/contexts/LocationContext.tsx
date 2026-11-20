import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getDistanceMeters } from '@/hooks/useCampusLocations';

interface Location {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface LocationContextType {
  location: Location | null;
  error: string | null;
  loading: boolean;
  isSharingLiveStudentGps: boolean;
  setIsSharingLiveStudentGps: (share: boolean) => void;
  requestCurrentLocation: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role } = useAuth();
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasActiveOrder, setHasActiveOrder] = useState(false);
  const [isSharingLiveStudentGps, setIsSharingLiveStudentGps] = useState(false);

  const lastUpdated = useRef<number>(0);
  const lastBroadcastCoords = useRef<{ lat: number; lng: number } | null>(null);
  const activeOrderRef = useRef<string | null>(null);

  // 1. Fetch current active order scoped strictly to the logged-in user (prevents 10k-user broadcast storm)
  useEffect(() => {
    if (!user || (role !== 'rider' && role !== 'student')) {
      activeOrderRef.current = null;
      setHasActiveOrder(false);
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
          setHasActiveOrder(Boolean(data?.id));
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
          setHasActiveOrder(Boolean(data?.id));
        }
      } catch (err) {
        console.error('Error fetching active order for location tracking:', err);
      }
    };

    fetchActiveOrder();

    // Filter realtime subscription strictly to this user's column so 10,000 students don't receive each other's events
    const filterColumn = role === 'rider' ? `rider_id=eq.${user.id}` : `student_id=eq.${user.id}`;
    const channel = supabase
      .channel(`location-order-sync-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: filterColumn },
        () => fetchActiveOrder()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role]);

  // One-shot manual GPS fix helper (with automatic fallback for indoor/desktop devices)
  const requestCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setError(null);
        setLoading(false);
      },
      (err) => {
        if (err.code === 3 || err.code === 2) {
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => {
              setLocation({
                lat: fallbackPos.coords.latitude,
                lng: fallbackPos.coords.longitude,
                accuracy: fallbackPos.coords.accuracy,
              });
              setError(null);
              setLoading(false);
            },
            (fallbackErr) => {
              setLoading(false);
              setError(fallbackErr.message || 'Unable to retrieve GPS position');
            },
            { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
          );
          return;
        }
        setLoading(false);
        setError(err.message || 'Unable to retrieve GPS position');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  }, []);

  // 2. Track continuous GPS ONLY for active riders (or students who explicitly opt into live walk tracking)
  // This prevents student live GPS from overwriting their chosen hostel/faculty coordinates!
  const shouldWatchContinuously =
    Boolean(user) &&
    hasActiveOrder &&
    (role === 'rider' || (role === 'student' && isSharingLiveStudentGps));

  useEffect(() => {
    if (!shouldWatchContinuously) {
      setLoading(false);
      return;
    }

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

      // Throttled database update (minimum 5 seconds AND at least 12 meters movement)
      const now = Date.now();
      if (now - lastUpdated.current < 5000) return;

      if (lastBroadcastCoords.current) {
        const movedMeters = getDistanceMeters(
          lastBroadcastCoords.current.lat,
          lastBroadcastCoords.current.lng,
          coords.lat,
          coords.lng
        );
        if (movedMeters < 12) return; // Skip redundant DB write if stationary
      }

      lastUpdated.current = now;
      lastBroadcastCoords.current = { lat: coords.lat, lng: coords.lng };

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
          } else if (role === 'student' && isSharingLiveStudentGps) {
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
            case 1:
              setError('Location permission denied. Please allow access in browser settings.');
              break;
            case 2:
            case 3:
              // Fallback watch with standard accuracy for indoor/desktop devices
              if (watchId !== null) navigator.geolocation.clearWatch(watchId);
              watchId = navigator.geolocation.watchPosition(
                handleSuccess,
                () => {
                  setError('GPS signal weak. Retrying…');
                  retryTimer = setTimeout(() => startWatch(), 8000);
                },
                { enableHighAccuracy: false, timeout: 20000, maximumAge: 15000 }
              );
              break;
            default:
              setError(err.message);
          }
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 4000 }
      );
    };

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      () => { /* watch will handle retry */ },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    startWatch();

    return () => {
      active = false;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [shouldWatchContinuously, user, role, isSharingLiveStudentGps]);

  return (
    <LocationContext.Provider
      value={{
        location,
        error,
        loading,
        isSharingLiveStudentGps,
        setIsSharingLiveStudentGps,
        requestCurrentLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useLocation must be used within LocationProvider');
  return context;
};
