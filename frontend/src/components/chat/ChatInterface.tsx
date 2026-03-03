"use client";

import { useEffect, useRef } from "react";
import { ChatStatus, Message } from "@/types";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { Spinner } from "@/components/ui/Spinner";
import styles from "./ChatInterface.module.css";

interface ChatInterfaceProps {
  messages: Message[];
  status: ChatStatus;
  statusText: string;
  onSend: (query: string) => void;
  onAbort: () => void;
}

export function ChatInterface({
  messages,
  status,
  statusText,
  onSend,
  onAbort,
}: ChatInterfaceProps) {
  const isStreaming = status !== "idle" && status !== "done" && status !== "error";

  return (
    <div className={styles.chatInterface}>
      <header className={styles.header}>
        <span className={styles.headerTitle}>Intelligence Chat</span>
        {isStreaming && (
          <div className={styles.statusBadge}>
            <Spinner size={12} />
            <span>{statusText}</span>
          </div>
        )}
      </header>

      <MessageList messages={messages} onSend={onSend} />

      <ChatInput
        onSend={onSend}
        onAbort={onAbort}
        isStreaming={isStreaming}
      />
    </div>
  );
}
