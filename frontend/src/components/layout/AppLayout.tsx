"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { CompaniesPanel } from "@/components/companies/CompaniesPanel";
import { FeedsView } from "@/components/feeds/FeedsView";
import { useChat } from "@/hooks/useChat";
import styles from "./AppLayout.module.css";
import { Company } from "@/types";

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<"chat" | "feeds">("chat");
  const { messages, status, statusText, sendMessage, abort } = useChat();

  // Collect companies from the latest assistant message that has them
  const latestCompanies: Company[] = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant" && messages[i].companies?.length) {
        return messages[i].companies!;
      }
    }
    return [];
  })();

  // The current answer text for the report
  const latestAnswer = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant" && messages[i].content) {
        return messages[i].content;
      }
    }
    return "";
  })();

  const latestQuery = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i].content;
    }
    return "";
  })();

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
            messages={messages}
            status={status}
            statusText={statusText}
            onSend={sendMessage}
            onAbort={abort}
          />
        ) : (
          <FeedsView />
        )}
      </main>

      <CompaniesPanel
        companies={latestCompanies}
        query={latestQuery}
        answer={latestAnswer}
        isLoading={status !== "idle" && status !== "done" && status !== "error"}
      />
    </div>
  );
}
