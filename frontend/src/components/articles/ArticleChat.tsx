"use client";

import { KeyboardEvent, useCallback, useRef, useState } from "react";
import { Send, Square, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Article, SourceDoc } from "@/types";
import { useCompanyChat } from "@/hooks/useCompanyChat";
import { Spinner } from "@/components/ui/Spinner";
import styles from "./ArticleChat.module.css";

interface ArticleChatProps {
  article: Article;
  onCitationClick: (text: string) => void;
  onClose: () => void;
}

export function ArticleChat({ article, onCitationClick, onClose }: ArticleChatProps) {
  const { messages, sources, status, statusText, sendMessage, abort } = useCompanyChat();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isStreaming = status === "loading";

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    sendMessage(trimmed, article.companies[0] ?? article.title, article.url);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerTitle}>Intelligence Chat</span>
          {isStreaming && <Spinner size={12} />}
        </div>
        <button className={styles.closeBtn} onClick={onClose} title="Back to dashboard">
          <X size={14} />
        </button>
      </div>

      <div className={styles.contextBanner}>
        <span className={styles.bannerLabel}>Article</span>
        <span className={styles.bannerTitle}>{article.title}</span>
      </div>

      <div className={styles.messageArea}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Ask about this article</p>
            <p className={styles.emptyHint}>
              Questions are answered using only the content of this article.
              Citations like <span className={styles.exampleCitation}>[1]</span> reference specific passages.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`${styles.message} ${styles[msg.role]}`}>
              {msg.role === "user" ? (
                <div className={styles.userMessage}>
                  <span className={styles.prompt}>›</span>
                  <span>{msg.content}</span>
                </div>
              ) : msg.isStreaming && !msg.content ? (
                <div className={styles.thinking}>
                  <Spinner size={12} />
                  <span>{statusText || "Generating…"}</span>
                </div>
              ) : (
                <CitedContent
                  content={msg.content}
                  sources={sources}
                  onCitationClick={onCitationClick}
                />
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

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
            onChange={(e) => { setValue(e.target.value); handleResize(); }}
            onKeyDown={handleKey}
            placeholder="Ask about this article…"
            rows={1}
            disabled={isStreaming}
          />
          <div className={styles.actions}>
            <span className={styles.hint}>
              {isStreaming ? "" : "Enter · Shift+Enter for newline"}
            </span>
            {isStreaming ? (
              <button className={styles.stopBtn} onClick={abort}>
                <Square size={13} />
                <span>Stop</span>
              </button>
            ) : (
              <button
                className={styles.sendBtn}
                onClick={handleSend}
                disabled={!value.trim()}
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

function CitedContent({
  content,
  sources,
  onCitationClick,
}: {
  content: string;
  sources: SourceDoc[];
  onCitationClick: (text: string) => void;
}) {
  const processed = content.replace(/\[(\d+)\]/g, (_, n) => `[[${n}]](#cite-${n})`);

  return (
    <div className={styles.assistantContent}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            const match = href?.match(/^#cite-(\d+)$/);
            if (match) {
              const source = sources.find((s) => s.id === match[1]);
              return (
                <button
                  className={styles.citationBtn}
                  onClick={() => source && onCitationClick(source.text)}
                  title={`Highlight passage [${match[1]}]`}
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
