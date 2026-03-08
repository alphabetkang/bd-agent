"use client";

import { Pin } from "lucide-react";
import { Article } from "@/types";
import styles from "./ArticleCard.module.css";

interface ArticleCardProps {
  article: Article;
  onClick: () => void;
}

function formatDate(raw: string): string {
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function ArticleCard({ article, onClick }: ArticleCardProps) {
  return (
    <div className={`${styles.card} ${article.pinned ? styles.pinned : ""}`} onClick={onClick}>
      <div className={styles.cardTop}>
        {article.companies.length > 0 && (
          <div className={styles.companies}>
            {article.companies.map((c) => (
              <span key={c} className={styles.pill}>{c}</span>
            ))}
          </div>
        )}
        {article.pinned && (
          <span className={styles.evalBadge}>
            <Pin size={9} />
            EVAL
          </span>
        )}
      </div>
      <h3 className={styles.title}>{article.title}</h3>
      {article.snippet && (
        <p className={styles.snippet}>{article.snippet}</p>
      )}
      <span className={styles.date}>{formatDate(article.published)}</span>
    </div>
  );
}
