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
};

export type CoupleInfo = {
  id: string;
  inviteCode: string;
  status: "pending" | "active";
  expectedPartnerName: string;
  anniversary: string | null;
  currentStreak: number;
  wallpaperUrl: string;
  partnerId: string | null;
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

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const isForm = options.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data as T;
}

export function uploadFile(file: File) {
  const body = new FormData();
  body.append("file", file);
  return api<{ url: string }>("/api/uploads", { method: "POST", body });
}

export function shownName(person?: { name?: string; username?: string } | null, fallback = "") {
  const username = person?.username?.trim();
  if (username) return username;
  return person?.name?.trim() || fallback;
}

export function mediaUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("blob:")) return path;
  return `${API_URL}${path}`;
}
