// Your own calendar day (YYYY-MM-DD), in your timezone.
export function localDay(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** From 5pm: time for the evening check-in. */
export function isEvening(date = new Date()) {
  return date.getHours() >= 17;
}
