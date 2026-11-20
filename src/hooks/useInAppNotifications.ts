import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAppBadge } from '@/hooks/useAppBadge';

export interface InAppNotification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: string;
    order_id: string | null;
    is_read: boolean;
    created_at: string;
}

export function useInAppNotifications() {
    const { user } = useAuth();
    const { setBadge } = useAppBadge();
    const [notifications, setNotifications] = useState<InAppNotification[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch notifications
    const fetchNotifications = useCallback(async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            const newNotifications = data || [];
            const newUnreadCount = newNotifications.filter(n => !n.is_read).length;

            // Update badge immediately when new notifications are fetched
            setBadge(newUnreadCount);

            setNotifications(newNotifications);
        } catch (error) {
            console.error('Error fetching notifications:', error);
            setNotifications([]);
        } finally {
            setLoading(false);
        }
    }, [user, setBadge]);

    // Mark notification as read
    const markAsRead = useCallback(async (notificationId: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notificationId);

            if (error) throw error;

            setNotifications(prev => {
                const updated = prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n);
                const newUnreadCount = updated.filter(n => !n.is_read).length;
                setBadge(newUnreadCount);
                return updated;
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }, [setBadge]);

    // Mark all as read
    const markAllAsRead = useCallback(async () => {
        if (!user) return;

        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', user.id)
                .eq('is_read', false);

            if (error) throw error;

            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setBadge(0); // Clear badge when all notifications are read
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }, [user, setBadge]);

    // Initial fetch, Realtime subscription, and 8s periodic refresh
    useEffect(() => {
        if (!user) return;

        fetchNotifications();

        const channelId = `in-app-notifs-${user.id}-${Math.random().toString(36).slice(2, 8)}`;
        let channel: any = null;
        try {
            channel = supabase
                .channel(channelId)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
                    () => fetchNotifications()
                )
                .subscribe();
        } catch (err) {
            console.warn('Realtime notification channel warning:', err);
        }

        // Realtime pushes updates instantly; keep a lightweight 45s safety fallback only while tab is visible
        const interval = setInterval(() => {
            if (!document.hidden) fetchNotifications();
        }, 45_000);

        const handleVisibilityChange = () => {
            if (!document.hidden) fetchNotifications();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (channel) {
                supabase.removeChannel(channel).catch(() => {});
            }
            clearInterval(interval);
        };
    }, [user, fetchNotifications]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    // Update app badge when unread count changes
    useEffect(() => {
        setBadge(unreadCount);
    }, [unreadCount, setBadge]);

    return {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        refetch: fetchNotifications,
    };
}