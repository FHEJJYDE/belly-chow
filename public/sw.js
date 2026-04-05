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
  let data = { title: "Belly-Chow", body: "You have a new notification" };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.error("Failed to parse push data:", e);
  }

  const options = {
    body: data.body,
    icon: data.icon || "/favicon.ico",
    badge: data.badge || "/favicon.ico",
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: [{ action: "open", title: "Open App" }],
    tag: data.data?.order_id || "general",
    renotify: true,
  };

  // Update app badge if supported
  if ('setAppBadge' in navigator && data.unreadCount) {
    console.log('Service Worker: Setting badge to', data.unreadCount);
    navigator.setAppBadge(data.unreadCount);
  }

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Clear app badge when notification is clicked
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge();
  }

  const urlToOpen = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
