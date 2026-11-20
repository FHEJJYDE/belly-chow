import { useState } from 'react';
import { useInAppNotifications } from '@/hooks/useInAppNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { X, Bell, Package, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const NotificationBanner = () => {
    const navigate = useNavigate();
    const { user, role } = useAuth();
    const { notifications } = useInAppNotifications();
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const [permState, setPermState] = useState<NotificationPermission>(
        typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'granted'
    );
    const [permDismissed, setPermDismissed] = useState(false);

    const handleEnableDevicePopups = async () => {
        if (!('Notification' in window)) return;
        try {
            const res = await Notification.requestPermission();
            setPermState(res);
            if (res === 'granted' && 'serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.getRegistration();
                if (reg && 'showNotification' in reg) {
                    reg.showNotification('Device Alerts Enabled', {
                        body: 'You will now receive instant pop-up alerts even when Belly-Chow is minimized.',
                        icon: '/belly_chow_logo.png',
                        badge: '/belly_chow_logo.png',
                    });
                }
            }
        } catch {
            // Ignore
        }
    };

    // Get the most recent unread critical notification
    const criticalNotification = notifications.find(
        n => !n.is_read &&
            !dismissedIds.has(n.id) &&
            (n.type === 'new_order' || n.type === 'error' || n.message.includes('urgent'))
    );

    const handleDismiss = (notificationId: string) => {
        setDismissedIds(prev => new Set([...prev, notificationId]));
    };

    const handleClick = () => {
        if (criticalNotification?.order_id) {
            if (role === 'vendor') navigate('/vendor-panel/orders');
            else if (role === 'rider') navigate('/dashboard');
            else if (role === 'admin') navigate('/admin/orders');
            else navigate('/orders');
        } else {
            navigate('/notifications');
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'new_order':
                return <Bell className="h-4 w-4" />;
            case 'error':
                return <AlertTriangle className="h-4 w-4" />;
            default:
                return <Package className="h-4 w-4" />;
        }
    };

    const getVariant = (type: string) => {
        switch (type) {
            case 'new_order':
                return 'default';
            case 'error':
                return 'destructive';
            default:
                return 'default';
        }
    };

    if (!criticalNotification) {
        if (user && permState === 'default' && !permDismissed) {
            return (
                <div className="fixed bottom-20 md:bottom-5 right-4 left-4 md:left-auto md:max-w-sm z-[100] animate-in fade-in slide-in-from-bottom-3">
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-xl p-3.5 shadow-xl">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <i className="fa-solid fa-bell text-sm animate-bounce" />
                            </div>
                            <div className="min-w-0">
                                <p className="font-heading text-xs font-bold text-foreground">Enable Device Pop-Up Alerts</p>
                                <p className="text-[11px] text-muted-foreground truncate">Get order updates even when off the app</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <Button size="sm" onClick={handleEnableDevicePopups} className="h-8 rounded-xl text-xs font-bold px-3">
                                Enable
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setPermDismissed(true)}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    }

    return (
        <div className="fixed top-16 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-[100] animate-in slide-in-from-top-2">
            <Alert
                variant={getVariant(criticalNotification.type)}
                className="cursor-pointer shadow-2xl border-2 bg-card/95 backdrop-blur border-primary/30"
                onClick={handleClick}
            >
                <div className="flex items-center gap-2">
                    {getIcon(criticalNotification.type)}
                    <AlertDescription className="flex-1">
                        <span className="font-semibold">{criticalNotification.title}</span>
                        <span className="ml-2">{criticalNotification.message}</span>
                    </AlertDescription>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDismiss(criticalNotification.id);
                        }}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </Alert>
        </div>
    );
};

export default NotificationBanner;