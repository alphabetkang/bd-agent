"use client";

import { useState } from "react";
import { Article } from "@/types";
import { ArticleDashboard } from "@/components/articles/ArticleDashboard";
import { ArticleDetail } from "@/components/articles/ArticleDetail";
import styles from "./AppLayout.module.css";

export function AppLayout() {
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  return (
    <div className={styles.appLayout}>
      {selectedArticle ? (
        <ArticleDetail
          article={selectedArticle}
          onClose={() => setSelectedArticle(null)}
        />
      ) : (
        <ArticleDashboard onSelectArticle={setSelectedArticle} />
      )}
    </div>
  );
}
