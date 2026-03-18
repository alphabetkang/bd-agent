"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, ExternalLink, Rss, FileText, Globe, Plus, Trash2, Upload } from "lucide-react";
import { UserSource } from "@/types";
import { Spinner } from "@/components/ui/Spinner";
import { fetchSources, addUrlSource, uploadSource, deleteSource } from "@/lib/api";
import styles from "./FeedsView.module.css";

const FEEDS = [
  {
    name: "TechCrunch",
    url: "https://techcrunch.com/feed/",
    homepage: "https://techcrunch.com",
    description: "Startup funding, product launches, and tech industry analysis.",
    active: true,
  },
  {
    name: "Crunchbase News",
    url: "https://news.crunchbase.com/feed/",
    homepage: "https://news.crunchbase.com",
    description: "Startup funding rounds, acquisitions, and venture capital news.",
    active: true,
  },
  {
    name: "Boston Business Journal",
    url: "https://rss.bizjournals.com/feed/b9ed7bf2b98724dcdf252f7cc5e9682ff9928337/14417?market=boston",
    homepage: "https://www.bizjournals.com/boston",
    description: "Local Boston business news, funding rounds, and market moves.",
    active: false,
  },
  {
    name: "Yahoo Finance",
    url: "https://finance.yahoo.com/news/rssindex",
    homepage: "https://finance.yahoo.com",
    description: "Financial markets, earnings reports, and economic news.",
    active: false,
  },
];

type AddTab = "url" | "file";

export function FeedsView() {
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [error, setError] = useState("");

  // User sources
  const [sources, setSources] = useState<UserSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [addTab, setAddTab] = useState<AddTab>("url");
  const [urlInput, setUrlInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSources()
      .then(setSources)
      .catch(() => {})
      .finally(() => setSourcesLoading(false));
  }, []);

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

  function resetForm() {
    setUrlInput("");
    setNameInput("");
    setSelectedFile(null);
    setAddError("");
    setAddTab("url");
    setShowForm(false);
  }

  async function handleAdd() {
    setAddError("");
    setAdding(true);
    try {
      let source: UserSource;
      if (addTab === "url") {
        const trimmed = urlInput.trim();
        if (!trimmed) { setAddError("URL is required."); setAdding(false); return; }
        source = await addUrlSource(trimmed, nameInput.trim() || undefined);
      } else {
        if (!selectedFile) { setAddError("Select a file to upload."); setAdding(false); return; }
        source = await uploadSource(selectedFile);
      }
      setSources((prev) => [...prev, source]);
      resetForm();
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Failed to add source.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteSource(id);
      setSources((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError("Failed to delete source.");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd();
    if (e.key === "Escape") resetForm();
  }

  return (
    <div className={styles.feedsView}>
      <header className={styles.header}>
        <span className={styles.headerTitle}>Sources</span>
        <div className={styles.headerRight}>
          {lastRefreshed && (
            <span className={styles.lastRefreshed}>
              Refreshed {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            className={styles.addBtn}
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus size={14} />
            <span>Add Source</span>
          </button>
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
        <div className={styles.inner}>
          {error && <div className={styles.error}>{error}</div>}

          {/* ── Add source form ── */}
          {showForm && (
            <div className={styles.formCard}>
              <div className={styles.formTabs}>
                <button
                  className={`${styles.formTab} ${addTab === "url" ? styles.formTabActive : ""}`}
                  onClick={() => { setAddTab("url"); setAddError(""); }}
                >
                  <Globe size={12} />
                  URL
                </button>
                <button
                  className={`${styles.formTab} ${addTab === "file" ? styles.formTabActive : ""}`}
                  onClick={() => { setAddTab("file"); setAddError(""); }}
                >
                  <FileText size={12} />
                  File (PDF / DOCX)
                </button>
              </div>

              {addTab === "url" && (
                <div className={styles.formFields}>
                  <input
                    className={styles.input}
                    type="url"
                    placeholder="https://example.com/article"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                  />
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="Name (optional)"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                </div>
              )}

              {addTab === "file" && (
                <div className={styles.formFields}>
                  <div
                    className={`${styles.dropzone} ${selectedFile ? styles.dropzoneSelected : ""}`}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                  >
                    <Upload size={16} color="var(--text-muted)" />
                    {selectedFile
                      ? <span className={styles.dropzoneFile}>{selectedFile.name}</span>
                      : <span className={styles.dropzoneHint}>Click to select a PDF or DOCX file</span>
                    }
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx"
                    style={{ display: "none" }}
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              )}

              {addError && <p className={styles.formError}>{addError}</p>}

              <div className={styles.formActions}>
                <span className={styles.formHint}>⌘ Enter to add</span>
                <button className={styles.cancelBtn} onClick={resetForm} disabled={adding}>
                  Cancel
                </button>
                <button className={styles.createBtn} onClick={handleAdd} disabled={adding}>
                  {adding ? <Spinner size={11} /> : null}
                  {adding ? "Adding…" : "Add"}
                </button>
              </div>
            </div>
          )}

          <p className={styles.description}>
            These RSS feeds are ingested into the vector store and used to answer your questions.
            Feeds refresh automatically every 60 minutes.
          </p>

          <div className={styles.feedList}>
            {FEEDS.map((feed) => (
              <div key={feed.name} className={`${styles.feedCard} ${!feed.active ? styles.feedCardInactive : ""}`}>
                <div className={styles.feedHeader}>
                  <div className={styles.feedIconWrap}>
                    <Rss size={14} color={feed.active ? "var(--accent)" : "var(--text-muted)"} />
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
                  {feed.active
                    ? <span className={styles.activeBadge}>Active</span>
                    : <span className={styles.inactiveBadge}>Disabled</span>
                  }
                </div>
                <p className={styles.feedDesc}>{feed.description}</p>
                <div className={styles.feedUrl}>
                  <span className={styles.feedUrlLabel}>RSS</span>
                  <code className={styles.feedUrlText}>{feed.url}</code>
                </div>
              </div>
            ))}
          </div>

          {/* ── User sources ── */}
          {(sourcesLoading || sources.length > 0) && (
            <>
              <p className={styles.sectionLabel}>Your Sources</p>
              {sourcesLoading ? (
                <div className={styles.sourcesLoading}><Spinner size={14} /></div>
              ) : (
                <div className={styles.feedList}>
                  {sources.map((s) => {
                    const isFile = s.type === "pdf" || s.type === "docx" || s.type === "file";
                    const typeLabel = s.type === "pdf" ? "PDF" : s.type === "docx" ? "DOCX" : s.type === "url" ? "URL" : "File";
                    const Icon = isFile ? FileText : Globe;
                    return (
                      <div key={s.id} className={styles.feedCard}>
                        <div className={styles.feedHeader}>
                          <div className={styles.feedIconWrap}>
                            <Icon size={14} color="var(--accent)" />
                          </div>
                          <div className={styles.feedMeta}>
                            <span className={styles.feedName}>{s.name}</span>
                            {s.url && (
                              <span className={styles.feedLink}>
                                {s.url.length > 60 ? s.url.slice(0, 60) + "…" : s.url}
                              </span>
                            )}
                          </div>
                          <span className={styles.activeBadge}>Active</span>
                          <button
                            className={styles.deleteBtn}
                            onClick={() => handleDelete(s.id)}
                            title="Remove source"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className={styles.feedUrl}>
                          <span className={styles.feedUrlLabel}>{typeLabel}</span>
                          <code className={styles.feedUrlText}>
                            {s.chunk_count} chunk{s.chunk_count !== 1 ? "s" : ""} ingested
                            {" · "}added {new Date(s.added_at).toLocaleDateString()}
                          </code>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
