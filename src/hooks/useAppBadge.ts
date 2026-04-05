import { useEffect } from 'react';

// App Badge API for PWA notification badges
declare global {
    interface Navigator {
        setAppBadge?: (count?: number) => Promise<void>;
        clearAppBadge?: () => Promise<void>;
    }
}

export function useAppBadge() {
    const isSupported = 'setAppBadge' in navigator;

    const setBadge = async (count: number) => {
        if (!isSupported) {
            console.log('App Badge API not supported');
            return;
        }

        try {
            console.log('Setting app badge to:', count);
            if (count > 0) {
                await navigator.setAppBadge!(count);
                console.log('App badge set successfully to:', count);
            } else {
                await navigator.clearAppBadge!();
                console.log('App badge cleared successfully');
            }
        } catch (error) {
            console.warn('Failed to set app badge:', error);
        }
    };

    const clearBadge = async () => {
        if (!isSupported) return;

        try {
            await navigator.clearAppBadge!();
        } catch (error) {
            console.warn('Failed to clear app badge:', error);
        }
    };

    // Clear badge when app becomes visible (user opens the app)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                console.log('App became visible, will clear badge after delay');
                // Only clear badge if user actually interacts with notifications
                // Don't auto-clear just because app becomes visible
                // setTimeout(clearBadge, 2000);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    return {
        setBadge,
        clearBadge,
        isSupported
    };
}