self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { unread: 1, title: "Little Temptation", body: "New message" };
  const unread = Number(data.unread) || 0;
  // Not chat messages: their own tag, a normal alert sound, no message chime or badge.
  const quiet = data.kind === "morning" || data.kind === "away" || data.kind === "recap";
  const nudge = data.kind === "nudge";
  event.waitUntil((async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (!quiet) windows.forEach((client) => client.postMessage({ type: "message-note" }));
      await Promise.all([
        self.registration.showNotification(data.title || "Little Temptation", {
          body: data.body || "New message",
          icon: data.icon || "/app-icon-192.png",
          badge: "/app-icon-192.png",
          tag: quiet || nudge || data.kind === "daily" ? `lt-${data.kind}` : "lt-message",
          renotify: true,
          silent: quiet || nudge ? false : windows.length > 0,
          vibrate: nudge ? [80, 60, 80, 60, 220] : undefined,
          data: { url: "/" },
        }),
        !quiet && unread > 0 && navigator.setAppBadge ? navigator.setAppBadge(unread) : Promise.resolve(),
      ]);
    })());
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
