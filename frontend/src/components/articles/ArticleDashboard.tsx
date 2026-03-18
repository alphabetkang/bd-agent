"use client";

import { useEffect, useState, useMemo } from "react";
import { RefreshCw, Search } from "lucide-react";
import { Article } from "@/types";
import { fetchArticles } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";
import { ArticleCard } from "./ArticleCard";
import styles from "./ArticleDashboard.module.css";

interface ArticleDashboardProps {
  onSelectArticle: (article: Article) => void;
}

export function ArticleDashboard({ onSelectArticle }: ArticleDashboardProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  async function loadArticles() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchArticles();
      setArticles(data);
    } catch {
      setError("Could not load articles. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch("/api/feeds/refresh", { method: "POST" });
      await loadArticles();
    } catch {
      setError("Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => { loadArticles(); }, []);

  const filteredArticles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.snippet.toLowerCase().includes(q) ||
        a.companies.some((c) => c.toLowerCase().includes(q))
    );
  }, [articles, query]);

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerTitle}>Search</span>
          {!loading && articles.length > 0 && (
            <span className={styles.count}>
              {query.trim()
                ? `${filteredArticles.length} / ${articles.length} articles`
                : `${articles.length} articles`}
            </span>
          )}
        </div>

        {!loading && !error && articles.length > 0 && (
          <div className={styles.searchBox}>
            <Search size={13} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search by title, company, or keyword…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}

        <button
          className={styles.refreshBtn}
          onClick={handleRefresh}
          disabled={refreshing || loading}
          title="Refresh feeds"
        >
          {refreshing ? <Spinner size={12} /> : <RefreshCw size={12} />}
          <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
        </button>
      </header>

      <div className={styles.body}>
        {loading && (
          <div className={styles.loading}>
            <Spinner size={24} />
            <span>Loading articles…</span>
          </div>
        )}

        {!loading && error && (
          <div className={styles.error}>{error}</div>
        )}

        {!loading && !error && articles.length === 0 && (
          <div className={styles.empty}>
            <p>No articles yet. Try refreshing the feed.</p>
          </div>
        )}

        {!loading && !error && articles.length > 0 && (() => {
          const pinned = filteredArticles.filter((a) => a.pinned);
          const feed = filteredArticles.filter((a) => !a.pinned);
          return (
            <>
              {filteredArticles.length === 0 && (
                <div className={styles.empty}>
                  <p>No articles match the selected tags.</p>
                </div>
              )}
              {pinned.length > 0 && (
                <div className={styles.pinnedSection}>
                  <span className={styles.sectionLabel}>Pinned for Evaluation</span>
                  <div className={styles.grid}>
                    {pinned.map((article) => (
                      <ArticleCard
                        key={article.url}
                        article={article}
                        onClick={() => onSelectArticle(article)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {feed.length > 0 && (
                <div className={styles.grid}>
                  {feed.map((article) => (
                    <ArticleCard
                      key={article.url}
                      article={article}
                      onClick={() => onSelectArticle(article)}
                    />
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
