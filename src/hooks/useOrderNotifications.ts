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

function triggerDevicePopupNotification(title: string, body: string, targetUrl = '/dashboard', tag?: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const options: any = {
    body,
    icon: '/belly_chow_logo.png',
    badge: '/belly_chow_logo.png',
    vibrate: [200, 100, 200],
    tag: tag || `bc-alert-${Date.now()}`,
    renotify: true,
    requireInteraction: false,
    silent: false,
    data: { url: targetUrl },
  };

  // Prefer ServiceWorkerRegistration.showNotification so popups appear on Android/iOS/Desktop OS banner even when minimized
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg && 'showNotification' in reg) {
        reg.showNotification(title, options).catch(() => {
          try { new Notification(title, options); } catch {}
        });
      } else {
        try { new Notification(title, options); } catch {}
      }
    }).catch(() => {
      try { new Notification(title, options); } catch {}
    });
  } else {
    try { new Notification(title, options); } catch {}
  }
}

export function useOrderNotifications() {
  const { user, role, loading } = useAuth();
  const vendorIdRef = useRef<string | null>(null);
  const recentNotifications = useRef<Set<string>>(new Set());
  // Track last known status per order to avoid duplicate notifications
  const orderStatuses = useRef<Map<string, string>>(new Map());

  const getRoleTargetUrl = useCallback(() => {
    if (role === 'vendor') return '/vendor-panel/orders';
    if (role === 'rider') return '/dashboard';
    if (role === 'admin') return '/admin/orders';
    return '/orders';
  }, [role]);

  const notify = useCallback((title: string, description: string, sound: 'new_order' | 'status_update' = 'status_update', dedupeKey?: string) => {
    const key = dedupeKey || `${title}-${description}`;
    if (recentNotifications.current.has(key)) return;
    recentNotifications.current.add(key);
    setTimeout(() => recentNotifications.current.delete(key), 30000); // 30s cooldown

    toast({ title, description });
    playNotificationSound(sound);
    triggerDevicePopupNotification(title, description, getRoleTargetUrl(), key);
  }, [getRoleTargetUrl]);

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'default') return;
    // Try requesting permission on mount, and also attach a one-time click/tap listener so mobile browsers that require a user gesture grant it immediately on first tap
    Notification.requestPermission().catch(() => {});
    const requestOnFirstGesture = () => {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
      window.removeEventListener('click', requestOnFirstGesture);
      window.removeEventListener('touchstart', requestOnFirstGesture);
    };
    window.addEventListener('click', requestOnFirstGesture, { once: true });
    window.addEventListener('touchstart', requestOnFirstGesture, { once: true });
    return () => {
      window.removeEventListener('click', requestOnFirstGesture);
      window.removeEventListener('touchstart', requestOnFirstGesture);
    };
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

    const ACTIVE_STATUSES = new Set(['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'delivering', 'arrived']);
    let hasActiveStudentOrder = false;
    let pollTimeout: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let channel: any = null;

    const setupRealtimeChannel = (vendorId?: string | null) => {
      if (cancelled || channel) return;
      const channelId = `order-notifications-${user.id}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        // Apply row-level Realtime filters so Postgres doesn't fan out every campus order to every user
        const filter =
          role === 'student'
            ? `student_id=eq.${user.id}`
            : role === 'vendor' && vendorId
            ? `vendor_id=eq.${vendorId}`
            : undefined;

        const updateConfig: any = { event: 'UPDATE', schema: 'public', table: 'orders' };
        const insertConfig: any = { event: 'INSERT', schema: 'public', table: 'orders' };
        if (filter) {
          updateConfig.filter = filter;
          insertConfig.filter = filter;
        }

        channel = supabase
          .channel(channelId)
          .on('postgres_changes', updateConfig, (payload) => {
            const updated = payload.new as any;
            if (role === 'student') {
              hasActiveStudentOrder = ACTIVE_STATUSES.has(updated?.status);
            }
            checkAndNotify(updated, false);
          })
          .on('postgres_changes', insertConfig, (payload) => {
            const order = payload.new as any;
            if (role === 'student' && order.student_id === user.id) {
              hasActiveStudentOrder = true;
            }
            if (role === 'vendor' && vendorIdRef.current && order.vendor_id === vendorIdRef.current && !orderStatuses.current.has(order.id)) {
              orderStatuses.current.set(order.id, order.status);
              notify('New Order Received!', `New order #${order.id.slice(0, 8)} — check your kitchen orders tab!`, 'new_order', `new-order-${order.id}`);
            }
          })
          .subscribe();
      } catch (err) {
        console.warn('Order notifications channel warning:', err);
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
            .limit(10);
          hasActiveStudentOrder = Boolean(data?.some((o) => ACTIVE_STATUSES.has(o.status)));
          data?.forEach((o) => checkAndNotify(o, isInitialLoad));
          if (isInitialLoad) setupRealtimeChannel(null);
        } else if (role === 'vendor') {
          if (!vendorIdRef.current) {
            const { data: v } = await supabase
              .from('vendors')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle();
            if (v) vendorIdRef.current = v.id;
          }
          if (isInitialLoad) setupRealtimeChannel(vendorIdRef.current);
          if (vendorIdRef.current) {
            const { data } = await supabase
              .from('orders')
              .select('id, status, student_id, vendor_id, rider_id')
              .eq('vendor_id', vendorIdRef.current)
              .order('created_at', { ascending: false })
              .limit(20);
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
          if (isInitialLoad) setupRealtimeChannel(null);
          const { data } = await supabase
            .from('orders')
            .select('id, status, student_id, vendor_id, rider_id')
            .or(`rider_id.eq.${user.id},and(status.eq.ready,rider_id.is.null)`)
            .order('created_at', { ascending: false })
            .limit(20);
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

    // Adaptive fallback polling: Realtime handles instant <100ms alerts;
    // polling backs off dramatically when idle or tab is hidden to save >90% DB load.
    const scheduleNextPoll = () => {
      if (cancelled) return;
      const delayMs = document.hidden
        ? 60_000
        : role === 'student'
        ? hasActiveStudentOrder
          ? 12_000
          : 45_000
        : 15_000;
      pollTimeout = setTimeout(async () => {
        if (!cancelled) {
          await pollOrders(false);
          scheduleNextPoll();
        }
      }, delayMs);
    };

    pollOrders(true).then(() => scheduleNextPoll());

    const handleVisibilityChange = () => {
      if (!document.hidden && !cancelled) {
        if (pollTimeout) clearTimeout(pollTimeout);
        pollOrders(false).then(() => scheduleNextPoll());
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (channel) {
        supabase.removeChannel(channel).catch(() => {});
      }
      if (pollTimeout) clearTimeout(pollTimeout);
      orderStatuses.current.clear();
    };
  }, [user, role, loading, notify]);
}
