"use client";

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
    <div className={styles.card} onClick={onClick}>
      {article.companies.length > 0 && (
        <div className={styles.companies}>
          {article.companies.map((c) => (
            <span key={c} className={styles.pill}>{c}</span>
          ))}
        </div>
      )}
      <h3 className={styles.title}>{article.title}</h3>
      {article.snippet && (
        <p className={styles.snippet}>{article.snippet}</p>
      )}
      <span className={styles.date}>{formatDate(article.published)}</span>
    </div>
  );
}
