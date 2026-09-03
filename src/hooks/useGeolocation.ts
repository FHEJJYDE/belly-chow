import { useState, useEffect, useCallback, useRef } from 'react';

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy?: number; // metres
}

/**
 * Provides one-shot and continuous (watch) geolocation.
 *
 * @param watch       When true, subscribes to watchPosition for live updates.
 * @param throttleMs  Minimum ms between position state updates (default 4000ms).
 */
export const useGeolocation = (watch = false, throttleMs = 4000) => {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);
  const lastEmittedAt = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check browser permission state (Chrome/Firefox)
  useEffect(() => {
    if (!navigator.permissions) return;
    navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
      setPermissionState(result.state);
      result.onchange = () => setPermissionState(result.state);
    }).catch(() => {});
  }, []);

  const applyPosition = useCallback((pos: GeolocationPosition, forceEmit = false) => {
    const now = Date.now();
    if (!forceEmit && now - lastEmittedAt.current < throttleMs) return;
    lastEmittedAt.current = now;
    setError(null);
    setLoading(false);
    setPosition({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    });
  }, [throttleMs]);

  /** One-shot position request — always emits regardless of throttle */
  const getPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => applyPosition(pos, true),
      (err) => {
        // High-accuracy GPS failed or timed out (common on desktop/laptops without GPS hardware)
        // Fallback to standard network/IP location
        if (err.code === 3 || err.code === 2) {
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => applyPosition(fallbackPos, true),
            (fallbackErr) => {
              setLoading(false);
              switch (fallbackErr.code) {
                case 1: setError('Location permission denied. Please allow location access in your browser settings.'); break;
                case 2: setError('Location unavailable. Check your device GPS or network connection.'); break;
                case 3: setError('Location request timed out. Please type your delivery address manually.'); break;
                default: setError(fallbackErr.message);
              }
            },
            { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
          );
          return;
        }

        setLoading(false);
        switch (err.code) {
          case 1: setError('Location permission denied. Please allow location access in your browser settings.'); break;
          case 2: setError('Location unavailable. Check your device GPS or network connection.'); break;
          case 3: setError('Location request timed out. Please type your delivery address manually.'); break;
          default: setError(err.message);
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  }, [applyPosition]);

  /** Start/restart the continuous watchPosition subscription */
  const startWatch = useCallback(() => {
    if (!navigator.geolocation) return;
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => applyPosition(pos),
      (err) => {
        if (err.code === 3 || err.code === 2) {
          // Fallback watch with standard accuracy
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
          }
          watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => applyPosition(pos),
            (fallbackErr) => {
              if (fallbackErr.code === 1) setError('Location permission denied.');
            },
            { enableHighAccuracy: false, maximumAge: 10000 }
          );
          return;
        }
        if (err.code === 1) setError('Location permission denied. Allow access to enable live tracking.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, [applyPosition]);

  useEffect(() => {
    if (!watch || !navigator.geolocation) {
      if (!navigator.geolocation) {
        setError('Geolocation is not supported by your browser');
        setLoading(false);
      }
      return;
    }

    // Kick off an immediate one-shot so UI has a fix right away
    getPosition();
    startWatch();

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [watch]); // eslint-disable-line react-hooks/exhaustive-deps

  return { position, error, loading, permissionState, getPosition };
};
