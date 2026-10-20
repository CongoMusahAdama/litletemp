// Keeps the latest chat page on the phone so the chat opens instantly,
// then the server copy replaces it a moment later.
const PREFIX = "lt_chat_cache_";
const KEEP = 80;

export function readChatCache<T>(userId?: string): T[] {
  if (!userId || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PREFIX + userId);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export function writeChatCache<T>(userId: string | undefined, messages: T[]) {
  if (!userId) return;
  try {
    localStorage.setItem(PREFIX + userId, JSON.stringify(messages.slice(-KEEP)));
  } catch {
    // Storage full or blocked: the chat still works, it just won't open instantly.
  }
}

export function clearChatCache() {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Nothing to clear.
  }
}
