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
                    <Button onClick={createTestNotification} variant="secondary" size="sm">Create Test Notification</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    Check your app icon (if installed as PWA) to see the badge changes.
                </p>
            </CardContent>
        </Card>
    );
};

export default BadgeTest;