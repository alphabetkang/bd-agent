import { Plus, X } from "lucide-react";
import { ChatSession } from "@/types";
import styles from "./ChatTabs.module.css";

interface ChatTabsProps {
  sessions: ChatSession[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: (id: string) => void;
}

export function ChatTabs({ sessions, activeId, onSelect, onNew, onClose }: ChatTabsProps) {
  return (
    <div className={styles.tabs}>
      <div className={styles.tabList}>
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`${styles.tab} ${s.id === activeId ? styles.tabActive : ""}`}
            onClick={() => onSelect(s.id)}
            title={s.title}
          >
            <span className={styles.tabTitle}>{s.title}</span>
            {sessions.length > 1 && (
              <button
                className={styles.closeBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(s.id);
                }}
                title="Close chat"
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button className={styles.newBtn} onClick={onNew} title="New chat">
        <Plus size={13} />
      </button>
    </div>
  );
}
