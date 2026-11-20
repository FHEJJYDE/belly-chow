import { useEffect, useCallback } from 'react';

// App Badge API for PWA notification badges
declare global {
    interface Navigator {
        setAppBadge?: (count?: number) => Promise<void>;
        clearAppBadge?: () => Promise<void>;
    }
}

export function useAppBadge() {
    const isSupported = typeof navigator !== 'undefined' && 'setAppBadge' in navigator;

    const setBadge = useCallback(async (count: number) => {
        if (!isSupported) return;

        try {
            if (count > 0) {
                await navigator.setAppBadge!(count);
            } else {
                await navigator.clearAppBadge!();
            }
        } catch {
            // Ignore badge errors on unsupported desktop browsers
        }
    }, [isSupported]);

    const clearBadge = useCallback(async () => {
        if (!isSupported) return;

        try {
            await navigator.clearAppBadge!();
        } catch {
            // Ignore
        }
    }, [isSupported]);

    useEffect(() => {
        // Keep listener lightweight
    }, []);

    return {
        setBadge,
        clearBadge,
        isSupported
    };
}