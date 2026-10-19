// Save a chat photo or video to the phone.
// On phones the share sheet offers "Save image" / "Save video" straight to the gallery;
// elsewhere the file is downloaded.

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export async function saveMedia(url: string, kind: "image" | "video"): Promise<"shared" | "downloaded" | "cancelled"> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load the file");
  const blob = await response.blob();
  const type = blob.type || (kind === "video" ? "video/mp4" : "image/jpeg");
  const name = `little-temptation-${Date.now()}.${EXT[type] || (kind === "video" ? "mp4" : "jpg")}`;
  const file = new File([blob], name, { type });

  const touch = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Fall through to a normal download.
    }
  }

  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
  return "downloaded";
}
