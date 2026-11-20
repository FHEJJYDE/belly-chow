import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useAppBadge } from '@/hooks/useAppBadge';

function showNativeOsPopup(title: string, body: string, url: string, tag: string) {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }

    const options: any = {
        body,
        icon: '/belly_chow_logo.png',
        badge: '/belly_chow_logo.png',
        vibrate: [200, 100, 200],
        tag,
        renotify: true,
        requireInteraction: false,
        silent: false,
        data: { url },
    };

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
            if (reg && 'showNotification' in reg) {
                reg.showNotification(title, options).catch(() => {
                    try { new Notification(title, options); } catch {}
                });
            } else {
                try { new Notification(title, options); } catch {}
            }
        }).catch(() => {
            try { new Notification(title, options); } catch {}
        });
    } else {
        try { new Notification(title, options); } catch {}
    }
}

export function useBackgroundNotifications() {
    const { user, role } = useAuth();
    const { setBadge } = useAppBadge();
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const seenNotifIds = useRef<Set<string>>(new Set());
    const initialized = useRef<boolean>(false);

    useEffect(() => {
        if (!user) return;
        seenNotifIds.current.clear();
        initialized.current = false;

        const getTargetUrl = () => {
            if (role === 'vendor') return '/vendor-panel/orders';
            if (role === 'rider') return '/dashboard';
            if (role === 'admin') return '/admin/orders';
            return '/orders';
        };

        const checkNotifications = async () => {
            try {
                const { data, error } = await supabase
                    .from('notifications')
                    .select('id, title, message, order_id, is_read, created_at')
                    .eq('user_id', user.id)
                    .eq('is_read', false)
                    .order('created_at', { ascending: false })
                    .limit(25);

                if (error) throw error;

                const unreadList = data || [];
                setBadge(unreadList.length);

                if (!initialized.current) {
                    // Seed existing unread notifications on initial boot so we don't spam old popups
                    unreadList.forEach((n) => seenNotifIds.current.add(n.id));
                    initialized.current = true;
                    return;
                }

                // Trigger native OS banner pop-up for any brand-new unread notifications (especially when tab is minimized/hidden!)
                unreadList.forEach((n) => {
                    if (!seenNotifIds.current.has(n.id)) {
                        seenNotifIds.current.add(n.id);
                        // If the tab is in the background/hidden, always pop up a native OS notification
                        if (document.hidden) {
                            showNativeOsPopup(
                                n.title || 'Belly-Chow Update',
                                n.message || 'You have a new order notification.',
                                n.order_id ? getTargetUrl() : '/notifications',
                                `notif-${n.id}`
                            );
                        }
                    }
                });
            } catch (error) {
                console.error('Background notification check failed:', error);
            }
        };

        checkNotifications();

        // Realtime subscription delivers new notifications instantly with zero polling load
        const channelId = `bg-notifs-${user.id}-${Math.random().toString(36).slice(2, 8)}`;
        let channel: any = null;
        try {
            channel = supabase
                .channel(channelId)
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
                    (payload) => {
                        const n = payload.new as any;
                        if (n && !seenNotifIds.current.has(n.id)) {
                            seenNotifIds.current.add(n.id);
                            if (document.hidden) {
                                showNativeOsPopup(
                                    n.title || 'Belly-Chow Update',
                                    n.message || 'You have a new order notification.',
                                    n.order_id ? getTargetUrl() : '/notifications',
                                    `notif-${n.id}`
                                );
                            }
                        }
                        checkNotifications();
                    }
                )
                .subscribe();
        } catch (err) {
            console.warn('Background notifications channel warning:', err);
        }

        // Lightweight 45s safety fallback (down from 8s to cut DB traffic by >80% at scale)
        intervalRef.current = setInterval(checkNotifications, 45_000);

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                checkNotifications();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (channel) {
                supabase.removeChannel(channel).catch(() => {});
            }
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user, role, setBadge]);
}