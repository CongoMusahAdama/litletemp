"use client";

import { useState, useRef } from "react";
import styles from "./MoreTab.module.css";
import Swal from "sweetalert2";

const menuItems = [
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

export default function MoreTab() {
  const [avatarSrc, setAvatarSrc] = useState("https://ui-avatars.com/api/?name=C+K&background=FBBF24&color=1a1a1a&size=200&bold=true");
  const [name] = useState("Charlotte King");
  const [username] = useState("@charlotteking");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("Charlotte King");
  const [editUsername, setEditUsername] = useState("@charlotteking");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setAvatarSrc(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleLogout = () => {
    Swal.fire({
      title: "Log out?",
      text: "Are you sure you want to leave our space?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#FBBF24",
      confirmButtonText: "Yes, log out",
      cancelButtonColor: "#1a1a1a",
      background: "#fff",
      color: "#1a1a1a",
    }).then((r) => {
      if (r.isConfirmed) window.location.reload();
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
          <button className={styles.saveBtn} onClick={() => setIsEditing(false)}>Save</button>
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

  return (
    <div className={styles.tab}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>My Profile</h1>
        <button className={styles.headerIconBtn}>
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
          <div className={styles.statItem}>
            <span className={styles.statNum}>48</span>
            <span className={styles.statLabel}>Memories</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={styles.statNum}>12</span>
            <span className={styles.statLabel}>Bucket List</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={styles.statNum}>42</span>
            <span className={styles.statLabel}>Days to Go</span>
          </div>
        </div>

        {/* Menu */}
        <div className={styles.menuCard}>
          {menuItems.map((item, i) => (
            <button
              key={item.id}
              className={styles.menuRow}
              style={{ borderBottom: i < menuItems.length - 1 ? "1px solid #f3f4f6" : "none" }}
            >
              <div className={styles.menuIconBox} style={{ background: item.iconBg }}>
                <span style={{ color: item.iconColor, width: 20, height: 20, display: "flex" }}>
                  {item.icon}
                </span>
              </div>
              <div className={styles.menuText}>
                <span className={styles.menuLabel}>{item.label}</span>
                <span className={styles.menuSub}>{item.sub}</span>
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
