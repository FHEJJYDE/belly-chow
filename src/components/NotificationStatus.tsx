import { useInAppNotifications } from '@/hooks/useInAppNotifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Clock, Package, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface NotificationStatusProps {
    className?: string;
    showTitle?: boolean;
    maxItems?: number;
}

const NotificationStatus = ({
    className = '',
    showTitle = true,
    maxItems = 3
}: NotificationStatusProps) => {
    const navigate = useNavigate();
    const { notifications, unreadCount } = useInAppNotifications();

    const recentNotifications = notifications.slice(0, maxItems);

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'order_update':
                return <Package className="h-4 w-4 text-blue-500" />;
            case 'new_order':
                return <Bell className="h-4 w-4 text-green-500" />;
            case 'error':
                return <AlertCircle className="h-4 w-4 text-red-500" />;
            default:
                return <Bell className="h-4 w-4 text-blue-500" />;
        }
    };

    const formatTimeAgo = (dateString: string) => {
        try {
            return formatDistanceToNow(new Date(dateString), { addSuffix: true });
        } catch {
            return 'recently';
        }
    };

    return (
        <Card className={className}>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        {showTitle && 'Recent Notifications'}
                    </div>
                    <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                            <Badge variant="destructive" className="text-xs">
                                {unreadCount} new
                            </Badge>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate('/notifications')}
                            className="text-xs h-auto p-1"
                        >
                            View all
                        </Button>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                {recentNotifications.length === 0 ? (
                    <div className="text-center py-4">
                        <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No notifications yet</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recentNotifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${!notification.is_read ? 'bg-primary/5 border border-primary/20' : ''
                                    }`}
                                onClick={() => navigate('/notifications')}
                            >
                                <div className="mt-0.5">
                                    {getNotificationIcon(notification.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className={`text-sm ${!notification.is_read ? 'font-semibold' : 'font-medium'} line-clamp-1`}>
                                            {notification.title}
                                        </p>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                                            <Clock className="h-3 w-3" />
                                            {formatTimeAgo(notification.created_at)}
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                        {notification.message}
                                    </p>
                                    {!notification.is_read && (
                                        <div className="flex items-center gap-1 mt-1">
                                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                            <span className="text-xs text-primary font-medium">New</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default NotificationStatus;