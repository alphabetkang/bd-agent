import { Rss, MessageSquare, Settings } from "lucide-react";
import styles from "./Sidebar.module.css";

const FEEDS = [
  { name: "Boston BIZ Journal", active: true },
  { name: "Yahoo Finance", active: true },
  { name: "TechCrunch", active: true },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeView: "chat" | "feeds";
  onNavChange: (view: "chat" | "feeds") => void;
}

export function Sidebar({ collapsed, onToggle, activeView, onNavChange }: SidebarProps) {
  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
      <div className={styles.logo} onClick={onToggle} title="Toggle sidebar">
        <MessageSquare size={16} color="var(--accent)" />
        {!collapsed && <span className={styles.logoText}>BD Agent</span>}
      </div>

      {!collapsed && (
        <>
          <div className={styles.section}>
            <span className={styles.sectionLabel}>News Sources</span>
            <ul className={styles.feedList}>
              {FEEDS.map((f) => (
                <li key={f.name} className={styles.feedItem}>
                  <span
                    className={`${styles.dot} ${f.active ? styles.dotActive : ""}`}
                  />
                  <span className={styles.feedName}>{f.name}</span>
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
