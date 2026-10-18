export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3005";

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

export function uploadFile(file: File) {
  const body = new FormData();
  body.append("file", file);
  return api<{ url: string }>("/api/uploads", { method: "POST", body });
}

export function shownName(person?: { name?: string; username?: string } | null, fallback = "") {
  return person?.name?.trim() || person?.username?.trim() || fallback;
}

export function mediaUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("blob:")) return path;
  return `${API_URL}${path}`;
}
