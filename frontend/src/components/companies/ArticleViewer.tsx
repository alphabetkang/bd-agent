"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, FileText, Loader2, Pin } from "lucide-react";
import { SourceDoc } from "@/types";
import styles from "./ArticleViewer.module.css";

interface ArticleViewerProps {
  sources: SourceDoc[];
  activeCitationId: string | null;
  selectedSourceId?: string | null;
  onSelectSource?: (source: SourceDoc | null) => void;
}

interface ArticleContent {
  title: string;
  hero_image: string;
  html: string;
}

export function ArticleViewer({ sources, activeCitationId, selectedSourceId, onSelectSource }: ArticleViewerProps) {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [readingSource, setReadingSource] = useState<SourceDoc | null>(null);
  const [articleContent, setArticleContent] = useState<ArticleContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (activeCitationId && cardRefs.current[activeCitationId]) {
      cardRefs.current[activeCitationId]!.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeCitationId]);

  // Reset reader when sources list changes (new company selected)
  useEffect(() => {
    setReadingSource(null);
    setArticleContent(null);
    setError("");
  }, [sources]);

  async function openArticle(source: SourceDoc) {
    if (!source.url) return;
    setReadingSource(source);
    setArticleContent(null);
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/company/article-content?url=${encodeURIComponent(source.url)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ArticleContent = await res.json();
      setArticleContent(data);
    } catch {
      setError("Could not load the article. Try opening it directly.");
    } finally {
      setLoading(false);
    }
  }

  // ── Article reader view ────────────────────────────────────────────────────
  if (readingSource) {
    return (
      <div className={styles.viewer}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => setReadingSource(null)}>
            <ArrowLeft size={13} />
            <span>Sources</span>
          </button>
          {readingSource.url && (
            <a
              href={readingSource.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.openExternal}
              title="Open on TechCrunch"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>

        <div className={styles.readerBody}>
          {loading && (
            <div className={styles.readerLoading}>
              <Loader2 size={20} className={styles.spin} />
              <span>Loading article…</span>
            </div>
          )}

          {error && (
            <div className={styles.readerError}>
              <p>{error}</p>
              {readingSource.url && (
                <a href={readingSource.url} target="_blank" rel="noopener noreferrer">
                  Open on TechCrunch →
                </a>
              )}
            </div>
          )}

          {articleContent && (
            <article className={styles.articleContent}>
              {articleContent.hero_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={articleContent.hero_image}
                  alt=""
                  className={styles.heroImage}
                />
              )}
              <h1 className={styles.articleTitle}>{articleContent.title || readingSource.title}</h1>
              <div
                className={styles.articleBody}
                dangerouslySetInnerHTML={{ __html: articleContent.html }}
              />
            </article>
          )}
        </div>
      </div>
    );
  }

  // ── Source list view ───────────────────────────────────────────────────────
  return (
    <div className={styles.viewer}>
      <div className={styles.header}>
        <FileText size={14} color="var(--text-muted)" />
        <span className={styles.title}>Sources</span>
        {sources.length > 0 && (
          <span className={styles.countChip}>{sources.length}</span>
        )}
      </div>

      <div className={styles.body}>
        {sources.length === 0 ? (
          <div className={styles.empty}>
            <FileText size={24} color="var(--border)" />
            <p>No sources loaded.</p>
          </div>
        ) : (
          sources.map((source) => {
            const isActive = activeCitationId === source.id;
            const isSelected = selectedSourceId === source.id;
            return (
              <div
                key={source.id}
                ref={(el) => { cardRefs.current[source.id] = el; }}
                className={`${styles.sourceCard} ${isActive ? styles.active : ""} ${isSelected ? styles.selected : ""} ${onSelectSource ? styles.selectable : ""}`}
                onClick={() => onSelectSource?.(isSelected ? null : source)}
              >
                <div className={styles.sourceHeader}>
                  <span className={styles.citationNum}>[{source.id}]</span>
                  <span className={styles.sourceTitle}>
                    {source.title || source.source}
                  </span>
                  {isSelected && (
                    <span className={styles.pinnedBadge}>
                      <Pin size={9} />
                      In context
                    </span>
                  )}
                  <div className={styles.cardActions}>
                    {source.url && (
                      <button
                        className={styles.readBtn}
                        onClick={(e) => { e.stopPropagation(); openArticle(source); }}
                        title="Read full article"
                      >
                        Read
                      </button>
                    )}
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.extLink}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>
                <div className={styles.sourceMeta}>{source.source}</div>
                <p className={`${styles.sourceText} ${isActive ? styles.sourceTextActive : ""}`}>
                  {source.text}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
