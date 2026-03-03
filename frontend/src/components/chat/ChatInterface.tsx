"use client";

import { ChatSession, ChatStatus } from "@/types";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { ChatTabs } from "./ChatTabs";
import { Spinner } from "@/components/ui/Spinner";
import styles from "./ChatInterface.module.css";

interface ChatInterfaceProps {
  sessions: ChatSession[];
  activeId: string;
  status: ChatStatus;
  statusHistory: ChatStatus[];
  selectedMessageId: string | null;
  onSend: (query: string) => void;
  onAbort: () => void;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onCloseSession: (id: string) => void;
  onSelectMessage: (messageId: string | null) => void;
}

export function ChatInterface({
  sessions,
  activeId,
  status,
  statusHistory,
  selectedMessageId,
  onSend,
  onAbort,
  onSelectSession,
  onNewSession,
  onCloseSession,
  onSelectMessage,
}: ChatInterfaceProps) {
  const isStreaming = status !== "idle" && status !== "done" && status !== "error";
  const activeSession = sessions.find((s) => s.id === activeId)!;

  return (
    <div className={styles.chatInterface}>
      <header className={styles.header}>
        <span className={styles.headerTitle}>Intelligence Chat</span>
        {isStreaming && <Spinner size={12} />}
      </header>

      <ChatTabs
        sessions={sessions}
        activeId={activeId}
        onSelect={onSelectSession}
        onNew={onNewSession}
        onClose={onCloseSession}
      />

      <MessageList
        messages={activeSession?.messages ?? []}
        selectedMessageId={selectedMessageId}
        statusHistory={statusHistory}
        onSend={onSend}
        onSelectMessage={onSelectMessage}
      />

      <ChatInput onSend={onSend} onAbort={onAbort} isStreaming={isStreaming} />
    </div>
  );
}
