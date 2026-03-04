"use client";

import { useEffect, useRef } from "react";
import { ChatStatus, Message } from "@/types";
import { MessageItem } from "./MessageItem";
import styles from "./MessageList.module.css";

interface MessageListProps {
  messages: Message[];
  selectedMessageId: string | null;
  statusHistory: ChatStatus[];
  onSend: (query: string) => void;
  onSelectMessage: (id: string | null) => void;
}

export function MessageList({
  messages,
  selectedMessageId,
  statusHistory,
  onSend,
  onSelectMessage,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Build pairs: { command (user/notification), response (assistant | null) }
  const items: { command: Message; response: Message | null }[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].isNotification) {
      items.push({ command: messages[i], response: null });
    } else if (messages[i].role === "user") {
      const next = messages[i + 1];
      const response = next?.role === "assistant" ? next : null;
      items.push({ command: messages[i], response });
    }
  }

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyInner}>
          <span className={styles.emptyTitle}>Business Intelligence</span>
          <p className={styles.emptyText}>
            Ask about companies, market trends, funding rounds, or industry news.
          </p>
          <div className={styles.suggestions}>
            {[
              "What Boston-area startups raised funding recently?",
              "Which companies are expanding in AI infrastructure?",
              "What are the latest fintech trends?",
            ].map((s) => (
              <span key={s} className={styles.suggestion} onClick={() => onSend(s)}>
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {items.map(({ command, response }) => (
        <MessageItem
          key={command.id}
          message={command}
          response={response}
          selected={response?.id === selectedMessageId}
          onSelect={onSelectMessage}
          statusHistory={response?.isStreaming ? statusHistory : undefined}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
