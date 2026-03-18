"use client";

import { useEffect, useState, useMemo } from "react";
import { Bot, Newspaper, AlertCircle, Building2 } from "lucide-react";
import { Article, ResearchAgent, ShortlistedCompany } from "@/types";
import { fetchArticles } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";
import styles from "./OverviewView.module.css";

const STORAGE_KEY = "bd-research-agents";
const COMPANIES_CACHE_KEY = "bd-shortlisted-companies";

function loadCompaniesCache(): ShortlistedCompany[] {
  try {
    const raw = localStorage.getItem(COMPANIES_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCompaniesCache(companies: ShortlistedCompany[]) {
  localStorage.setItem(COMPANIES_CACHE_KEY, JSON.stringify(companies));
}
const STOP_WORDS = new Set([
  "a","an","the","in","on","at","for","to","of","and","or","is","are","was",
  "were","be","been","being","have","has","had","do","does","did","will","would",
  "could","should","may","might","that","this","with","from","by","as","it","its",
  "about","after","before","during","last","next","than","then","there","they",
  "their","what","when","where","which","who","how","more","most","any","all",
  "each","some","such","like","into","over","under","between","through","both",
]);

function loadAgents(): ResearchAgent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function scoreArticle(article: Article, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const haystack = [article.title, article.snippet, ...article.companies]
    .join(" ")
    .toLowerCase();
  return keywords.filter((kw) => haystack.includes(kw)).length;
}

async function fetchTopCompanies(interests: string[]): Promise<ShortlistedCompany[]> {
  const res = await fetch("/api/overview/top-companies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interests }),
  });
  if (!res.ok) throw new Error("Failed to fetch top companies");
  return res.json();
}

export function OverviewView() {
  const [agents, setAgents] = useState<ResearchAgent[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [companies, setCompanies] = useState<ShortlistedCompany[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState(false);

  useEffect(() => {
    setAgents(loadAgents());
    setCompanies(loadCompaniesCache());
  }, []);

  useEffect(() => {
    fetchArticles()
      .then(setArticles)
      .catch(() => {})
      .finally(() => setArticlesLoading(false));
  }, []);

  const readyAgents = agents.filter((a) => a.status === "ready");

  // Re-fetch whenever the number of ready agents changes; keep cached result visible while loading
  useEffect(() => {
    if (readyAgents.length === 0) return;
    const interests = readyAgents.map((a) => a.prompt);
    setCompaniesLoading(true);
    setCompaniesError(false);
    fetchTopCompanies(interests)
      .then((result) => {
        setCompanies(result);
        saveCompaniesCache(result);
      })
      .catch(() => setCompaniesError(true))
      .finally(() => setCompaniesLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyAgents.length]);

  const agentKeywords = useMemo(() => {
    return readyAgents.flatMap((a) => extractKeywords(a.prompt));
  }, [readyAgents]);

  const recommendedArticles = useMemo(() => {
    if (articles.length === 0) return [];
    if (agentKeywords.length === 0) return articles.slice(0, 6);
    return articles
      .map((a) => ({ article: a, score: scoreArticle(a, agentKeywords) }))
      .sort((x, y) => y.score - x.score || (y.article.published > x.article.published ? 1 : -1))
      .slice(0, 6)
      .map((x) => x.article);
  }, [articles, agentKeywords]);

  const loadingAgents = agents.filter((a) => a.status === "loading");

  return (
    <div className={styles.view}>
      <header className={styles.pageHeader}>
        <span className={styles.pageTitle}>Overview</span>
      </header>

      <div className={styles.body}>
        {/* ── Welcome ── */}
        <section className={styles.welcomeSection}>
          <h1 className={styles.welcomeHeading}>Welcome back, Asher.</h1>
          {readyAgents.length > 0 ? (
            <div className={styles.prioritiesBlock}>
              <p className={styles.prioritiesLabel}>Your current research priorities</p>
              <ul className={styles.prioritiesList}>
                {readyAgents.map((agent) => (
                  <li key={agent.id} className={styles.priorityItem}>
                    {agent.prompt}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className={styles.welcomeSub}>
              No research priorities set yet. Create agents in the Agents tab to get started.
            </p>
          )}
        </section>
        {/* ── Research Agents ── */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <Bot size={13} color="var(--accent)" />
            <span className={styles.sectionTitle}>Executive Summaries</span>
            {loadingAgents.length > 0 && (
              <span className={styles.sectionMeta}>
                <Spinner size={10} />
                {loadingAgents.length} loading…
              </span>
            )}
          </div>

          {agents.length === 0 ? (
            <div className={styles.emptyState}>
              <Bot size={24} color="var(--text-muted)" />
              <p>No agents yet. Create one in the Agents tab to generate executive summaries.</p>
            </div>
          ) : (
            <div className={styles.agentGrid}>
              {readyAgents.map((agent) => (
                <AgentSummaryCard key={agent.id} agent={agent} />
              ))}
              {loadingAgents.map((agent) => (
                <div key={agent.id} className={styles.agentCard}>
                  <div className={styles.agentCardHeader}>
                    <Spinner size={11} />
                    <span className={styles.agentName}>{agent.prompt}</span>
                  </div>
                  <p className={styles.agentSummaryLoading}>Generating summary…</p>
                </div>
              ))}
              {agents.filter((a) => a.status === "error").map((agent) => (
                <div key={agent.id} className={`${styles.agentCard} ${styles.agentCardError}`}>
                  <div className={styles.agentCardHeader}>
                    <AlertCircle size={11} color="#ef4444" />
                    <span className={styles.agentName}>{agent.prompt}</span>
                  </div>
                  <p className={styles.agentSummaryError}>Search failed. Check that the backend is running.</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Shortlisted Companies ── */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <Building2 size={13} color="var(--accent)" />
            <span className={styles.sectionTitle}>Shortlisted Companies</span>
            {companiesLoading && (
              <span className={styles.sectionMeta}>
                <Spinner size={10} />
                {companies.length > 0 ? "Refreshing…" : "Loading…"}
              </span>
            )}
            {!companiesLoading && companies.length > 0 && (
              <span className={styles.sectionMeta}>{companies.length} companies</span>
            )}
          </div>

          {readyAgents.length === 0 ? (
            <div className={styles.emptyState}>
              <Building2 size={24} color="var(--text-muted)" />
              <p>Create and run research agents to surface relevant companies.</p>
            </div>
          ) : companiesLoading && companies.length === 0 ? (
            <div className={styles.companiesLoadingRow}>
              <Spinner size={14} />
              <span>Analysing relevant companies…</span>
            </div>
          ) : companiesError && companies.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Could not load company recommendations. Check the backend is running.</p>
            </div>
          ) : (
            <div className={styles.companiesList}>
              {companies.map((company, i) => (
                <CompanyCard key={company.name} rank={i + 1} company={company} />
              ))}
            </div>
          )}
        </section>

        {/* ── Recommended Articles ── */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <Newspaper size={13} color="var(--accent)" />
            <span className={styles.sectionTitle}>
              {agentKeywords.length > 0 ? "Recommended Articles" : "Recent Articles"}
            </span>
            {articlesLoading && <Spinner size={10} />}
            {!articlesLoading && (
              <span className={styles.sectionMeta}>{recommendedArticles.length} articles</span>
            )}
          </div>

          {!articlesLoading && articles.length === 0 ? (
            <div className={styles.emptyState}>
              <Newspaper size={24} color="var(--text-muted)" />
              <p>No articles available. Refresh the feeds in the Sources tab.</p>
            </div>
          ) : (
            <div className={styles.articleGrid}>
              {recommendedArticles.map((article) => (
                <ArticleSnippetCard key={article.url} article={article} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function CompanyCard({ rank, company }: { rank: number; company: ShortlistedCompany }) {
  return (
    <div className={styles.companyCard}>
      <span className={styles.companyRank}>{rank}</span>
      <div className={styles.companyBody}>
        <span className={styles.companyName}>{company.name}</span>
        <p className={styles.companyRationale}>{company.rationale}</p>
      </div>
    </div>
  );
}

function AgentSummaryCard({ agent }: { agent: ResearchAgent }) {
  return (
    <div className={styles.agentCard}>
      <div className={styles.agentCardHeader}>
        <Bot size={11} color="var(--accent)" />
        <span className={styles.agentName}>{agent.prompt}</span>
        <span className={styles.agentArticleCount}>
          {agent.articles.length} article{agent.articles.length !== 1 ? "s" : ""}
        </span>
      </div>
      {agent.summary ? (
        <p className={styles.agentSummary}>{agent.summary}</p>
      ) : (
        <p className={styles.agentSummaryLoading}>No summary available.</p>
      )}
    </div>
  );
}

function ArticleSnippetCard({ article }: { article: Article }) {
  const date = article.published
    ? new Date(article.published).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })
    : "";

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.articleCard}
    >
      <div className={styles.articleCardTop}>
        <span className={styles.articleSource}>{article.source}</span>
        {date && <span className={styles.articleDate}>{date}</span>}
      </div>
      <p className={styles.articleTitle}>{article.title}</p>
      {article.snippet && (
        <p className={styles.articleSnippet}>{article.snippet}</p>
      )}
      {article.companies.length > 0 && (
        <div className={styles.pills}>
          {article.companies.map((c) => (
            <span key={c} className={styles.pill}>{c}</span>
          ))}
        </div>
      )}
    </a>
  );
}
