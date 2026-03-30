import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY = 'BHWaSUFHH0fNYICgW-WVKymEGcaUVS9H5iggZrpac5jIhWXxJ32jZ8q_RZ3c0nnVOjFDAQYJmF_UKc_WdQx1EiA';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map((char) => char.charCodeAt(0)));
}

export function usePushNotifications() {
  const { user } = useAuth();
  const registered = useRef(false);

  useEffect(() => {
    if (!user || registered.current) return;

    const isInIframe = (() => {
      try { return window.self !== window.top; } catch { return true; }
    })();
    const isPreview = window.location.hostname.includes('id-preview--') ||
      window.location.hostname.includes('lovableproject.com');

    if (isInIframe || isPreview) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const registerPush = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // Subscribe
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
          });
        }

        const subJson = subscription.toJSON();
        const endpoint = subJson.endpoint!;
        const p256dh = subJson.keys!.p256dh!;
        const auth = subJson.keys!.auth!;

        // Upsert subscription (avoid duplicates)
        const { data: existing } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .eq('endpoint', endpoint)
          .maybeSingle();

        if (!existing) {
          await supabase.from('push_subscriptions').insert({
            user_id: user.id,
            endpoint,
            p256dh,
            auth,
          });
        }

        registered.current = true;
        console.log('Push notifications registered');
      } catch (err) {
        console.error('Push registration failed:', err);
      }
    };

    registerPush();
  }, [user]);
}
