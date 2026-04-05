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
        if (!isSupported) return;

        try {
            if (count > 0) {
                await navigator.setAppBadge!(count);
            } else {
                await navigator.clearAppBadge!();
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
                // Small delay to allow notifications to be marked as read
                setTimeout(clearBadge, 1000);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Clear badge on initial load if app is visible
        if (!document.hidden) {
            setTimeout(clearBadge, 1000);
        }

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