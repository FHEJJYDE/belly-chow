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

            // Log for debugging
            console.log('Fetched notifications:', newNotifications.length, 'unread:', newUnreadCount);

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

    // Initial fetch and periodic refresh (fallback for realtime)
    useEffect(() => {
        if (!user) return;

        fetchNotifications();

        // Refresh notifications every 30 seconds as fallback
        const interval = setInterval(fetchNotifications, 30000);

        return () => {
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