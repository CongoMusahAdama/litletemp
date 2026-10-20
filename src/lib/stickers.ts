import { api, uploadFile } from "./api";

export type SavedSticker = { id: string; mediaUrl: string };

/** Big emoji stickers that come with the app. */
export const LOVE_PACK = [
  "🥰", "😘", "😍", "💋", "🫶", "❤️‍🔥", "💞", "🤗",
  "🙈", "😂", "🥺", "😴", "😏", "🫣", "😜", "🤤",
  "🌹", "💐", "🍫", "🧸", "🔥", "💯", "👑", "🎉",
];

const EXT: Record<string, string> = { "image/webp": "webp", "image/png": "png", "image/gif": "gif", "image/jpeg": "jpg" };

/** Upload an image (pasted or picked) and keep it in the shared collection. */
export async function saveStickerFile(file: Blob) {
  const type = file.type && EXT[file.type] ? file.type : "image/png";
  const named = new File([file], `sticker-${Date.now()}.${EXT[type]}`, { type });
  const uploaded = await uploadFile(named);
  return api<SavedSticker>("/api/stickers", { method: "POST", body: JSON.stringify({ mediaUrl: uploaded.url }) });
}

/** Read an image from the clipboard, e.g. a sticker copied in WhatsApp. */
export async function readClipboardImage(): Promise<Blob | null> {
  if (!navigator.clipboard?.read) return null;
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const type = item.types.find((kind) => kind.startsWith("image/"));
    if (type) return item.getType(type);
  }
  return null;
}
