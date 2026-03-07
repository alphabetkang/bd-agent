"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { Send, Square, X, Building2, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Company, SourceDoc } from "@/types";
import { useCompanyChat } from "@/hooks/useCompanyChat";
import { Spinner } from "@/components/ui/Spinner";
import styles from "./CompanyChat.module.css";

interface CompanyChatProps {
  company: Company;
  selectedArticle?: SourceDoc | null;
  onCitationClick: (id: string) => void;
  onSourcesUpdate: (sources: SourceDoc[]) => void;
  onClearArticle?: () => void;
  onClose: () => void;
}

export function CompanyChat({
  company,
  selectedArticle,
  onCitationClick,
  onSourcesUpdate,
  onClearArticle,
  onClose,
}: CompanyChatProps) {
  const { messages, sources, status, statusText, sendMessage, clearHistory, abort } =
    useCompanyChat();

  const prevCompanyRef = useRef(company.name);
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Notify parent when sources change (so ArticleViewer updates)
  useEffect(() => {
    onSourcesUpdate(sources);
  }, [sources, onSourcesUpdate]);

  // Reset when company changes
  useEffect(() => {
    if (company.name !== prevCompanyRef.current) {
      clearHistory();
      prevCompanyRef.current = company.name;
    }
  }, [company.name, clearHistory]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isStreaming = status === "loading";

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    sendMessage(trimmed, company.name, selectedArticle?.url ?? undefined);
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInputResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Building2 size={14} color="var(--text-muted)" />
          <span className={styles.headerTitle}>Intelligence Chat</span>
        </div>
        <div className={styles.headerRight}>
          {isStreaming && <Spinner size={12} />}
          <button className={styles.closeBtn} onClick={onClose} title="Exit company mode">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Company context banner */}
      <div className={styles.contextBanner}>
        <span className={styles.bannerLabel}>Context</span>
        <span className={styles.bannerCompany}>{company.name}</span>
        <span className={styles.bannerContext}>{company.context}</span>
      </div>

      {/* Article focus banner */}
      {selectedArticle && (
        <div className={styles.articleBanner}>
          <FileText size={11} />
          <span className={styles.articleBannerTitle}>
            {selectedArticle.title || selectedArticle.source}
          </span>
          <button className={styles.articleBannerClear} onClick={onClearArticle} title="Remove article focus">
            <X size={10} />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className={styles.messageArea}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <Building2 size={28} color="var(--border)" />
            <p className={styles.emptyTitle}>Ask about {company.name}</p>
            <p className={styles.emptyHint}>
              Answers cite numbered sources. Click any{" "}
              <span className={styles.exampleCitation}>[1]</span> to jump to
              the passage in the source viewer.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.message} ${styles[msg.role]}`}
            >
              {msg.role === "user" ? (
                <div className={styles.userMessage}>
                  <span className={styles.prompt}>›</span>
                  <span>{msg.content}</span>
                </div>
              ) : msg.isStreaming && !msg.content ? (
                <div className={styles.thinking}>
                  <Spinner size={12} />
                  <span>{statusText || "Generating..."}</span>
                </div>
              ) : (
                <CitedContent content={msg.content} onCitationClick={onCitationClick} />
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className={styles.inputArea}>
        {isStreaming && statusText && (
          <div className={styles.statusBar}>
            <Spinner size={11} />
            <span>{statusText}</span>
          </div>
        )}
        <div className={styles.inputWrapper}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              handleInputResize();
            }}
            onKeyDown={handleKey}
            placeholder={`Ask about ${company.name}...`}
            rows={1}
            disabled={isStreaming}
          />
          <div className={styles.actions}>
            <span className={styles.hint}>
              {isStreaming ? "" : "Enter · Shift+Enter for newline"}
            </span>
            {isStreaming ? (
              <button className={styles.stopBtn} onClick={abort} title="Stop">
                <Square size={13} />
                <span>Stop</span>
              </button>
            ) : (
              <button
                className={styles.sendBtn}
                onClick={handleSend}
                disabled={!value.trim()}
                title="Send"
              >
                <Send size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Renders markdown with [N] converted to clickable citation badges
function CitedContent({
  content,
  onCitationClick,
}: {
  content: string;
  onCitationClick: (id: string) => void;
}) {
  // Replace [N] with a markdown link pointing to #cite-N
  const processed = content.replace(/\[(\d+)\]/g, (_match, n) => `[[${n}]](#cite-${n})`);

  return (
    <div className={styles.assistantContent}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            const match = href?.match(/^#cite-(\d+)$/);
            if (match) {
              return (
                <button
                  className={styles.citationBtn}
                  onClick={() => onCitationClick(match[1])}
                  title={`Jump to source [${match[1]}]`}
                >
                  {children}
                </button>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
