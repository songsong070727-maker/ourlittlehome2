/* Our Little Home · Service Worker（推送信使）2026-08-19 */
const CACHE = 'olh-v28';
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html', './manifest.json', './icon-192.png'])).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// 收到推送 → 弹通知
self.addEventListener('push', (e) => {
  let data = { title: '墨屿', body: '想你了', url: './' };
  try { if (e.data) data = Object.assign(data, e.data.json()); } catch (err) {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'olh-notify',
    vibrate: [100, 50, 100]
  }));
});

// 点通知 → 打开小窝
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { try { c.navigate(url); } catch (err) {} return c.focus(); } }
    return clients.openWindow(url);
  }));
});