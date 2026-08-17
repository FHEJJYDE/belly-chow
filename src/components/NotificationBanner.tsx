import { useState, useEffect } from 'react';
import { useInAppNotifications } from '@/hooks/useInAppNotifications';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { X, Bell, Package, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const NotificationBanner = () => {
    const navigate = useNavigate();
    const { notifications } = useInAppNotifications();
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

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
            navigate('/orders');
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

    if (!criticalNotification) return null;

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