import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const statusMessages: Record<string, { title: string; description: string }> = {
  accepted: { title: 'Order Accepted by Vendor', description: 'The vendor has accepted your order.' },
  preparing: { title: 'Kitchen Preparing Your Meal', description: 'The vendor has accepted and started cooking your meal!' },
  ready: { title: 'Meal Ready — Dispatching Rider', description: 'Your food is packaged and ready for rider pickup.' },
  picked_up: { title: 'Order Picked Up by Rider', description: 'A dispatch rider has picked up your order from the vendor.' },
  delivering: { title: 'Rider Is On The Way!', description: 'Your rider is heading to your drop-off location now.' },
  arrived: { title: 'Your Rider Has Arrived!', description: 'Your rider is outside! Please meet them and confirm delivery receipt.' },
  delivered: { title: 'Order Delivered', description: 'Delivery confirmed. Enjoy your meal!' },
  cancelled: { title: 'Order Cancelled', description: 'Your order has been cancelled.' },
  rejected: { title: 'Order Rejected', description: 'The vendor was unable to fulfill your order.' },
};

const vendorStatusMessages: Record<string, { title: string; description: string }> = {
  pending: { title: 'New Order Received', description: 'You have a new order waiting in your kitchen pipeline.' },
  picked_up: { title: 'Order Claimed & Picked Up', description: 'A dispatch rider has picked up the order.' },
  arrived: { title: 'Rider Arrived at Customer', description: 'The rider has reached the customer drop-off point.' },
  delivered: { title: 'Order Delivered & Paid', description: 'Customer confirmed delivery! Earnings credited to your wallet.' },
};

const riderStatusMessages: Record<string, { title: string; description: string }> = {
  ready: { title: 'New Order Ready for Pickup!', description: 'A vendor just marked an order ready for pickup.' },
  delivered: { title: 'Delivery Confirmed by Customer!', description: 'Your delivery payout has been released to your wallet.' },
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
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [role]);

  useEffect(() => {
    if (!user || loading || !role) return;

    const checkAndNotify = (order: any, isInitialLoad = false) => {
      const previousStatus = orderStatuses.current.get(order.id);
      if (isInitialLoad) {
        orderStatuses.current.set(order.id, order.status);
        return;
      }
      if (order.status === previousStatus) return;
      orderStatuses.current.set(order.id, order.status);

      if (role === 'student' && order.student_id === user.id) {
        const msg = statusMessages[order.status];
        if (msg) notify(msg.title, msg.description, 'status_update', `student-${order.id}-${order.status}`);
      }

      if (role === 'vendor' && vendorIdRef.current && order.vendor_id === vendorIdRef.current) {
        const msg = vendorStatusMessages[order.status];
        if (msg) notify(msg.title, msg.description, order.status === 'pending' ? 'new_order' : 'status_update', `vendor-${order.id}-${order.status}`);
      }

      if (role === 'rider' && (order.rider_id === user.id || (order.status === 'ready' && !order.rider_id))) {
        const msg = riderStatusMessages[order.status];
        if (msg) notify(msg.title, msg.description, 'new_order', `rider-${order.id}-${order.status}`);
      }
    };

    const pollOrders = async (isInitialLoad = false) => {
      try {
        if (role === 'student') {
          const { data } = await supabase
            .from('orders')
            .select('id, status, student_id, vendor_id, rider_id')
            .eq('student_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);
          data?.forEach((o) => checkAndNotify(o, isInitialLoad));
        } else if (role === 'vendor') {
          if (!vendorIdRef.current) {
            const { data: v } = await supabase
              .from('vendors')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle();
            if (v) vendorIdRef.current = v.id;
          }
          if (vendorIdRef.current) {
            const { data } = await supabase
              .from('orders')
              .select('id, status, student_id, vendor_id, rider_id')
              .eq('vendor_id', vendorIdRef.current)
              .order('created_at', { ascending: false })
              .limit(30);
            data?.forEach((o) => {
              if (!isInitialLoad && !orderStatuses.current.has(o.id) && o.status === 'pending') {
                orderStatuses.current.set(o.id, o.status);
                notify('New Order Received!', `New order #${o.id.slice(0, 8)} — check your kitchen orders tab!`, 'new_order', `new-order-${o.id}`);
              } else {
                checkAndNotify(o, isInitialLoad);
              }
            });
          }
        } else if (role === 'rider') {
          const { data } = await supabase
            .from('orders')
            .select('id, status, student_id, vendor_id, rider_id')
            .or(`rider_id.eq.${user.id},and(status.eq.ready,rider_id.is.null)`)
            .order('created_at', { ascending: false })
            .limit(30);
          data?.forEach((o) => {
            if (!isInitialLoad && !orderStatuses.current.has(o.id) && o.status === 'ready' && !o.rider_id) {
              orderStatuses.current.set(o.id, o.status);
              notify('New Order Ready for Pickup!', `Order #${o.id.slice(0, 8)} is ready for dispatch pickup.`, 'new_order', `rider-${o.id}-ready`);
            } else {
              checkAndNotify(o, isInitialLoad);
            }
          });
        }
      } catch (err) {
        console.error('Order notification poll error:', err);
      }
    };

    pollOrders(true);

    // 1. Realtime listener for instant <100ms alerts
    const channel = supabase.channel(`order-notifications-${user.id}`).on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'orders' },
      (payload) => {
        checkAndNotify(payload.new as any, false);
      }
    ).on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'orders' },
      (payload) => {
        const order = payload.new as any;
        if (role === 'vendor' && vendorIdRef.current && order.vendor_id === vendorIdRef.current && !orderStatuses.current.has(order.id)) {
          orderStatuses.current.set(order.id, order.status);
          notify('New Order Received!', `New order #${order.id.slice(0, 8)} — check your kitchen orders tab!`, 'new_order', `new-order-${order.id}`);
        }
      }
    ).subscribe();

    // 2. Guaranteed 5-second polling fallback so students/vendors/riders NEVER miss a status change toast & sound
    const pollInterval = setInterval(() => {
      pollOrders(false);
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      orderStatuses.current.clear();
    };
  }, [user, role, loading, notify]);
}
