import { useState, useEffect, useCallback, useRef } from 'react';

interface GeoPosition {
  lat: number;
  lng: number;
  accuracy?: number; // metres
}

/**
 * Provides one-shot and continuous (watch) geolocation.
 *
 * @param watch  When true, subscribes to watchPosition for live updates.
 * @param throttleMs  Minimum milliseconds between position state updates (default 4000ms).
 *                    Prevents hammering Supabase with every tiny GPS twitch.
 */
export const useGeolocation = (watch = false, throttleMs = 4000) => {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lastEmittedAt = useRef<number>(0);

  const emitPosition = useCallback((pos: GeolocationPosition) => {
    const now = Date.now();
    // Throttle: only emit if enough time has passed since last emission
    if (now - lastEmittedAt.current < throttleMs) return;
    lastEmittedAt.current = now;
    setPosition({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    });
  }, [throttleMs]);

  const getPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // One-shot always emits regardless of throttle
        lastEmittedAt.current = Date.now();
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, []);

  useEffect(() => {
    if (!watch || !navigator.geolocation) return;

    // Immediately get a fix so the UI isn't blank on first render
    getPosition();

    const watchId = navigator.geolocation.watchPosition(
      emitPosition,
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 3000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [watch, getPosition, emitPosition]);

  return { position, error, loading, getPosition };
};
