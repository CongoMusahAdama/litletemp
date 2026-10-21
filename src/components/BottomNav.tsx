"use client";

import { Tab } from "./AppShell";
import styles from "./BottomNav.module.css";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  /** Unread messages, shown as a number on the Chats tab. */
  unread?: number;
}

interface NavTab {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  badge?: boolean;
}

const TABS: NavTab[] = [
  {
    id: "mood",
    label: "Mood",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    id: "journal",
    label: "Journal",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="4.5" width="17" height="16" rx="4" />
        <line x1="8" y1="2.5" x2="8" y2="6.5" />
        <line x1="16" y1="2.5" x2="16" y2="6.5" />
        <line x1="3.5" y1="10" x2="20.5" y2="10" />
      </svg>
    ),
  },
  {
    id: "chats",
    label: "Chats",
    badge: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3.5c-4.7 0-8.5 3.3-8.5 7.5 0 1.9.8 3.6 2.1 4.9L5 20.5l4.3-1.7c.9.3 1.8.4 2.7.4 4.7 0 8.5-3.3 8.5-7.5S16.7 3.5 12 3.5z" />
        <line x1="8.5" y1="11" x2="8.51" y2="11" />
        <line x1="12" y1="11" x2="12.01" y2="11" />
        <line x1="15.5" y1="11" x2="15.51" y2="11" />
      </svg>
    ),
  },
  {
    id: "more",
    label: "Me",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-1.5a4.5 4.5 0 0 0-4.5-4.5h-7A4.5 4.5 0 0 0 4 19.5V21" />
        <circle cx="12" cy="7.5" r="4" />
      </svg>
    ),
  },
];

export default function BottomNav({ active, onChange, unread = 0 }: Props) {
  return (
    <div className={styles.container}>
      <nav className={styles.navBar} aria-label="Main">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`${styles.item} ${isActive ? styles.active : ""}`}
              onClick={() => onChange(tab.id)}
              aria-label={tab.badge && unread > 0 ? `${tab.label}, ${unread} unread` : tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              <span className={styles.iconWrap}>
                {tab.icon}
                {tab.badge && unread > 0 && (
                  <span key={unread} className={styles.badge}>{unread > 99 ? "99+" : unread}</span>
                )}
              </span>
              {isActive && <span className={styles.label}>{tab.label}</span>}
            </button>
          );
        })}
      </nav>

      <button type="button" className={styles.fab} onClick={() => onChange("action")} aria-label="New journal entry">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
