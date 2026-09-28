"use client";

import styles from "./ChatsTab.module.css";

interface Props {
  onOpenChat: () => void;
}

export default function ChatsTab({ onOpenChat }: Props) {
  return (
    <div className={styles.tab}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>Chats</h1>
        <button id="btn-new-chat" className={styles.newBtn}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </header>

      {/* Stories Row */}
      <div className={styles.storiesWrap}>
        <div className={styles.storiesScroll}>
          {/* Add story */}
          <button className={styles.storyItem}>
            <div className={styles.storyAddBtn}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <span className={styles.storyName}>My Story</span>
          </button>

          {/* Babe's story — unseen (gradient ring) */}
          <button className={styles.storyItem} onClick={onOpenChat}>
            <div className={`${styles.storyRing} ${styles.storyUnseen}`}>
              <div className={styles.storyAvatar} style={{ background: "var(--brand)" }}>
                <span>B</span>
              </div>
            </div>
            <span className={styles.storyName}>Babe</span>
          </button>
        </div>
      </div>

      {/* Single chat entry — My Babe */}
      <div className={styles.list}>
        <button id="btn-chat-1" className={styles.chatItem} onClick={onOpenChat}>
          <div className={styles.avatarWrap}>
            <div className={styles.avatar} style={{ background: "var(--brand)" }}>
              B
            </div>
            <span className={styles.onlineDot} />
          </div>

          <div className={styles.chatContent}>
            <div className={styles.topRow}>
              <span className={styles.chatName}>
                My Babe
                <span className={styles.streak}>🔥 142</span>
              </span>
              <span className={`${styles.time} ${styles.timeUnread}`}>now</span>
            </div>
            <div className={styles.bottomRow}>
              <span className={styles.lastMsg}>I miss you so much right now</span>
              <span className={styles.badge}>3</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

