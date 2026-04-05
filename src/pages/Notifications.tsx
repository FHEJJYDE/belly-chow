import { useInAppNotifications } from '@/hooks/useInAppNotificationsSimple';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Bell,
    Check,
    Clock,
    Package,
    AlertCircle,
    CheckCircle,
    Info,
    ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

const Notifications = () => {
    const navigate = useNavigate();
    const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useInAppNotifications();

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'order_update':
                return <Package className="h-5 w-5 text-blue-500" />;
            case 'new_order':
                return <Bell className="h-5 w-5 text-green-500" />;
            case 'error':
                return <AlertCircle className="h-5 w-5 text-red-500" />;
            case 'success':
                return <CheckCircle className="h-5 w-5 text-green-500" />;
            default:
                return <Info className="h-5 w-5 text-blue-500" />;
        }
    };

    const getNotificationBorderColor = (type: string) => {
        switch (type) {
            case 'new_order':
                return 'border-l-green-500';
            case 'error':
                return 'border-l-red-500';
            case 'success':
                return 'border-l-green-500';
            default:
                return 'border-l-blue-500';
        }
    };

    const handleNotificationClick = async (notification: any) => {
        if (!notification.is_read) {
            await markAsRead(notification.id);
        }

        if (notification.order_id) {
            navigate('/orders');
        }
    };

    const formatTimeAgo = (dateString: string) => {
        try {
            return formatDistanceToNow(new Date(dateString), { addSuffix: true });
        } catch {
            return 'recently';
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto p-4 max-w-4xl">
                <div className="flex items-center gap-4 mb-6">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-8 w-48" />
                </div>
                <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <Card key={i}>
                            <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                    <Skeleton className="h-5 w-5 rounded" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-3 w-full" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 max-w-4xl">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(-1)}
                        className="shrink-0"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Bell className="h-6 w-6" />
                            Notifications
                        </h1>
                        {unreadCount > 0 && (
                            <p className="text-sm text-muted-foreground">
                                You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                            </p>
                        )}
                    </div>
                </div>

                {unreadCount > 0 && (
                    <Button onClick={markAllAsRead} variant="outline" size="sm">
                        <Check className="h-4 w-4 mr-2" />
                        Mark all read
                    </Button>
                )}
            </div>

            {notifications.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No notifications yet</h3>
                        <p className="text-muted-foreground max-w-md">
                            You'll receive notifications here for order updates, new orders, and other important messages.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {notifications.map((notification) => (
                        <Card
                            key={notification.id}
                            className={`cursor-pointer transition-all hover:shadow-md ${!notification.is_read
                                ? `border-l-4 ${getNotificationBorderColor(notification.type)} bg-muted/20`
                                : 'hover:bg-muted/50'
                                }`}
                            onClick={() => handleNotificationClick(notification)}
                        >
                            <CardContent className="p-4">
                                <div className="flex items-start gap-4">
                                    <div className="mt-1">
                                        {getNotificationIcon(notification.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4 mb-2">
                                            <h3 className={`text-base ${!notification.is_read ? 'font-semibold' : 'font-medium'}`}>
                                                {notification.title}
                                            </h3>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {!notification.is_read && (
                                                    <Badge variant="default" className="text-xs">
                                                        New
                                                    </Badge>
                                                )}
                                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                    <Clock className="h-3 w-3" />
                                                    {formatTimeAgo(notification.created_at)}
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {notification.message}
                                        </p>
                                        {notification.order_id && (
                                            <div className="mt-3">
                                                <Badge variant="outline" className="text-xs">
                                                    <Package className="h-3 w-3 mr-1" />
                                                    Order #{notification.order_id.slice(0, 8)}
                                                </Badge>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Notifications;