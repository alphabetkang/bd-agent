"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "@/types";
import { Spinner } from "@/components/ui/Spinner";
import styles from "./MessageItem.module.css";

interface MessageItemProps {
  message: Message;
  selected: boolean;
  onSelect: (id: string | null) => void;
}

export function MessageItem({ message, selected, onSelect }: MessageItemProps) {
  const isUser = message.role === "user";
  const isSelectable = !isUser && !!message.companies?.length && !message.isStreaming;

  function handleClick() {
    if (!isSelectable) return;
    onSelect(selected ? null : message.id);
  }

  return (
    <div
      className={`${styles.wrapper} ${isUser ? styles.user : styles.assistant} ${selected ? styles.selected : ""} ${isSelectable ? styles.selectable : ""}`}
      onClick={handleClick}
    >
      <div className={`${styles.avatar} ${isUser ? styles.avatarUser : styles.avatarAssistant}`}>
        {isUser ? "U" : "AI"}
      </div>

      <div className={styles.bubble}>
        {isUser ? (
          <p className={styles.userText}>{message.content}</p>
        ) : (
          <div className={styles.markdownWrapper}>
            {message.content ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            ) : message.isStreaming ? (
              <div className={styles.thinkingDots}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
            ) : null}
            {message.isStreaming && message.content && (
              <span className={styles.cursor} aria-hidden />
            )}
          </div>
        )}

        {!isUser && message.companies && message.companies.length > 0 && (
          <div className={styles.companyCount}>
            <span className={`${styles.countBadge} ${selected ? styles.countBadgeSelected : ""}`}>
              {message.companies.length}{" "}
              {message.companies.length === 1 ? "company" : "companies"} identified
              {isSelectable && !selected && <span className={styles.viewHint}> · click to view</span>}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
