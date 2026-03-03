"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Link, Upload, Trash2, FileText, Globe, Rss, CheckCircle } from "lucide-react";
import { UserSource } from "@/types";
import { addUrlSource, deleteSource, fetchSources, uploadSource } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";
import styles from "./AddSourceModal.module.css";

interface AddSourceModalProps {
  onClose: () => void;
}

type UploadState = "idle" | "loading" | "success" | "error";

export function AddSourceModal({ onClose }: AddSourceModalProps) {
  const [sources, setSources] = useState<UserSource[]>([]);
  const [url, setUrl] = useState("");
  const [urlName, setUrlName] = useState("");
  const [urlState, setUrlState] = useState<UploadState>("idle");
  const [urlError, setUrlError] = useState("");

  const [fileState, setFileState] = useState<UploadState>("idle");
  const [fileError, setFileError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSources().then(setSources).catch(console.error);
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleAddUrl() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setUrlState("loading");
    setUrlError("");
    try {
      const entry = await addUrlSource(trimmed, urlName.trim());
      setSources((prev) => [...prev, entry]);
      setUrl("");
      setUrlName("");
      setUrlState("success");
      setTimeout(() => setUrlState("idle"), 2000);
    } catch (err: unknown) {
      setUrlError(err instanceof Error ? err.message : "Failed to add URL");
      setUrlState("error");
    }
  }

  async function handleFile(file: File) {
    setFileState("loading");
    setFileError("");
    try {
      const entry = await uploadSource(file);
      setSources((prev) => [...prev, entry]);
      setFileState("success");
      setTimeout(() => setFileState("idle"), 2000);
    } catch (err: unknown) {
      setFileError(err instanceof Error ? err.message : "Upload failed");
      setFileState("error");
    }
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  async function handleDelete(id: string) {
    try {
      await deleteSource(id);
      setSources((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  function sourceIcon(type: UserSource["type"]) {
    if (type === "pdf" || type === "docx" || type === "file")
      return <FileText size={12} />;
    return <Globe size={12} />;
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-label="Add Data Source">
        {/* Header */}
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Add Data Source</span>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* URL section */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Link size={13} color="var(--accent)" />
              <span className={styles.sectionTitle}>From URL</span>
            </div>
            <p className={styles.sectionHint}>Paste an RSS feed or any web page URL.</p>

            <input
              className={styles.input}
              type="url"
              placeholder="https://example.com/feed.rss"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlState("idle"); setUrlError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
            />
            <input
              className={styles.input}
              type="text"
              placeholder="Display name (optional)"
              value={urlName}
              onChange={(e) => setUrlName(e.target.value)}
            />

            {urlError && <p className={styles.error}>{urlError}</p>}

            <button
              className={styles.primaryBtn}
              onClick={handleAddUrl}
              disabled={!url.trim() || urlState === "loading"}
            >
              {urlState === "loading" ? (
                <><Spinner size={12} /><span>Adding…</span></>
              ) : urlState === "success" ? (
                <><CheckCircle size={13} /><span>Added!</span></>
              ) : (
                <><Rss size={13} /><span>Add Source</span></>
              )}
            </button>
          </section>

          <div className={styles.divider} />

          {/* File upload section */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Upload size={13} color="var(--accent)" />
              <span className={styles.sectionTitle}>Upload File</span>
            </div>
            <p className={styles.sectionHint}>PDF or DOCX — up to 20 MB.</p>

            <div
              className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ""} ${fileState === "loading" ? styles.dropzoneLoading : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileState !== "loading" && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                className={styles.hiddenInput}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
              {fileState === "loading" ? (
                <><Spinner size={20} /><span>Processing…</span></>
              ) : fileState === "success" ? (
                <><CheckCircle size={20} color="#22c55e" /><span>File added!</span></>
              ) : (
                <>
                  <Upload size={20} color="var(--text-muted)" />
                  <span>Drop file here or <span className={styles.browse}>browse</span></span>
                  <span className={styles.dropzoneHint}>.pdf  .docx</span>
                </>
              )}
            </div>
            {fileError && <p className={styles.error}>{fileError}</p>}
          </section>

          {/* Sources list */}
          {sources.length > 0 && (
            <>
              <div className={styles.divider} />
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>Your Sources</span>
                  <span className={styles.countChip}>{sources.length}</span>
                </div>
                <ul className={styles.sourceList}>
                  {sources.map((s) => (
                    <li key={s.id} className={styles.sourceItem}>
                      <span className={styles.sourceIcon}>{sourceIcon(s.type)}</span>
                      <div className={styles.sourceMeta}>
                        <span className={styles.sourceName}>{s.name}</span>
                        <span className={styles.sourceDetail}>
                          {s.chunk_count} chunk{s.chunk_count !== 1 ? "s" : ""} ingested
                        </span>
                      </div>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(s.id)}
                        title="Remove source"
                      >
                        <Trash2 size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
