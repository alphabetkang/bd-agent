"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { Article } from "@/types";
import { ArticleChat } from "./ArticleChat";
import styles from "./ArticleDetail.module.css";

interface ArticleDetailProps {
  article: Article;
  onClose: () => void;
}

interface ArticleContent {
  title: string;
  hero_image: string;
  html: string;
}

export function ArticleDetail({ article, onClose }: ArticleDetailProps) {
  const [content, setContent] = useState<ArticleContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [highlightText, setHighlightText] = useState<string | null>(null);
  const articleBodyRef = useRef<HTMLDivElement>(null);

  // DOM-based text highlight: find the chunk text in the rendered article and wrap it.
  // Chunks now come from the same article fetch as the rendered HTML, so text matches.
  // We concatenate all text nodes, do whitespace-normalized search across them, then
  // split and wrap the relevant text node(s) with <mark> — handles text that spans
  // multiple DOM nodes (e.g., across inline <a>, <em>, etc.).
  useEffect(() => {
    const container = articleBodyRef.current;
    if (!container) return;

    // Remove previous highlights and re-merge split text nodes
    container.querySelectorAll("mark.citation-hl").forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
        (parent as Element).normalize?.();
      }
    });

    if (!highlightText) return;

    // Collect all text nodes and build a concatenated string with position offsets
    const textNodes: Text[] = [];
    const nodeStarts: number[] = [];
    let fullText = "";
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const tn = n as Text;
      nodeStarts.push(fullText.length);
      fullText += tn.textContent ?? "";
      textNodes.push(tn);
    }

    // Build a whitespace-normalized version of fullText and a map: normPos → origPos
    const normToOrig: number[] = [];
    let normText = "";
    let prevWasSpace = false;
    for (let i = 0; i < fullText.length; i++) {
      if (/\s/.test(fullText[i])) {
        if (!prevWasSpace) { normToOrig.push(i); normText += " "; prevWasSpace = true; }
      } else {
        normToOrig.push(i); normText += fullText[i]; prevWasSpace = false;
      }
    }

    const attempts = [
      highlightText.trim().slice(0, 120),
      highlightText.trim().slice(0, 60),
      highlightText.trim().slice(0, 30),
    ];

    for (const query of attempts) {
      if (!query) continue;
      const normQuery = query.replace(/\s+/g, " ").trim();
      const normIdx = normText.indexOf(normQuery);
      if (normIdx === -1) continue;

      // Map normalized positions back to original fullText positions
      const origStart = normToOrig[normIdx];
      const origEnd = normToOrig[Math.min(normIdx + normQuery.length - 1, normToOrig.length - 1)] + 1;

      // Wrap each text node that overlaps [origStart, origEnd)
      let firstMark: HTMLElement | null = null;
      for (let i = 0; i < textNodes.length; i++) {
        const nodeStart = nodeStarts[i];
        const tn = textNodes[i];
        const nodeText = tn.textContent ?? "";
        const nodeEnd = nodeStart + nodeText.length;
        if (nodeEnd <= origStart || nodeStart >= origEnd) continue;

        const localStart = Math.max(0, origStart - nodeStart);
        const localEnd = Math.min(nodeText.length, origEnd - nodeStart);
        const before = nodeText.slice(0, localStart);
        const matched = nodeText.slice(localStart, localEnd);
        const after = nodeText.slice(localEnd);

        const mark = document.createElement("mark");
        mark.className = "citation-hl";
        mark.textContent = matched;

        const parent = tn.parentNode;
        if (!parent) continue;
        parent.replaceChild(mark, tn);
        if (after) parent.insertBefore(document.createTextNode(after), mark.nextSibling);
        if (before) parent.insertBefore(document.createTextNode(before), mark);

        if (!firstMark) firstMark = mark;
      }

      if (firstMark) {
        firstMark.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
  }, [highlightText]);

  const handleCitationClick = useCallback((text: string) => {
    setHighlightText(text);
  }, []);

  useEffect(() => {
    setContent(null);
    setHighlightText(null);
    setLoading(true);
    setError("");

    fetch(`/api/company/article-content?url=${encodeURIComponent(article.url)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: ArticleContent) => setContent(data))
      .catch(() => setError("Could not load the article."))
      .finally(() => setLoading(false));
  }, [article.url]);

  return (
    <div className={styles.detail}>
      {/* ── Article reader panel ───────────────────── */}
      <div className={styles.readerPanel}>
        <div className={styles.readerHeader}>
          <button className={styles.backBtn} onClick={onClose}>
            <ArrowLeft size={13} />
            <span>Dashboard</span>
          </button>
          {article.companies.length > 0 && (
            <div className={styles.companies}>
              {article.companies.map((c) => (
                <span key={c} className={styles.pill}>{c}</span>
              ))}
            </div>
          )}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.extLink}
            title="Open on TechCrunch"
          >
            <ExternalLink size={12} />
          </a>
        </div>

        <div className={styles.readerBody}>
          {loading && (
            <div className={styles.readerLoading}>
              <Loader2 size={22} className={styles.spin} />
              <span>Loading article…</span>
            </div>
          )}

          {error && (
            <div className={styles.readerError}>
              <p>{error}</p>
              <a href={article.url} target="_blank" rel="noopener noreferrer">
                Open on TechCrunch →
              </a>
            </div>
          )}

          {content && (
            <article className={styles.articleContent}>
              {content.hero_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={content.hero_image} alt="" className={styles.heroImage} />
              )}
              <h1 className={styles.articleTitle}>{content.title || article.title}</h1>
              <div
                ref={articleBodyRef}
                className={styles.articleBody}
                dangerouslySetInnerHTML={{ __html: content.html }}
              />
            </article>
          )}
        </div>
      </div>

      {/* ── Chat panel ────────────────────────────── */}
      <div className={styles.chatPanel}>
        <ArticleChat article={article} onCitationClick={handleCitationClick} onClose={onClose} />
      </div>
    </div>
  );
}
