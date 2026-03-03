"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { CompaniesPanel } from "@/components/companies/CompaniesPanel";
import { FeedsView } from "@/components/feeds/FeedsView";
import { useSessions } from "@/hooks/useSessions";
import styles from "./AppLayout.module.css";

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<"chat" | "feeds">("chat");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  const {
    sessions,
    activeId,
    activeSession,
    status,
    statusText,
    setActiveId,
    newSession,
    closeSession,
    sendMessage,
    abort,
  } = useSessions();

  // When switching sessions, clear the selected message
  function handleSelectSession(id: string) {
    setActiveId(id);
    setSelectedMessageId(null);
  }

  function handleNewSession() {
    newSession();
    setSelectedMessageId(null);
  }

  // Derive selected message from the active session
  const selectedMessage =
    activeSession?.messages.find((m) => m.id === selectedMessageId) ?? null;

  // Fallback: if nothing is selected and the active session has a streaming
  // assistant message, show its companies (live updating) in the panel
  const displayMessage =
    selectedMessage ??
    (() => {
      const msgs = activeSession?.messages ?? [];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant" && msgs[i].isStreaming) return msgs[i];
      }
      return null;
    })();

  const latestQuery = (() => {
    const msgs = activeSession?.messages ?? [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "user") return msgs[i].content;
    }
    return "";
  })();

  const isStreaming = status !== "idle" && status !== "done" && status !== "error";

  return (
    <div className={styles.appLayout}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
        activeView={activeView}
        onNavChange={setActiveView}
      />

      <main className={styles.main}>
        {activeView === "chat" ? (
          <ChatInterface
            sessions={sessions}
            activeId={activeId}
            status={status}
            statusText={statusText}
            selectedMessageId={selectedMessageId}
            onSend={sendMessage}
            onAbort={abort}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewSession}
            onCloseSession={closeSession}
            onSelectMessage={setSelectedMessageId}
          />
        ) : (
          <FeedsView />
        )}
      </main>

      <CompaniesPanel
        selectedMessage={displayMessage}
        latestQuery={latestQuery}
        isLoading={isStreaming}
      />
    </div>
  );
}
