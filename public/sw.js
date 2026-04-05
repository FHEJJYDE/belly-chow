// Belly-Chow Push Notification Service Worker

// Background sync for notifications
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-notifications') {
    event.waitUntil(checkForNewNotifications());
  }
});

async function checkForNewNotifications() {
  try {
    // This would need to be implemented with your backend API
    // For now, we'll rely on the app's polling system
    console.log('Background sync: checking for notifications');
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

self.addEventListener("push", (event) => {
  console.log('Push event received:', event);

  let data = {
    title: "Belly-Chow",
    body: "You have a new notification",
    icon: "/pwa-192.png",
    badge: "/pwa-192.png",
    unreadCount: 1
  };

  try {
    if (event.data) {
      const pushData = event.data.json();
      data = { ...data, ...pushData };
      console.log('Push data parsed:', data);
    }
  } catch (e) {
    console.error("Failed to parse push data:", e);
  }

  const options = {
    body: data.body,
    icon: data.icon || "/pwa-192.png",
    badge: data.badge || "/pwa-192.png",
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: [
      { action: "open", title: "Open App" },
      { action: "dismiss", title: "Dismiss" }
    ],
    tag: data.data?.order_id || "general",
    renotify: true,
    requireInteraction: false, // Allow notification to be dismissed
    silent: false, // Ensure sound plays
  };

  console.log('Showing notification with options:', options);

  // Update app badge if supported and count is provided
  if ('setAppBadge' in navigator) {
    const badgeCount = data.unreadCount || 1;
    console.log('Service Worker: Setting badge to', badgeCount);
    navigator.setAppBadge(badgeCount).catch(err => {
      console.error('Failed to set badge in service worker:', err);
    });
  } else {
    console.log('setAppBadge not supported in service worker');
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => {
        console.log('Notification shown successfully');
      })
      .catch(err => {
        console.error('Failed to show notification:', err);
      })
  );
});

self.addEventListener("notificationclick", (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  // Clear app badge when notification is clicked
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(err => {
      console.error('Failed to clear badge:', err);
    });
  }

  const urlToOpen = event.notification.data?.url || "/dashboard";
  console.log('Opening URL:', urlToOpen);

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      console.log('Found clients:', clientList.length);
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          console.log('Focusing existing client');
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      console.log('Opening new window');
      return clients.openWindow(urlToOpen);
    })
  );
});

self.addEventListener("notificationclose", (event) => {
  console.log('Notification closed:', event);
  // Don't clear badge when notification is just dismissed
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
