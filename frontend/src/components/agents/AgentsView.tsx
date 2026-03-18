"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Bot, X } from "lucide-react";
import { Article, ResearchAgent } from "@/types";
import { Spinner } from "@/components/ui/Spinner";
import styles from "./AgentsView.module.css";

const STORAGE_KEY = "bd-research-agents";

// Palette of muted accent colors for avatar backgrounds
const AVATAR_COLORS = [
  { bg: "rgba(255,186,40,0.15)",  border: "rgba(255,186,40,0.4)",  text: "#ffba28" },
  { bg: "rgba(99,179,237,0.15)",  border: "rgba(99,179,237,0.4)",  text: "#63b3ed" },
  { bg: "rgba(154,117,234,0.15)", border: "rgba(154,117,234,0.4)", text: "#9a75ea" },
  { bg: "rgba(72,199,142,0.15)",  border: "rgba(72,199,142,0.4)",  text: "#48c78e" },
  { bg: "rgba(255,115,115,0.15)", border: "rgba(255,115,115,0.4)", text: "#ff7373" },
  { bg: "rgba(251,189,35,0.15)",  border: "rgba(251,189,35,0.4)",  text: "#fbbd23" },
];

function colorForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** First 2–3 meaningful words of the prompt, title-cased */
function agentDisplayName(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, 3);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function loadAgents(): ResearchAgent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAgents(agents: ResearchAgent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}

async function searchArticles(prompt: string): Promise<{ articles: Article[]; summary: string; name: string }> {
  const res = await fetch("/api/research-agents/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export function AgentsView() {
  const [agents, setAgents] = useState<ResearchAgent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [promptInput, setPromptInput] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setAgents(loadAgents()); }, []);
  useEffect(() => { if (showForm) textareaRef.current?.focus(); }, [showForm]);

  async function handleCreate() {
    const prompt = promptInput.trim();
    if (!prompt) return;

    const id = `agent-${Date.now()}`;
    const newAgent: ResearchAgent = {
      id, prompt, name: "", createdAt: Date.now(), articles: [], summary: "", status: "loading",
    };

    setAgents((prev) => { const next = [...prev, newAgent]; saveAgents(next); return next; });
    setPromptInput("");
    setShowForm(false);

    try {
      const { articles, summary, name } = await searchArticles(prompt);
      setAgents((prev) => {
        const next = prev.map((a) =>
          a.id === id ? { ...a, articles, summary, name, status: "ready" as const } : a
        );
        saveAgents(next);
        return next;
      });
    } catch {
      setAgents((prev) => {
        const next = prev.map((a) =>
          a.id === id ? { ...a, status: "error" as const } : a
        );
        saveAgents(next);
        return next;
      });
    }
  }

  function handleDelete(id: string) {
    setAgents((prev) => { const next = prev.filter((a) => a.id !== id); saveAgents(next); return next; });
    if (expandedId === id) setExpandedId(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCreate();
    if (e.key === "Escape") { setShowForm(false); setPromptInput(""); }
  }

  return (
    <div className={styles.view}>
      <header className={styles.header}>
        <span className={styles.headerTitle}>Research Agents</span>
        <button className={styles.addBtn} onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} />
          <span>Add Agent</span>
        </button>
      </header>

      <div className={styles.contentRow}>
      <div className={styles.body}>
        {showForm && (
          <div className={styles.formCard}>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              placeholder="Research prompt — e.g. AI startup funding rounds in the last 30 days"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
            />
            <div className={styles.formActions}>
              <span className={styles.formHint}>⌘ Enter to create</span>
              <button className={styles.cancelBtn} onClick={() => { setShowForm(false); setPromptInput(""); }}>
                Cancel
              </button>
              <button className={styles.createBtn} onClick={handleCreate} disabled={!promptInput.trim()}>
                Create
              </button>
            </div>
          </div>
        )}

        {agents.length === 0 && !showForm && (
          <div className={styles.empty}>
            <Bot size={28} color="var(--text-muted)" />
            <p>No agents yet. Create one to start monitoring a research topic.</p>
          </div>
        )}

        <div className={styles.grid}>
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              expanded={expandedId === agent.id}
              onExpand={() => setExpandedId((prev) => prev === agent.id ? null : agent.id)}
              onDelete={() => handleDelete(agent.id)}
            />
          ))}
        </div>
      </div>

      {/* Article panel */}
      {expandedId && (() => {
        const agent = agents.find((a) => a.id === expandedId);
        if (!agent || agent.status !== "ready") return null;
        return (
          <ArticlePanel agent={agent} onClose={() => setExpandedId(null)} />
        );
      })()}
      </div>
    </div>
  );
}

function AgentCard({
  agent, expanded, onExpand, onDelete,
}: {
  agent: ResearchAgent;
  expanded: boolean;
  onExpand: () => void;
  onDelete: () => void;
}) {
  const color = colorForId(agent.id);
  const name = agent.name || agentDisplayName(agent.prompt);
  const canExpand = agent.status === "ready" && agent.articles.length > 0;
  const createdDate = new Date(agent.createdAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });

  return (
    <div
      className={`${styles.agentCard} ${expanded ? styles.agentCardActive : ""}`}
      onClick={canExpand ? onExpand : undefined}
      style={{ cursor: canExpand ? "pointer" : "default" }}
    >
      {/* Top row: avatar + delete */}
      <div className={styles.cardTopRow}>
        <div
          className={styles.avatar}
          style={{ background: color.bg, border: `1px solid ${color.border}` }}
        >
          <Bot size={20} color={color.text} />
        </div>
        <button
          className={styles.deleteBtn}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete agent"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Name + status */}
      <div className={styles.cardMid}>
        <span className={styles.agentName}>{name}</span>
        <StatusBadge agent={agent} />
      </div>

      {/* Prompt */}
      <p className={styles.agentPrompt}>{agent.prompt}</p>

      {agent.status === "error" && (
        <p className={styles.errorText}>Search failed. Check the backend is running.</p>
      )}

      {/* Footer stats */}
      <div className={styles.cardFooter}>
        <span className={styles.footerMeta}>{createdDate}</span>
        {agent.status === "ready" && (
          <span className={styles.footerMeta}>
            {agent.articles.length} article{agent.articles.length !== 1 ? "s" : ""}
            {canExpand && <> · <span style={{ color: "var(--accent)" }}>View</span></>}
          </span>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ agent }: { agent: ResearchAgent }) {
  if (agent.status === "loading") {
    return (
      <span className={`${styles.badge} ${styles.badgeLoading}`}>
        <Spinner size={9} />
        Searching
      </span>
    );
  }
  if (agent.status === "error") {
    return <span className={`${styles.badge} ${styles.badgeError}`}>Error</span>;
  }
  return null;
}

function ArticlePanel({ agent, onClose }: { agent: ResearchAgent; onClose: () => void }) {
  return (
    <div className={styles.drawer}>
      <div className={styles.drawerHeader}>
        <div>
          <p className={styles.drawerTitle}>{agent.prompt}</p>
          <span className={styles.drawerCount}>
            {agent.articles.length} article{agent.articles.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button className={styles.drawerClose} onClick={onClose}><X size={14} /></button>
      </div>

      {agent.summary && (
        <div className={styles.drawerSummary}>
          <span className={styles.summaryLabel}>Summary</span>
          <p className={styles.summaryText}>{agent.summary}</p>
        </div>
      )}

      <ul className={styles.articleList}>
        {agent.articles.map((article, i) => (
          <li key={article.url} className={styles.articleRow}>
            <span className={styles.articleRank}>{i + 1}</span>
            <div className={styles.articleContent}>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.articleTitle}
              >
                {article.title}
              </a>
              <div className={styles.articleFooter}>
                <span className={styles.articleDate}>
                  {article.source}
                  {article.published
                    ? ` · ${new Date(article.published).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}`
                    : ""}
                </span>
                {article.companies.length > 0 && (
                  <div className={styles.pills}>
                    {article.companies.map((c) => (
                      <span key={c} className={styles.pill}>{c}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
