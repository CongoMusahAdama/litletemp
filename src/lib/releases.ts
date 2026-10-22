// What's new in each release, shown once in the "What's new" pop-up.
// When you ship an update, add a new entry at the TOP with a new id.
export type ReleaseItem = { icon: string; title: string; text: string };
export type Release = { id: string; date: string; title: string; items: ReleaseItem[] };

export const RELEASES: Release[] = [
  {
    id: "2026-10-22.4",
    date: "22 October 2026",
    title: "Easier journal editing",
    items: [
      { icon: "✏️", title: "Edit and delete up top", text: "Open an entry you wrote and find the edit and delete buttons at the top, next to the heart." },
    ],
  },
  {
    id: "2026-10-22.3",
    date: "22 October 2026",
    title: "Evening check-in 🌙",
    items: [
      { icon: "🌙", title: "How was your day?", text: "Every evening, pick how your day felt and tell each other about it." },
      { icon: "🔒", title: "Share to read", text: "Your partner's day unlocks once you've shared yours." },
      { icon: "🔥", title: "Keeps your streak", text: "Sharing your day counts towards your streak. You'll get a gentle reminder each evening." },
      { icon: "📖", title: "Past days", text: "Look back on the days you both shared." },
    ],
  },
  {
    id: "2026-10-22.2",
    date: "22 October 2026",
    title: "Little fixes, just for you",
    items: [
      { icon: "✏️", title: "Edit your journal", text: "Open an entry you wrote to change its title, words or photos." },
      { icon: "🗑️", title: "Delete an entry", text: "Remove an entry you wrote. You'll be asked to confirm first." },
      { icon: "🟢", title: "Clearer status", text: "The chat now simply shows Online or Offline." },
    ],
  },
  {
    id: "2026-10-22",
    date: "22 October 2026",
    title: "A big update for you two",
    items: [
      { icon: "⚽", title: "Match bets", text: "Pick your club and bet gifts and dares on Premier League, LaLiga and Champions League games." },
      { icon: "✓✓", title: "Read ticks", text: "See when your message is sent, delivered, and read in blue, like WhatsApp." },
      { icon: "😍", title: "Reactions & stickers", text: "Hold a message to react. Send stickers or save your own from a photo." },
      { icon: "🎤", title: "Nicer voice notes", text: "Hold the mic to record, slide to cancel, and play back with speed control." },
      { icon: "🔔", title: "Unread count & new chime", text: "The Chats tab shows how many messages are waiting, with a fresh message sound." },
      { icon: "⚡", title: "Faster everywhere", text: "The app opens and sends messages more quickly." },
    ],
  },
];

export const LATEST_RELEASE = RELEASES[0];
