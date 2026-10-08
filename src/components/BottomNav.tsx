"use client";

import { Tab } from "./AppShell";
import styles from "./BottomNav.module.css";
import Swal from "sweetalert2";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

interface NavTab {
  id: Tab;
  icon: React.ReactNode;
  isCenter?: boolean;
  badge?: number;
}

export default function BottomNav({ active, onChange }: Props) {
  const tabs: NavTab[] = [
    {
      id: "mood",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      ),
    },
    {
      id: "journal",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      id: "action",
      isCenter: true,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
    },
    {
      id: "chats",
      badge: 34,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      id: "more",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <nav className={styles.navBar}>
        {tabs.map((tab) => {
          if (tab.isCenter) {
            return (
              <div key="center" className={styles.centerWrap}>
                <div className={styles.centerCutout}>
                  <button 
                    className={styles.centerBtn}
                    onClick={() => onChange("action")}
                  >
                    {tab.icon}
                  </button>
                </div>
              </div>
            );
          }

          const isActive = active === tab.id;

          return (
            <button
              key={tab.id}
              className={`${styles.item} ${isActive ? styles.active : ""}`}
              onClick={() => onChange(tab.id as Tab)}
            >
              <div className={styles.iconWrap}>
                {tab.icon}
                {tab.badge && <span className={styles.badge}></span>}
              </div>
              {isActive && <div className={styles.activeIndicator} />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
