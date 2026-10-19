// WhatsApp-style dates: "Today", "Yesterday", the weekday for this week, then a date.

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function daysAgo(value: string | Date, now = new Date()) {
  return Math.round((startOfDay(now) - startOfDay(new Date(value))) / 86400000);
}

export function clockTime(value: string | Date) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Label for the divider between messages. */
export function dayLabel(value: string | Date, now = new Date()) {
  const date = new Date(value);
  const ago = daysAgo(date, now);
  if (ago <= 0) return "Today";
  if (ago === 1) return "Yesterday";
  if (ago < 7) return date.toLocaleDateString([], { weekday: "long" });
  return date.toLocaleDateString([], {
    day: "numeric",
    month: "long",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

/** Short time for the chat list: a clock today, then Yesterday, weekday, date. */
export function listTime(value: string | Date, now = new Date()) {
  const date = new Date(value);
  const ago = daysAgo(date, now);
  if (ago <= 0) return clockTime(date);
  if (ago === 1) return "Yesterday";
  if (ago < 7) return date.toLocaleDateString([], { weekday: "long" });
  return date.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function sameDay(a: string | Date, b: string | Date) {
  return startOfDay(new Date(a)) === startOfDay(new Date(b));
}
