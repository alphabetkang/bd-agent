"use client";

import { Plus, Rss, MessageSquare, Settings, FileText, Globe } from "lucide-react";
import { UserSource } from "@/types";
import styles from "./Sidebar.module.css";

const FEEDS = [
  // { name: "Boston BIZ Journal", active: true },
  // { name: "Yahoo Finance", active: true },
  { name: "TechCrunch", active: true },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeView: "chat" | "feeds";
  onNavChange: (view: "chat" | "feeds") => void;
  onAddSource: () => void;
  userSources?: UserSource[];
}

export function Sidebar({ collapsed, onToggle, activeView, onNavChange, onAddSource, userSources = [] }: SidebarProps) {
  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
      {/* Logo + Add Source button */}
      <div className={styles.logoRow}>
        <div className={styles.logo} onClick={onToggle} title="Toggle sidebar">
          <MessageSquare size={16} color="var(--accent)" />
          {!collapsed && <span className={styles.logoText}>BD Agent</span>}
        </div>
        {/* <button
          className={styles.addBtn}
          onClick={onAddSource}
          title="Add data source"
        >
          <Plus size={14} />
          {!collapsed && <span>Add Source</span>}
        </button> */}
      </div>

      {!collapsed && (
        <>
          <div className={styles.section}>
            <span className={styles.sectionLabel}>News Sources</span>
            <ul className={styles.feedList}>
              {FEEDS.map((f) => (
                <li key={f.name} className={styles.feedItem}>
                  <span className={`${styles.dot} ${f.active ? styles.dotActive : ""}`} />
                  <span className={styles.feedName}>{f.name}</span>
                </li>
              ))}
              {userSources.map((s) => (
                <li key={s.id} className={styles.feedItem}>
                  <span className={`${styles.dot} ${styles.dotActive}`} />
                  <span className={styles.feedSourceIcon}>
                    {s.type === "pdf" || s.type === "docx" || s.type === "file"
                      ? <FileText size={10} />
                      : s.type === "url"
                      ? <Globe size={10} />
                      : <Rss size={10} />}
                  </span>
                  <span className={styles.feedName}>{s.name}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.section}>
            <span className={styles.sectionLabel}>Tools</span>
            <ul className={styles.navList}>
              <li
                className={`${styles.navItem} ${activeView === "chat" ? styles.navActive : ""}`}
                onClick={() => onNavChange("chat")}
              >
                <MessageSquare size={14} />
                <span>Chat</span>
              </li>
              <li
                className={`${styles.navItem} ${activeView === "feeds" ? styles.navActive : ""}`}
                onClick={() => onNavChange("feeds")}
              >
                <Rss size={14} />
                <span>Feeds</span>
              </li>
            </ul>
          </div>
        </>
      )}

      <div className={styles.footer}>
        <Settings size={14} color="var(--text-muted)" />
        {!collapsed && <span className={styles.footerText}>Settings</span>}
      </div>
    </aside>
  );
}
