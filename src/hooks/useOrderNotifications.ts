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

function playNotificationSound(type: 'new_order' | 'status_update' = 'status_update') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (type === 'new_order') {
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
      oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } else {
      oscillator.frequency.setValueAtTime(660, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    }

    oscillator.onended = () => ctx.close();
  } catch {
    // Audio not supported
  }
}

export function useOrderNotifications() {
  const { user, role, loading } = useAuth();
  const vendorIdRef = useRef<string | null>(null);
  const recentNotifications = useRef<Set<string>>(new Set());
  // Track last known status per order to avoid duplicate notifications
  const orderStatuses = useRef<Map<string, string>>(new Map());

  const notify = useCallback((title: string, description: string, sound: 'new_order' | 'status_update' = 'status_update', dedupeKey?: string) => {
    const key = dedupeKey || `${title}-${description}`;
    if (recentNotifications.current.has(key)) return;
    recentNotifications.current.add(key);
    setTimeout(() => recentNotifications.current.delete(key), 30000); // 30s cooldown

    toast({ title, description });
    playNotificationSound(sound);

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: description, icon: '/belly_chow_logo.png' });
    }
  }, []);

  useEffect(() => {
    if ((role === 'vendor' || role === 'rider') && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [role]);

  useEffect(() => {
    if (!user || loading || !role) return;

    const init = async () => {
      if (role === 'student') {
        const { data } = await supabase.from('orders').select('id, status').eq('student_id', user.id);
        data?.forEach(o => orderStatuses.current.set(o.id, o.status));
      } else if (role === 'vendor') {
        const { data: v } = await supabase.from('vendors').select('id').eq('user_id', user.id).single();
        if (v) {
          vendorIdRef.current = v.id;
          const { data } = await supabase.from('orders').select('id, status').eq('vendor_id', v.id);
          data?.forEach(o => orderStatuses.current.set(o.id, o.status));
        }
      } else if (role === 'rider') {
        const { data } = await supabase.from('orders').select('id, status').or(`rider_id.eq.${user.id},and(status.eq.ready,rider_id.is.null)`);
        data?.forEach(o => orderStatuses.current.set(o.id, o.status));
      }
    };
    init();

    const channel = supabase.channel('order-notifications').on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'orders' },
      (payload) => {
        const order = payload.new as any;
        const previousStatus = orderStatuses.current.get(order.id);

        // Only notify if status actually changed (compare against our local tracking)
        if (order.status === previousStatus) return;

        // Update our local tracking
        orderStatuses.current.set(order.id, order.status);

        if (role === 'student' && order.student_id === user.id) {
          const msg = statusMessages[order.status];
          if (msg) notify(msg.title, msg.description, 'status_update', `student-${order.id}-${order.status}`);
        }

        if (role === 'vendor' && vendorIdRef.current && order.vendor_id === vendorIdRef.current) {
          const msg = vendorStatusMessages[order.status];
          if (msg) notify(msg.title, msg.description, order.status === 'pending' ? 'new_order' : 'status_update', `vendor-${order.id}-${order.status}`);
        }

        if (role === 'rider' && (order.rider_id === user.id || order.status === 'ready')) {
          const msg = riderStatusMessages[order.status];
          if (msg) notify(msg.title, msg.description, 'new_order', `rider-${order.id}-${order.status}`);
        }
      }
    ).on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'orders' },
      (payload) => {
        const order = payload.new as any;
        if (role === 'vendor' && vendorIdRef.current && order.vendor_id === vendorIdRef.current && !orderStatuses.current.has(order.id)) {
          orderStatuses.current.set(order.id, order.status);
          notify('🔔 New Order!', `New order #${order.id.slice(0, 8)} — check your orders tab!`, 'new_order', `new-order-${order.id}`);
        }
      }
    ).subscribe();

    return () => {
      supabase.removeChannel(channel);
      orderStatuses.current.clear();
    };
  }, [user, role, loading, notify]);
}
