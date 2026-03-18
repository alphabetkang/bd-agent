"use client";

import { useState } from "react";
import { LayoutDashboard, Newspaper, Bot, Rss } from "lucide-react";
import { Article } from "@/types";
import { ArticleDashboard } from "@/components/articles/ArticleDashboard";
import { ArticleDetail } from "@/components/articles/ArticleDetail";
import { FeedsView } from "@/components/feeds/FeedsView";
import { AgentsView } from "@/components/agents/AgentsView";
import { OverviewView } from "@/components/overview/OverviewView";
import styles from "./AppLayout.module.css";

type Tab = "overview" | "articles" | "agents" | "sources";

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "agents",   label: "Agents",   Icon: Bot },
  { id: "articles", label: "Search", Icon: Newspaper },
  { id: "sources",  label: "Sources",  Icon: Rss },
];

export function AppLayout() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  return (
    <div className={styles.appLayout}>
      <nav className={styles.nav}>
        <div className={styles.navLogo}>BD-Agents</div>
        <ul className={styles.navTabs}>
          {TABS.map(({ id, label, Icon }) => (
            <li key={id}>
              <button
                className={`${styles.navTab} ${activeTab === id ? styles.navTabActive : ""}`}
                onClick={() => {
                  setActiveTab(id);
                  if (id !== "articles") setSelectedArticle(null);
                }}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main className={styles.main}>
        {activeTab === "overview" && <OverviewView />}

        {activeTab === "articles" && (
          selectedArticle ? (
            <ArticleDetail
              article={selectedArticle}
              onClose={() => setSelectedArticle(null)}
            />
          ) : (
            <ArticleDashboard onSelectArticle={setSelectedArticle} />
          )
        )}

        {activeTab === "agents" && <AgentsView />}

        {activeTab === "sources" && <FeedsView />}
      </main>
    </div>
  );
}
