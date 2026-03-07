"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sidebar } from "./Sidebar";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { CompaniesPanel } from "@/components/companies/CompaniesPanel";
import { CompanyChat } from "@/components/companies/CompanyChat";
import { ArticleViewer } from "@/components/companies/ArticleViewer";
import { FeedsView } from "@/components/feeds/FeedsView";
import { AddSourceModal } from "@/components/sources/AddSourceModal";
import { useSessions } from "@/hooks/useSessions";
import { fetchSources } from "@/lib/api";
import { Company, SourceDoc, UserSource } from "@/types";
import styles from "./AppLayout.module.css";

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<"chat" | "feeds">("chat");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [userSources, setUserSources] = useState<UserSource[]>([]);

  // Company research state
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyChatSources, setCompanyChatSources] = useState<SourceDoc[]>([]);
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);
  const [selectedArticleSource, setSelectedArticleSource] = useState<SourceDoc | null>(null);

  const {
    sessions,
    activeId,
    activeSession,
    status,
    statusText,
    statusHistory,
    setActiveId,
    newSession,
    closeSession,
    sendMessage,
    abort,
    addNotification,
  } = useSessions();

  // Load persisted user sources on mount
  useEffect(() => {
    fetchSources().then(setUserSources).catch(console.error);
  }, []);

  // Auto-select the latest completed message with companies when streaming finishes
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const wasStreaming =
      prevStatusRef.current !== "idle" &&
      prevStatusRef.current !== "done" &&
      prevStatusRef.current !== "error";
    prevStatusRef.current = status;
    if (wasStreaming && status === "done") {
      const msgs = activeSession?.messages ?? [];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant" && !msgs[i].isStreaming && msgs[i].companies?.length) {
          setSelectedMessageId(msgs[i].id);
          break;
        }
      }
    }
  }, [status, activeSession?.messages]);

  const handleSelectCompany = useCallback((company: Company | null) => {
    setSelectedCompany(company);
    setActiveCitationId(null);
    setCompanyChatSources([]);
    setSelectedArticleSource(null);
  }, []);

  function handleSelectSession(id: string) {
    setActiveId(id);
    setSelectedMessageId(null);
  }

  function handleNewSession() {
    newSession();
    setSelectedMessageId(null);
  }

  function handleSourceAdded(source: UserSource) {
    setUserSources((prev) => [...prev, source]);
    const typeLabel =
      source.type === "pdf"
        ? "PDF"
        : source.type === "docx"
        ? "DOCX"
        : source.type === "url"
        ? "feed/page"
        : "file";
    addNotification(
      `Source connected — **${source.name}** (${typeLabel}) · ${source.chunk_count} chunk${
        source.chunk_count !== 1 ? "s" : ""
      } ingested into the knowledge base.`
    );
  }

  function handleSourceDeleted(id: string) {
    setUserSources((prev) => prev.filter((s) => s.id !== id));
  }

  const selectedMessage =
    activeSession?.messages.find((m) => m.id === selectedMessageId) ?? null;

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

  // Sources for the article viewer: prefer sources from the most recent company chat query,
  // falling back to the original RAG sources that identified the company.
  const articleSources =
    companyChatSources.length > 0
      ? companyChatSources
      : (displayMessage?.sources ?? []);

  return (
    <div className={styles.appLayout}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
        activeView={activeView}
        onNavChange={setActiveView}
        onAddSource={() => setSourceModalOpen(true)}
        userSources={userSources}
      />

      {/* Companies panel — center-left, expands when no company selected */}
      <div className={selectedCompany ? styles.companiesCompact : styles.companiesMain}>
        <CompaniesPanel
          selectedMessage={displayMessage}
          latestQuery={latestQuery}
          isLoading={isStreaming}
          selectedCompany={selectedCompany}
          onSelectCompany={handleSelectCompany}
        />
      </div>

      {/* Article viewer — appears between companies and chat when company is selected */}
      {selectedCompany && (
        <div className={styles.articleArea}>
          <ArticleViewer
            sources={articleSources}
            activeCitationId={activeCitationId}
            selectedSourceId={selectedArticleSource?.id ?? null}
            onSelectSource={setSelectedArticleSource}
          />
        </div>
      )}

      {/* Right panel: company-focused chat or general intelligence chat */}
      <div className={styles.rightPanel}>
        {selectedCompany ? (
          <CompanyChat
            company={selectedCompany}
            selectedArticle={selectedArticleSource}
            onCitationClick={setActiveCitationId}
            onSourcesUpdate={setCompanyChatSources}
            onClearArticle={() => setSelectedArticleSource(null)}
            onClose={() => handleSelectCompany(null)}
          />
        ) : activeView === "chat" ? (
          <ChatInterface
            sessions={sessions}
            activeId={activeId}
            status={status}
            statusHistory={statusHistory}
            selectedMessageId={selectedMessageId}
            onSend={sendMessage}
            onAbort={abort}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewSession}
            onCloseSession={closeSession}
            onSelectMessage={setSelectedMessageId}
          />
        ) : (
          <FeedsView userSources={userSources} />
        )}
      </div>

      {sourceModalOpen && (
        <AddSourceModal
          onClose={() => setSourceModalOpen(false)}
          sources={userSources}
          onSourceAdded={handleSourceAdded}
          onSourceDeleted={handleSourceDeleted}
        />
      )}
    </div>
  );
}
