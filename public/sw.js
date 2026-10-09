self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { unread: 1, title: "Little Temptation", body: "New message" };
  const unread = Number(data.unread) || 0;
  const morning = data.kind === "morning";
  event.waitUntil((async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (!morning) windows.forEach((client) => client.postMessage({ type: "message-note" }));
      await Promise.all([
        self.registration.showNotification(data.title || "Little Temptation", {
          body: data.body || "New message",
          icon: data.icon || "/icon.png",
          badge: "/icon.png",
          tag: morning ? "lt-morning" : "lt-message",
          renotify: true,
          silent: morning ? false : windows.length > 0,
          data: { url: "/" },
        }),
        !morning && unread > 0 && navigator.setAppBadge ? navigator.setAppBadge(unread) : Promise.resolve(),
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
