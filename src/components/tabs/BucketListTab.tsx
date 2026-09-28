"use client";

import { useState } from "react";
import styles from "./BucketListTab.module.css";

interface BucketItem {
  id: number;
  title: string;
  description?: string;
  completed: boolean;
  category: "travel" | "date" | "memory" | "personal" | "journal";
  dateAdded: string;
  targetDate?: string;
}

const initialItems: BucketItem[] = [
  { id: 1, title: "Visit Paris together", description: "Eiffel Tower, Louvre, Seine river cruise", completed: false, category: "travel", dateAdded: "Jan 2024", targetDate: "Summer 2025" },
  { id: 2, title: "Learn to cook Italian together", description: "Pasta making class + tiramisu", completed: true, category: "date", dateAdded: "Feb 2024", targetDate: "Mar 2024" },
  { id: 3, title: "Write our story in the journal", description: "Document our journey from day 1", completed: false, category: "journal", dateAdded: "Mar 2024" },
  { id: 4, title: "Road trip to the coast", description: "No GPS, just us and music", completed: false, category: "travel", dateAdded: "Apr 2024", targetDate: "June 2024" },
  { id: 5, title: "Build a blanket fort & watch movies", description: "Cozy night with fairy lights", completed: true, category: "date", dateAdded: "May 2024" },
  { id: 6, title: "Plant a tree together", description: "Our growing memory", completed: false, category: "memory", dateAdded: "Jun 2024", targetDate: "Fall 2024" },
];

const categories = [
  { id: "all", label: "All", icon: "📋" },
  { id: "travel", label: "Travel", icon: "✈️" },
  { id: "date", label: "Dates", icon: "💑" },
  { id: "memory", label: "Memories", icon: "📸" },
  { id: "journal", label: "Journal", icon: "📖" },
  { id: "personal", label: "Personal", icon: "✨" },
] as const;

export default function BucketListTab() {
  const [items, setItems] = useState<BucketItem[]>(initialItems);
  const [activeCategory, setActiveCategory] = useState<"all" | "travel" | "date" | "memory" | "personal" | "journal">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState<BucketItem["category"]>("travel");
  const [newTargetDate, setNewTargetDate] = useState("");

  const filteredItems = activeCategory === "all"
    ? items
    : items.filter(item => item.category === activeCategory);

  const addItem = () => {
    if (!newTitle.trim()) return;
    const next: BucketItem = {
      id: Date.now(),
      title: newTitle,
      description: newDescription,
      completed: false,
      category: newCategory,
      dateAdded: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      targetDate: newTargetDate || undefined,
    };
    setItems([next, ...items]);
    setNewTitle("");
    setNewDescription("");
    setNewCategory("travel");
    setNewTargetDate("");
    setShowAddModal(false);
  };

  const toggleComplete = (id: number) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const deleteItem = (id: number) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const completedCount = items.filter(i => i.completed).length;
  const totalCount = items.length;

  return (
    <div className={styles.tab}>
      <header className={styles.header}>
        <h1 className={styles.title}>Our Bucket List</h1>
        <div className={styles.progress}>
          <span>{completedCount} / {totalCount}</span>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: totalCount ? `${(completedCount / totalCount) * 100}%` : "0%" }} />
          </div>
        </div>
        <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </header>

      <div className={styles.categoryBar}>
        {categories.map(cat => (
          <button
            key={cat.id}
            className={`${styles.catBtn} ${activeCategory === cat.id ? styles.catActive : ""}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      <div className={styles.list}>
        {filteredItems.length === 0 ? (
          <div className={styles.empty}>
            <p>No items yet</p>
            <button className={styles.addFirstBtn} onClick={() => setShowAddModal(true)}>Add your first wish</button>
          </div>
        ) : (
          filteredItems.map(item => (
            <div key={item.id} className={styles.item}>
              <button
                className={`${styles.checkbox} ${item.completed ? styles.checked : ""}`}
                onClick={() => toggleComplete(item.id)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
              <div className={styles.itemContent}>
                <div className={styles.itemHeader}>
                  <h3 className={`${styles.itemTitle} ${item.completed ? styles.completed : ""}`}>{item.title}</h3>
                  <span className={`${styles.catTag} ${styles["cat-" + item.category]}`}>{item.category}</span>
                </div>
                {item.description && <p className={styles.itemDesc}>{item.description}</p>}
                <div className={styles.itemMeta}>
                  <span>Added {item.dateAdded}</span>
                  {item.targetDate && <span>🎯 {item.targetDate}</span>}
                </div>
              </div>
              <button className={styles.deleteBtn} onClick={() => deleteItem(item.id)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Add to Bucket List</h2>
              <button className={styles.modalClose} onClick={() => setShowAddModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <input
              type="text"
              className={styles.modalInput}
              placeholder="What do you want to do together?"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              autoFocus
            />
            <textarea
              className={styles.modalTextarea}
              placeholder="Add details... (optional)"
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              rows={3}
            />
            <div className={styles.modalField}>
              <label>Category</label>
              <select value={newCategory} onChange={e => setNewCategory(e.target.value as BucketItem["category"])} className={styles.modalSelect}>
                {categories.filter(c => c.id !== "all").map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.modalField}>
              <label>Target Date (optional)</label>
              <input type="date" className={styles.modalInput} value={newTargetDate} onChange={e => setNewTargetDate(e.target.value)} />
            </div>
            <button className={styles.modalSave} onClick={addItem}>Add to List</button>
          </div>
        </div>
      )}

      <div style={{ height: 100 }} />
    </div>
  );
}