"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "@/types";
import { Spinner } from "@/components/ui/Spinner";
import styles from "./MessageItem.module.css";

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === "user";

  return (
    <div className={`${styles.wrapper} ${isUser ? styles.user : styles.assistant}`}>
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
            <span className={styles.countBadge}>
              {message.companies.length} {message.companies.length === 1 ? "company" : "companies"} identified
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
