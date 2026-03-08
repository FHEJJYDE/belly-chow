import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const statusMessages: Record<string, { title: string; description: string; emoji: string }> = {
  accepted: { title: 'Order Accepted! ✅', description: 'The vendor has accepted your order.', emoji: '✅' },
  preparing: { title: 'Being Prepared 🍳', description: 'Your food is being prepared.', emoji: '🍳' },
  ready: { title: 'Order Ready! 📦', description: 'Your order is ready for pickup.', emoji: '📦' },
  picked_up: { title: 'Picked Up 🏍️', description: 'A rider has picked up your order.', emoji: '🏍️' },
  delivering: { title: 'On the Way! 🚀', description: 'Your order is on its way to you.', emoji: '🚀' },
  delivered: { title: 'Delivered! 🎉', description: 'Your order has been delivered. Enjoy!', emoji: '🎉' },
  cancelled: { title: 'Order Cancelled ❌', description: 'Your order has been cancelled.', emoji: '❌' },
  rejected: { title: 'Order Rejected 😞', description: 'The vendor rejected your order.', emoji: '😞' },
};

const vendorStatusMessages: Record<string, { title: string; description: string }> = {
  pending: { title: 'New Order! 🔔', description: 'You have a new order waiting.' },
  picked_up: { title: 'Order Picked Up 🏍️', description: 'A rider picked up the order.' },
  delivered: { title: 'Order Delivered ✅', description: 'An order has been delivered.' },
};

const riderStatusMessages: Record<string, { title: string; description: string }> = {
  ready: { title: 'Order Ready! 📦', description: 'An order is ready for pickup.' },
};

export function useOrderNotifications() {
  const { user, role } = useAuth();
  const knownOrders = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    // Pre-populate known orders so we don't toast on initial load
    const init = async () => {
      if (role === 'student') {
        const { data } = await supabase.from('orders').select('id').eq('student_id', user.id);
        data?.forEach(o => knownOrders.current.add(o.id));
      } else if (role === 'vendor') {
        const { data: v } = await supabase.from('vendors').select('id').eq('user_id', user.id).single();
        if (v) {
          const { data } = await supabase.from('orders').select('id').eq('vendor_id', v.id);
          data?.forEach(o => knownOrders.current.add(o.id));
        }
      } else if (role === 'rider') {
        const { data } = await supabase.from('orders').select('id').or(`rider_id.eq.${user.id},and(status.eq.ready,rider_id.is.null)`);
        data?.forEach(o => knownOrders.current.add(o.id));
      }
    };
    init();

    const channel = supabase.channel('order-notifications').on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'orders' },
      (payload) => {
        const order = payload.new as any;
        const oldOrder = payload.old as any;
        if (order.status === oldOrder.status) return;

        if (role === 'student' && order.student_id === user.id) {
          const msg = statusMessages[order.status];
          if (msg) toast({ title: msg.title, description: msg.description });
        }

        if (role === 'vendor') {
          const msg = vendorStatusMessages[order.status];
          if (msg) toast({ title: msg.title, description: msg.description });
        }

        if (role === 'rider' && (order.rider_id === user.id || order.status === 'ready')) {
          const msg = riderStatusMessages[order.status];
          if (msg) toast({ title: msg.title, description: msg.description });
        }
      }
    ).on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'orders' },
      (payload) => {
        const order = payload.new as any;
        if (role === 'vendor' && !knownOrders.current.has(order.id)) {
          knownOrders.current.add(order.id);
          toast({ title: 'New Order! 🔔', description: 'You have a new order waiting.' });
        }
      }
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, role]);
}
