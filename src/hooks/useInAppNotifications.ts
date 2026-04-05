import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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
    const [notifications, setNotifications] = useState<InAppNotification[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch notifications
    const fetchNotifications = useCallback(async () => {
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setNotifications(data || []);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Mark notification as read
    const markAsRead = useCallback(async (notificationId: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notificationId);

            if (error) throw error;

            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
            );
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }, []);

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
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }, [user]);
    // Real-time subscription
    useEffect(() => {
        if (!user) return;

        fetchNotifications();

        // Subscribe to new notifications
        const channel = supabase
            .channel('user-notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    const newNotification = payload.new as InAppNotification;
                    setNotifications(prev => [newNotification, ...prev]);

                    // Show toast notification as fallback
                    toast({
                        title: newNotification.title,
                        description: newNotification.message,
                        duration: 5000,
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    const updatedNotification = payload.new as InAppNotification;
                    setNotifications(prev =>
                        prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, fetchNotifications]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        refetch: fetchNotifications,
    };
}