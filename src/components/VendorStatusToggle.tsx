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
                    className={`text-xs font-semibold px-2.5 py-0.5 ${
                        vendor.is_active 
                            ? 'bg-green-500 text-white hover:bg-green-600' 
                            : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20'
                    }`}
                >
                    {vendor.is_active ? 'Open' : 'Closed'}
                </Badge>
                <div className="flex items-center gap-2">
                    <Label htmlFor="status-toggle" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {vendor.is_active ? 'Close' : 'Open'}
                    </Label>
                    <Switch
                        id="status-toggle"
                        checked={!!vendor.is_active}
                        onCheckedChange={toggleActive}
                        className="data-[state=checked]:bg-green-500"
                    />
                </div>
            </div>
        );
    }

    return (
        <Card className={`p-4 transition-all border ${
            vendor.is_active 
                ? 'border-green-500/30 bg-green-500/5 dark:bg-green-500/10' 
                : 'border-red-500/30 bg-red-500/5 dark:bg-red-500/10'
        } ${className}`}>
            <div className="flex items-center gap-4">
                <div className="text-center shrink-0">
                    <div className="text-2xl animate-pulse">
                        {vendor.is_active ? '🟢' : '🔴'}
                    </div>
                    <p className={`text-xs font-extrabold tracking-wider mt-1 ${vendor.is_active ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {vendor.is_active ? 'OPEN' : 'CLOSED'}
                    </p>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="vendor-active" className={`text-sm font-bold truncate ${
                            vendor.is_active ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                        }`}>
                            {vendor.is_active ? 'Open & accepting orders' : 'Closed for orders'}
                        </Label>
                        <Switch
                            id="vendor-active"
                            checked={!!vendor.is_active}
                            onCheckedChange={toggleActive}
                            className="data-[state=checked]:bg-green-500 shrink-0"
                        />
                    </div>
                    <p className={`text-xs truncate ${
                        vendor.is_active ? 'text-green-700/80 dark:text-green-400/80' : 'text-red-700/80 dark:text-red-400/80'
                    }`}>
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