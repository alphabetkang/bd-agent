"use client";

import { useCallback, useRef, useState } from "react";
import { ChatStatus, Company, Message, SSEEvent } from "@/types";

let idCounter = 0;
const uid = () => `msg_${++idCounter}_${Date.now()}`;

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [statusText, setStatusText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (query: string) => {
    if (!query.trim()) return;

    // Add user message
    const userMsg: Message = { id: uid(), role: "user", content: query };
    const assistantId = uid();
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStatus("retrieving");
    setStatusText("Retrieving from news archive...");

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
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

          let event: SSEEvent;
          try {
            event = JSON.parse(raw);
          } catch {
            continue;
          }

          const content = event.content;

          switch (event.type) {
            case "status": {
              const msg =
                typeof content === "object" ? content.message ?? "" : content;
              setStatusText(msg);
              if (msg.includes("web")) setStatus("searching");
              else if (msg.includes("Analys")) setStatus("analysing");
              else if (msg.includes("compan")) setStatus("extracting");
              break;
            }

            case "token": {
              const text =
                typeof content === "object" ? content.text ?? "" : content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + text }
                    : m
                )
              );
              break;
            }

            case "companies": {
              const companies: Company[] =
                typeof content === "object"
                  ? (content.companies ?? [])
                  : [];
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, companies } : m
                )
              );
              break;
            }

            case "done": {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, isStreaming: false } : m
                )
              );
              setStatus("done");
              setStatusText("");
              break;
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Something went wrong. Please try again.", isStreaming: false }
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

  return { messages, status, statusText, sendMessage, abort };
}
