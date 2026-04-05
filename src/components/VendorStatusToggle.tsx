import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Vendor = Database['public']['Tables']['vendors']['Row'];

interface VendorStatusToggleProps {
    variant?: 'full' | 'compact';
    className?: string;
}

const VendorStatusToggle = ({ variant = 'compact', className = '' }: VendorStatusToggleProps) => {
    const { user } = useAuth();
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchVendor = async () => {
            if (!user) return;

            try {
                const { data, error } = await supabase
                    .from('vendors')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (error) throw error;
                setVendor(data);
            } catch (error) {
                console.error('Error fetching vendor:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchVendor();
    }, [user]);

    const toggleActive = async () => {
        if (!vendor) return;

        const newStatus = !vendor.is_active;

        try {
            const { error } = await supabase
                .from('vendors')
                .update({ is_active: newStatus })
                .eq('id', vendor.id);

            if (error) throw error;

            setVendor({ ...vendor, is_active: newStatus });

            // Show success toast
            toast({
                title: newStatus ? "🟢 Now Open for Orders!" : "🔴 Closed for Orders",
                description: newStatus
                    ? "Customers can now place orders from your menu"
                    : "No new orders will be accepted until you open again",
                duration: 4000,
            });

            // Send notification to system (optional - for admin tracking)
            if (user) {
                await supabase.rpc('send_notification', {
                    target_user_id: user.id,
                    notification_title: newStatus ? 'Store Opened' : 'Store Closed',
                    notification_message: `${vendor.name} is now ${newStatus ? 'open' : 'closed'} for orders`,
                    notification_type: 'info',
                    related_vendor_id: vendor.id
                });
            }

        } catch (error) {
            console.error('Error updating vendor status:', error);
            toast({
                title: "Error",
                description: "Failed to update store status. Please try again.",
                variant: "destructive",
                duration: 4000,
            });
        }
    };

    if (loading || !vendor) return null;

    if (variant === 'compact') {
        return (
            <div className={`flex items-center gap-3 ${className}`}>
                <Badge
                    variant={vendor.is_active ? 'default' : 'outline'}
                    className={`text-xs ${vendor.is_active ? 'bg-green-600' : 'bg-red-100 text-red-700 border-red-200'}`}
                >
                    {vendor.is_active ? '🟢 Open' : '🔴 Closed'}
                </Badge>
                <div className="flex items-center gap-2">
                    <Label htmlFor="status-toggle" className="text-sm">
                        {vendor.is_active ? 'Close' : 'Open'}
                    </Label>
                    <Switch
                        id="status-toggle"
                        checked={!!vendor.is_active}
                        onCheckedChange={toggleActive}
                        className="data-[state=checked]:bg-green-600"
                    />
                </div>
            </div>
        );
    }

    return (
        <Card className={`p-4 transition-all ${vendor.is_active ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} ${className}`}>
            <div className="flex items-center gap-4">
                <div className="text-center">
                    <div className={`text-2xl font-bold ${vendor.is_active ? 'text-green-600' : 'text-red-600'}`}>
                        {vendor.is_active ? '🟢' : '🔴'}
                    </div>
                    <p className={`text-sm font-medium ${vendor.is_active ? 'text-green-700' : 'text-red-700'}`}>
                        {vendor.is_active ? 'OPEN' : 'CLOSED'}
                    </p>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="vendor-active" className="text-sm font-medium">
                            {vendor.is_active ? 'Close for orders' : 'Open for orders'}
                        </Label>
                        <Switch
                            id="vendor-active"
                            checked={!!vendor.is_active}
                            onCheckedChange={toggleActive}
                            className="data-[state=checked]:bg-green-600"
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {vendor.is_active
                            ? 'Customers can place orders now'
                            : 'No new orders will be accepted'
                        }
                    </p>
                </div>
            </div>
        </Card>
    );
};

export default VendorStatusToggle;