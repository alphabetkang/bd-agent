"use client";

import { useEffect, useRef } from "react";
import { ExternalLink, FileText, Pin } from "lucide-react";
import { SourceDoc } from "@/types";
import styles from "./ArticleViewer.module.css";

interface ArticleViewerProps {
  sources: SourceDoc[];
  activeCitationId: string | null;
  selectedSourceId?: string | null;
  onSelectSource?: (source: SourceDoc | null) => void;
}

export function ArticleViewer({ sources, activeCitationId, selectedSourceId, onSelectSource }: ArticleViewerProps) {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (activeCitationId && cardRefs.current[activeCitationId]) {
      cardRefs.current[activeCitationId]!.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeCitationId]);

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
                ref={(el) => {
                  cardRefs.current[source.id] = el;
                }}
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
                <div className={styles.sourceMeta}>{source.source}</div>
                <p
                  className={`${styles.sourceText} ${
                    isActive ? styles.sourceTextActive : ""
                  }`}
                >
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
