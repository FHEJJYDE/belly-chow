import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const statusMessages: Record<string, { title: string; description: string }> = {
  accepted: { title: 'Order Accepted! ✅', description: 'The vendor has accepted your order.' },
  preparing: { title: 'Being Prepared 🍳', description: 'Your food is being prepared.' },
  ready: { title: 'Order Ready! 📦', description: 'Your order is ready for pickup.' },
  picked_up: { title: 'Picked Up 🏍️', description: 'A rider has picked up your order.' },
  delivering: { title: 'On the Way! 🚀', description: 'Your order is on its way to you.' },
  delivered: { title: 'Delivered! 🎉', description: 'Your order has been delivered. Enjoy!' },
  cancelled: { title: 'Order Cancelled ❌', description: 'Your order has been cancelled.' },
  rejected: { title: 'Order Rejected 😞', description: 'The vendor rejected your order.' },
};

const vendorStatusMessages: Record<string, { title: string; description: string }> = {
  pending: { title: 'New Order! 🔔', description: 'You have a new order waiting.' },
  picked_up: { title: 'Order Picked Up 🏍️', description: 'A rider picked up the order.' },
  delivered: { title: 'Order Delivered ✅', description: 'An order has been delivered.' },
};

const riderStatusMessages: Record<string, { title: string; description: string }> = {
  ready: { title: 'Order Ready! 📦', description: 'An order is ready for pickup.' },
};

// Generate a notification beep using Web Audio API
function playNotificationSound(type: 'new_order' | 'status_update' = 'status_update') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (type === 'new_order') {
      // Attention-grabbing double beep for new orders
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
      oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } else {
      // Subtle single tone for status updates
      oscillator.frequency.setValueAtTime(660, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    }

    oscillator.onended = () => ctx.close();
  } catch {
    // Audio not supported, silently ignore
  }
}

export function useOrderNotifications() {
  const { user, role } = useAuth();
  const knownOrders = useRef<Set<string>>(new Set());
  const vendorIdRef = useRef<string | null>(null);

  const notify = useCallback((title: string, description: string, sound: 'new_order' | 'status_update' = 'status_update') => {
    toast({ title, description });
    playNotificationSound(sound);

    // Also try browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: description, icon: '/favicon.ico' });
    }
  }, []);

  // Request notification permission on mount for vendors/riders
  useEffect(() => {
    if ((role === 'vendor' || role === 'rider') && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [role]);

  useEffect(() => {
    if (!user) return;

    const init = async () => {
      if (role === 'student') {
        const { data } = await supabase.from('orders').select('id').eq('student_id', user.id);
        data?.forEach(o => knownOrders.current.add(o.id));
      } else if (role === 'vendor') {
        const { data: v } = await supabase.from('vendors').select('id').eq('user_id', user.id).single();
        if (v) {
          vendorIdRef.current = v.id;
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
          if (msg) notify(msg.title, msg.description);
        }

        if (role === 'vendor' && vendorIdRef.current && order.vendor_id === vendorIdRef.current) {
          const msg = vendorStatusMessages[order.status];
          if (msg) notify(msg.title, msg.description, order.status === 'pending' ? 'new_order' : 'status_update');
        }

        if (role === 'rider' && (order.rider_id === user.id || order.status === 'ready')) {
          const msg = riderStatusMessages[order.status];
          if (msg) notify(msg.title, msg.description, 'new_order');
        }
      }
    ).on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'orders' },
      (payload) => {
        const order = payload.new as any;
        if (role === 'vendor' && !knownOrders.current.has(order.id)) {
          knownOrders.current.add(order.id);
          notify('🔔 New Order!', `New order #${order.id.slice(0, 8)} — check your orders tab!`, 'new_order');
        }
      }
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, role, notify]);
}
