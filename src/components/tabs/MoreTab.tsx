"use client";

import { useEffect, useState, useRef } from "react";
import styles from "./MoreTab.module.css";
import Swal from "sweetalert2";
import { api, mediaUrl, uploadFile } from "@/lib/api";
import { useSession } from "@/context/SessionContext";
import { useTheme } from "@/context/ThemeContext";
import { applyBubble, BUBBLES } from "@/lib/bubbles";
import GamesScreen from "../GamesScreen";

const menuItems = [
  {
    id: "play",
    label: "Play",
    sub: "Couple games",
    iconBg: "#FEF3C7",
    iconColor: "#D97706",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <circle cx="8" cy="8" r="1.2" fill="currentColor" />
        <circle cx="16" cy="8" r="1.2" fill="currentColor" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" />
        <circle cx="8" cy="16" r="1.2" fill="currentColor" />
        <circle cx="16" cy="16" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "favourites",
    label: "Favourites",
    sub: "Saved memories",
    iconBg: "#FEF3C7",
    iconColor: "#F59E0B",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    id: "notifications",
    label: "Notifications",
    sub: "All on",
    iconBg: "#FEE2E2",
    iconColor: "#EF4444",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    id: "language",
    label: "Language",
    sub: "English",
    iconBg: "#DBEAFE",
    iconColor: "#3B82F6",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    id: "privacy",
    label: "Privacy & PIN",
    sub: "Change your PIN",
    iconBg: "#D1FAE5",
    iconColor: "#10B981",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    id: "anniversary",
    label: "Anniversary",
    sub: "42 days to go",
    iconBg: "#EDE9FE",
    iconColor: "#8B5CF6",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    id: "bubble",
    label: "Chat bubble",
    sub: "Yellow",
    iconBg: "#FEF3C7",
    iconColor: "#F59E0B",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: "theme",
    label: "Appearance",
    sub: "Light mode",
    iconBg: "#FEF9C3",
    iconColor: "#CA8A04",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    ),
  },
];

function anniversaryLabel(value: string) {
  if (!value) return "Pick a date";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const picked = new Date(`${value}T00:00:00`);
  const days = Math.round((picked.getTime() - today.getTime()) / 86400000);
  if (days > 0) return `${days} days to go`;
  if (days === 0) return "That's today";
  return `${Math.abs(days)} days together`;
}

export default function MoreTab() {
  const { user, refresh, logout, couple } = useSession();
  const { theme, setTheme } = useTheme();
  const [panel, setPanel] = useState<string | null>(null);
  const [favourites, setFavourites] = useState<{ id: string; title: string; date: string }[]>([]);
  const [bucketItems, setBucketItems] = useState<{ id: string; title: string; completed: boolean }[]>([]);
  const [pin, setPin] = useState("");
  const [anniversary, setAnniversary] = useState("");
  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "Us")}&background=FBBF24&color=1a1a1a&size=200&bold=true`;
  const [avatarSrc, setAvatarSrc] = useState(fallbackAvatar);
  const [name, setName] = useState(user?.name || "");
  const [username, setUsername] = useState(user?.username ? `@${user.username}` : "");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || "");
  const [editUsername, setEditUsername] = useState(user?.username ? `@${user.username}` : "");
  const [stats, setStats] = useState({ memories: 0, bucket: 0, daysToGo: null as number | null });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setUsername(user.username ? `@${user.username}` : "");
    setEditName(user.name);
    setEditUsername(user.username ? `@${user.username}` : "");
    setAvatarSrc(user.avatarUrl ? mediaUrl(user.avatarUrl) : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=FBBF24&color=1a1a1a&size=200&bold=true`);
  }, [user]);

  useEffect(() => {
    api<typeof stats>("/api/me/stats").then(setStats).catch(() => undefined);
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const uploaded = await uploadFile(file);
      setAvatarSrc(mediaUrl(uploaded.url));
      await api("/api/me", { method: "PATCH", body: JSON.stringify({ avatarUrl: uploaded.url }) });
      await refresh();
    } catch {
      setAvatarSrc(URL.createObjectURL(file));
    }
  };

  const openPanel = (id: string) => {
    setPanel(id);
    if (id === "favourites") {
      api<{ id: string; title: string; date: string }[]>("/api/journal?favorite=true")
        .then(setFavourites)
        .catch(() => setFavourites([]));
    }
    if (id === "bucket") {
      api<{ id: string; title: string; completed: boolean }[]>("/api/bucket")
        .then(setBucketItems)
        .catch(() => setBucketItems([]));
    }
    if (id === "anniversary" && couple?.anniversary) {
      setAnniversary(String(couple.anniversary).slice(0, 10));
    }
  };

  const saveSetting = async (body: Record<string, unknown>, path = "/api/me") => {
    await api(path, { method: "PATCH", body: JSON.stringify(body) });
    await refresh();
    if (path === "/api/me/couple") {
      const next = await api<typeof stats>("/api/me/stats");
      setStats(next);
    }
  };

  const saveProfile = async () => {
    try {
      await api("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ name: editName, username: editUsername }),
      });
      setName(editName);
      setUsername(editUsername.startsWith("@") || !editUsername ? editUsername : `@${editUsername}`);
      await refresh();
      setIsEditing(false);
    } catch (error) {
      Swal.fire({ title: "Could not save", text: error instanceof Error ? error.message : "Try again", icon: "error" });
    }
  };

  const handleLogout = () => {
    Swal.fire({
      title: "Logging Out?",
      text: "Please tell your partner why you are logging out before you go:",
      input: "text",
      inputPlaceholder: "e.g., Going to sleep, Phone dying...",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#FBBF24",
      confirmButtonText: "Confirm Logout",
      cancelButtonColor: "#1a1a1a",
      background: "#fff",
      color: "#1a1a1a",
      inputValidator: (value) => {
        if (!value) {
          return "You need to provide a reason for your partner!";
        }
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        await api("/api/me/logout", { method: "POST", body: JSON.stringify({ reason: result.value }) });
        await Swal.fire({
          title: "Notified",
          text: "Your partner has been notified.",
          icon: "success",
          timer: 1500,
          showConfirmButton: false
        });
        logout();
        window.location.reload();
      }
    });
  };

  if (isEditing) {
    return (
      <div className={styles.tab}>
        <div className={styles.editHeader}>
          <button className={styles.headerIconBtn} onClick={() => setIsEditing(false)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className={styles.pageTitle}>Edit Profile</h1>
          <button className={styles.saveBtn} onClick={saveProfile}>Save</button>
        </div>
        <div className={styles.editContent}>
          <div className={styles.editAvatarArea}>
            <img src={avatarSrc} alt="avatar" className={styles.editAvatar} />
            <button className={styles.changePhotoBtn} onClick={() => fileRef.current?.click()}>
              Change Photo
            </button>
            <input type="file" accept="image/*" ref={fileRef} onChange={handleAvatarChange} style={{ display: "none" }} />
          </div>
          <div className={styles.editForm}>
            <div className={styles.editField}>
              <label>Name</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className={styles.editField}>
              <label>Username</label>
              <input type="text" value={editUsername} onChange={e => setEditUsername(e.target.value)} />
            </div>
            <div className={styles.editField}>
              <label>Password</label>
              <input type="password" defaultValue="1907" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (panel === "play") {
    return <GamesScreen onBack={() => setPanel(null)} />;
  }

  if (panel) {
    const title = menuItems.find((item) => item.id === panel)?.label || "Bucket list";
    return (
      <div className={styles.tab}>
        <div className={styles.editHeader}>
          <button className={styles.headerIconBtn} onClick={() => setPanel(null)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className={styles.pageTitle}>{title}</h1>
          <span style={{ width: 36 }} />
        </div>
        <div className={styles.editContent}>
          {panel === "favourites" && (
            favourites.length === 0
              ? <p className={styles.footer}>No saved memories yet. Heart a journal entry to keep it here.</p>
              : favourites.map((entry) => (
                <div key={entry.id} className={styles.editField}><label>{entry.date}</label><p>{entry.title}</p></div>
              ))
          )}
          {panel === "bucket" && (
            bucketItems.length === 0
              ? <p className={styles.footer}>Your bucket list is empty.</p>
              : bucketItems.map((item) => (
                <div key={item.id} className={styles.editField}><p>{item.completed ? "Done" : "Open"} · {item.title}</p></div>
              ))
          )}
          {panel === "notifications" && (
            <div className={styles.editForm}>
              <button className={styles.editProfileBtn} onClick={() => saveSetting({ notifications: !(user?.notifications !== false) }).then(() => setPanel(null))}>
                {user?.notifications === false ? "Turn notifications on" : "Turn notifications off"}
              </button>
            </div>
          )}
          {panel === "language" && (
            <div className={styles.editForm}>
              {["English", "French", "Spanish", "Twi"].map((language) => (
                <button key={language} className={styles.menuRow} onClick={() => saveSetting({ language }).then(() => setPanel(null))}>
                  <span className={styles.menuLabel}>{language}</span>
                  {user?.language === language && <span>✓</span>}
                </button>
              ))}
            </div>
          )}
          {panel === "privacy" && (
            <div className={styles.editForm}>
              <div className={styles.editField}>
                <label>New PIN</label>
                <input type="password" inputMode="numeric" maxLength={6} value={pin} placeholder="4 to 6 digits" onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
              </div>
              <button className={styles.editProfileBtn} onClick={() => saveSetting({ pin }).then(() => { setPin(""); setPanel(null); }).catch((error) => Swal.fire({ title: "Could not save PIN", text: error instanceof Error ? error.message : "Try again", icon: "error" }))}>
                Save PIN
              </button>
            </div>
          )}
          {panel === "anniversary" && (
            <div className={styles.dayScreen}>
              <div className={styles.dayHero}>
                <span className={styles.dayHeart}>♥</span>
                <p className={styles.dayCount}>{anniversaryLabel(anniversary)}</p>
                <p className={styles.dayHint}>The day that belongs to just the two of you.</p>
              </div>
              <label className={styles.dayField}>
                <span>Our day</span>
                <input type="date" value={anniversary} onChange={(e) => setAnniversary(e.target.value)} />
              </label>
              <button
                className={styles.daySave}
                disabled={!anniversary}
                onClick={() => saveSetting({ anniversary }, "/api/me/couple").then(() => setPanel(null))}
              >
                Save our day
              </button>
            </div>
          )}
          {panel === "bubble" && (
            <div className={styles.bubbleGrid}>
              {BUBBLES.map((item) => {
                const current = user?.bubbleColor || (typeof window !== "undefined" ? localStorage.getItem("lt_bubble") : "") || "#FBBF24";
                const selected = current.toLowerCase() === item.color.toLowerCase();
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.bubbleDot} ${selected ? styles.bubbleOn : ""}`}
                    style={{ background: item.color }}
                    aria-label={item.id}
                    onClick={() => {
                      applyBubble(item.color);
                      saveSetting({ bubbleColor: item.color }).catch(() => undefined);
                    }}
                  >
                    {selected && <span style={{ color: item.ink }}>✓</span>}
                  </button>
                );
              })}
            </div>
          )}
          {panel === "theme" && (
            <div className={styles.editForm}>
              {(["light", "dark"] as const).map((mode) => (
                <button key={mode} className={styles.menuRow} onClick={() => { setTheme(mode); saveSetting({ theme: mode }).then(() => setPanel(null)); }}>
                  <span className={styles.menuLabel}>{mode === "light" ? "Light mode" : "Dark mode"}</span>
                  {theme === mode && <span>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const subs: Record<string, string> = {
    favourites: "Saved memories",
    notifications: user?.notifications === false ? "Off" : "All on",
    language: user?.language || "English",
    privacy: user?.hasPin ? "PIN is on" : "Set a PIN",
    anniversary: stats.daysToGo == null ? "Set your date" : `${stats.daysToGo} days to go`,
    theme: theme === "dark" ? "Dark mode" : "Light mode",
    bubble: "Your message color",
  };

  return (
    <div className={styles.tab}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>My Profile</h1>
        <button className={styles.headerIconBtn} onClick={() => openPanel("theme")} aria-label="Appearance">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      <div className={styles.scrollArea}>
        {/* Profile hero card */}
        <div className={styles.heroCard}>
          <div className={styles.heroAvatarWrap}>
            <img src={avatarSrc} alt="avatar" className={styles.heroAvatar} />
            <button className={styles.cameraBtn} onClick={() => fileRef.current?.click()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
          </div>
          <input type="file" accept="image/*" ref={fileRef} onChange={handleAvatarChange} style={{ display: "none" }} />
          <div className={styles.heroInfo}>
            <h2 className={styles.heroName}>{name}</h2>
            <p className={styles.heroUsername}>{username}</p>
          </div>
          <button className={styles.editProfileBtn} onClick={() => setIsEditing(true)}>
            Edit Profile
          </button>
        </div>

        {/* Stats row */}
        <div className={styles.statsRow}>
          <button className={styles.statItem} onClick={() => openPanel("favourites")}>
            <span className={styles.statNum}>{stats.memories}</span>
            <span className={styles.statLabel}>Memories</span>
          </button>
          <div className={styles.statDivider} />
          <button className={styles.statItem} onClick={() => openPanel("bucket")}>
            <span className={styles.statNum}>{stats.bucket}</span>
            <span className={styles.statLabel}>Bucket List</span>
          </button>
          <div className={styles.statDivider} />
          <button className={styles.statItem} onClick={() => openPanel("anniversary")}>
            <span className={styles.statNum}>{stats.daysToGo ?? "—"}</span>
            <span className={styles.statLabel}>Days to Go</span>
          </button>
        </div>

        {/* Menu */}
        <div className={styles.menuCard}>
          {menuItems.map((item, i) => (
            <button
              key={item.id}
              className={styles.menuRow}
              style={{ borderBottom: i < menuItems.length - 1 ? "1px solid #f3f4f6" : "none" }}
              onClick={() => openPanel(item.id)}
            >
              <div className={styles.menuIconBox} style={{ background: item.iconBg }}>
                <span style={{ color: item.iconColor, width: 20, height: 20, display: "flex" }}>
                  {item.icon}
                </span>
              </div>
              <div className={styles.menuText}>
                <span className={styles.menuLabel}>{item.label}</span>
                <span className={styles.menuSub}>{subs[item.id] || item.sub}</span>
              </div>
              <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
        </div>

        {/* Logout */}
        <button className={styles.logoutBtn} onClick={handleLogout}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Log out
        </button>

        <p className={styles.footer}>Made with love, just for us</p>
        <div style={{ height: 100 }} />
      </div>
    </div>
  );
}
