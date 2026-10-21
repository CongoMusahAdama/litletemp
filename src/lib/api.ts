// The API runs on the same Vercel domain as the app (src/pages/api), so requests
// are same-origin by default. NEXT_PUBLIC_API_URL can point at another server for
// local work; an old Render address is ignored so nothing talks to Render again.
const configuredApi = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
export const API_URL = configuredApi.includes("onrender.com") ? "" : configuredApi;

export type PublicUser = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string;
  coupleId: string;
  notifications: boolean;
  language: string;
  theme: "light" | "dark";
  bubbleColor?: string;
  hasPin: boolean;
  hasPassword: boolean;
  accessId?: string;
  favoriteTeam?: { id: string; name: string; logo: string; league: string } | null;
};

export type CoupleInfo = {
  id: string;
  inviteCode: string;
  status: "pending" | "active";
  expectedPartnerName: string;
  anniversary: string | null;
  currentStreak: number;
  bestStreak?: number;
  wallpaperUrl: string;
  partnerId: string | null;
  gatePassword?: string;
};

const TOKEN_KEY = "lt_token";

export function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const isForm = options.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      cache: "no-store",
      headers: {
        ...(isForm ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // A 404 without our JSON error means the server is running an older version.
    const fallback = response.status === 404
      ? "This feature isn't on the server yet. The backend needs to be redeployed."
      : `Something went wrong (error ${response.status}). Try again.`;
    throw new ApiError(response.status, data.error || fallback);
  }
  return data as T;
}

// Files go straight from the phone to Vercel Blob (no 4.5MB request limit).
// If Blob isn't set up (e.g. local development), small files use the old route.
export async function uploadFile(file: File): Promise<{ url: string }> {
  try {
    const { upload } = await import("@vercel/blob/client");
    const name = (file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
    const blob = await upload(`uploads/${name}`, file, {
      access: "public",
      handleUploadUrl: `${API_URL}/api/uploads/blob`,
      clientPayload: getToken(),
      contentType: file.type || undefined,
    });
    return { url: blob.url };
  } catch (error) {
    if (file.size > 4 * 1024 * 1024) throw error;
    const body = new FormData();
    body.append("file", file);
    return api<{ url: string }>("/api/uploads", { method: "POST", body });
  }
}

export function shownName(person?: { name?: string; username?: string } | null, fallback = "") {
  return person?.name?.trim() || person?.username?.trim() || fallback;
}

export function mediaUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("blob:")) return path;
  return `${API_URL}${path}`;
}
