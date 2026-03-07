"use client";

import { useCallback, useRef, useState } from "react";
import { SourceDoc } from "@/types";

export interface CompanyMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export type CompanyChatStatus = "idle" | "loading" | "done" | "error";

let _cid = 0;
const uid = () => `cm_${++_cid}_${Date.now()}`;

export function useCompanyChat() {
  const [messages, setMessages] = useState<CompanyMessage[]>([]);
  const [sources, setSources] = useState<SourceDoc[]>([]);
  const [status, setStatus] = useState<CompanyChatStatus>("idle");
  const [statusText, setStatusText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setSources([]);
    setStatus("idle");
    setStatusText("");
  }, []);

  const sendMessage = useCallback(
    async (query: string, companyName: string, articleUrl?: string) => {
    if (!query.trim()) return;

    const userMsg: CompanyMessage = { id: uid(), role: "user", content: query };
    const asstId = uid();
    const asstMsg: CompanyMessage = {
      id: asstId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, asstMsg]);
    setStatus("loading");
    setStatusText(articleUrl ? "Loading full article..." : `Retrieving sources for ${companyName}...`);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/company/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName,
          query,
          article_url: articleUrl ?? null,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let event: any;
          try {
            event = JSON.parse(raw);
          } catch {
            continue;
          }

          const content = event.content;
          switch (event.type) {
            case "status":
              setStatusText(
                typeof content === "object" ? content.message ?? "" : content
              );
              break;
            case "token": {
              const text =
                typeof content === "object" ? content.text ?? "" : content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === asstId ? { ...m, content: m.content + text } : m
                )
              );
              break;
            }
            case "sources": {
              const newSources: SourceDoc[] =
                typeof content === "object" ? content.sources ?? [] : [];
              setSources(newSources);
              break;
            }
            case "done":
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === asstId ? { ...m, isStreaming: false } : m
                )
              );
              setStatus("done");
              setStatusText("");
              break;
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstId
            ? {
                ...m,
                content: "Something went wrong. Please try again.",
                isStreaming: false,
              }
            : m
        )
      );
      setStatus("error");
    }
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
  }, []);

  return {
    messages,
    sources,
    setSources,
    status,
    statusText,
    sendMessage,
    clearHistory,
    abort,
  };
}
