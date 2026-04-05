import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useAppBadge } from '@/hooks/useAppBadge';

export function useBackgroundNotifications() {
    const { user } = useAuth();
    const { setBadge } = useAppBadge();
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastCheckRef = useRef<Date>(new Date());

    useEffect(() => {
        if (!user) return;

        const checkNotifications = async () => {
            try {
                const { data, error } = await supabase
                    .from('notifications')
                    .select('id, is_read, created_at')
                    .eq('user_id', user.id)
                    .eq('is_read', false);

                if (error) throw error;

                const unreadCount = data?.length || 0;
                console.log('Background check: unread notifications:', unreadCount);

                // Always update badge, even if app is in background
                setBadge(unreadCount);

                // Check for new notifications since last check
                const newNotifications = data?.filter(n =>
                    new Date(n.created_at) > lastCheckRef.current
                ) || [];

                if (newNotifications.length > 0) {
                    console.log('New notifications detected:', newNotifications.length);
                    // Could trigger additional actions here
                }

                lastCheckRef.current = new Date();
            } catch (error) {
                console.error('Background notification check failed:', error);
            }
        };

        // Initial check
        checkNotifications();

        // Set up more frequent checking (every 15 seconds)
        intervalRef.current = setInterval(checkNotifications, 15000);

        // Also check when page becomes visible
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                console.log('Page visible, checking notifications');
                checkNotifications();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user, setBadge]);
}