self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { unread: 1, title: "Little Temptation", body: "New message" };
  const unread = Number(data.unread) || 1;
  event.waitUntil(Promise.all([
    self.registration.showNotification(data.title || "Little Temptation", {
      body: data.body || "New message",
      icon: "/icon.png",
      badge: "/icon.png",
      tag: "lt-message",
      renotify: true,
      data: { url: "/" },
    }),
    navigator.setAppBadge ? navigator.setAppBadge(unread) : Promise.resolve(),
  ]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (windows[0]) {
      await windows[0].focus();
      return;
    }
    await self.clients.openWindow("/");
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "clear-badge" && navigator.clearAppBadge) {
    event.waitUntil(navigator.clearAppBadge());
  }
});
