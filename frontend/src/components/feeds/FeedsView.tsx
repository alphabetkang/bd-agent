"use client";

import { useState } from "react";
import { RefreshCw, ExternalLink, Rss } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import styles from "./FeedsView.module.css";

const FEEDS = [
  {
    name: "Boston Business Journal",
    url: "https://rss.bizjournals.com/feed/b9ed7bf2b98724dcdf252f7cc5e9682ff9928337/14417?market=boston",
    homepage: "https://www.bizjournals.com/boston",
    description: "Local Boston business news, funding rounds, and market moves.",
  },
  {
    name: "Yahoo Finance",
    url: "https://finance.yahoo.com/news/rssindex",
    homepage: "https://finance.yahoo.com",
    description: "Financial markets, earnings reports, and economic news.",
  },
  {
    name: "TechCrunch",
    url: "https://techcrunch.com/feed/",
    homepage: "https://techcrunch.com",
    description: "Startup funding, product launches, and tech industry analysis.",
  },
];

export function FeedsView() {
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [error, setError] = useState("");

  async function handleRefresh() {
    setRefreshing(true);
    setError("");
    try {
      const res = await fetch("/api/feeds/refresh", { method: "POST" });
      if (!res.ok) throw new Error("Refresh failed");
      setLastRefreshed(new Date());
    } catch {
      setError("Refresh failed. Check the backend logs.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className={styles.feedsView}>
      <header className={styles.header}>
        <span className={styles.headerTitle}>News Feeds</span>
        <div className={styles.headerRight}>
          {lastRefreshed && (
            <span className={styles.lastRefreshed}>
              Refreshed {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            className={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? <Spinner size={12} /> : <RefreshCw size={12} />}
            <span>{refreshing ? "Refreshing..." : "Refresh All"}</span>
          </button>
        </div>
      </header>

      <div className={styles.body}>
        {error && <div className={styles.error}>{error}</div>}

        <p className={styles.description}>
          These RSS feeds are ingested into the vector store and used to answer your questions.
          Feeds refresh automatically every 60 minutes.
        </p>

        <div className={styles.feedList}>
          {FEEDS.map((feed) => (
            <div key={feed.name} className={styles.feedCard}>
              <div className={styles.feedHeader}>
                <div className={styles.feedIconWrap}>
                  <Rss size={14} color="var(--accent)" />
                </div>
                <div className={styles.feedMeta}>
                  <span className={styles.feedName}>{feed.name}</span>
                  <a
                    href={feed.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.feedLink}
                  >
                    {new URL(feed.homepage).hostname}
                    <ExternalLink size={10} />
                  </a>
                </div>
                <span className={styles.activeBadge}>Active</span>
              </div>
              <p className={styles.feedDesc}>{feed.description}</p>
              <div className={styles.feedUrl}>
                <span className={styles.feedUrlLabel}>RSS</span>
                <code className={styles.feedUrlText}>{feed.url}</code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
