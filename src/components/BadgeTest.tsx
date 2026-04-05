import { useAppBadge } from '@/hooks/useAppBadge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

const BadgeTest = () => {
    const { setBadge, clearBadge, isSupported } = useAppBadge();
    const { user } = useAuth();

    const createTestNotification = async () => {
        if (!user) {
            toast({ title: "Error", description: "You must be logged in to create test notifications" });
            return;
        }

        try {
            const { error } = await supabase
                .from('notifications')
                .insert({
                    user_id: user.id,
                    title: 'Test Notification',
                    message: 'This is a test notification to check badge functionality',
                    type: 'info'
                });

            if (error) throw error;

            toast({
                title: "Test notification created!",
                description: "Check your app icon for the badge update"
            });
        } catch (error) {
            console.error('Failed to create test notification:', error);
            toast({
                title: "Error",
                description: "Failed to create test notification",
                variant: "destructive"
            });
        }
    };

    const testPushNotification = async () => {
        if (!('serviceWorker' in navigator)) {
            toast({ title: "Error", description: "Service Worker not supported" });
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;

            // Create a test push notification
            const testData = {
                title: "Test Push Notification",
                body: "This is a test push notification with badge",
                icon: "/pwa-192.png",
                badge: "/pwa-192.png",
                unreadCount: 1,
                data: { url: "/notifications" }
            };

            // Show notification directly (simulating push)
            await registration.showNotification(testData.title, {
                body: testData.body,
                icon: testData.icon,
                badge: testData.badge,
                vibrate: [200, 100, 200],
                data: testData.data,
                actions: [
                    { action: "open", title: "Open App" },
                    { action: "dismiss", title: "Dismiss" }
                ],
                tag: "test-notification",
                renotify: true,
                requireInteraction: false,
                silent: false
            });

            // Set badge
            if ('setAppBadge' in navigator) {
                await navigator.setAppBadge(testData.unreadCount);
                console.log('Badge set to:', testData.unreadCount);
            }

            toast({
                title: "Test push notification sent!",
                description: "Check your notifications and app badge"
            });
        } catch (error) {
            console.error('Failed to send test push notification:', error);
            toast({
                title: "Error",
                description: "Failed to send test push notification",
                variant: "destructive"
            });
        }
    };

    const checkNotificationPermission = async () => {
        if (!('Notification' in window)) {
            toast({ title: "Error", description: "Notifications not supported in this browser" });
            return;
        }

        const permission = Notification.permission;
        console.log('Current notification permission:', permission);

        if (permission === 'default') {
            const newPermission = await Notification.requestPermission();
            console.log('New notification permission:', newPermission);
            toast({
                title: `Permission ${newPermission}`,
                description: `Notification permission is now: ${newPermission}`
            });
        } else {
            toast({
                title: `Permission: ${permission}`,
                description: `Notification permission is: ${permission}`
            });
        }
    };

    if (!isSupported) {
        return (
            <Card className="max-w-md">
                <CardHeader>
                    <CardTitle>App Badge Test</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        App Badge API is not supported in this browser/environment.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="max-w-md">
            <CardHeader>
                <CardTitle>App Badge Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                    Test the PWA notification badge functionality:
                </p>
                <div className="flex gap-2 flex-wrap">
                    <Button onClick={() => setBadge(1)} size="sm">Set Badge (1)</Button>
                    <Button onClick={() => setBadge(5)} size="sm">Set Badge (5)</Button>
                    <Button onClick={() => setBadge(99)} size="sm">Set Badge (99)</Button>
                    <Button onClick={clearBadge} variant="outline" size="sm">Clear Badge</Button>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button onClick={createTestNotification} variant="secondary" size="sm">Create Test Notification</Button>
                    <Button onClick={testPushNotification} variant="destructive" size="sm">Test Push Notification</Button>
                    <Button onClick={checkNotificationPermission} variant="outline" size="sm">Check Permission</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    Check your app icon (if installed as PWA) to see the badge changes.
                </p>
            </CardContent>
        </Card>
    );
};

export default BadgeTest;