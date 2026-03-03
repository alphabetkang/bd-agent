"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatSession, ChatStatus, Company, Message } from "@/types";

let _counter = 0;
const uid = () => `msg_${++_counter}_${Date.now()}`;
const sid = () => `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

function makeSession(n: number): ChatSession {
  return { id: sid(), title: `Chat ${n}`, createdAt: Date.now(), messages: [] };
}

const SESSIONS_KEY = "bd_sessions";
const ACTIVE_KEY = "bd_active_session";

export function useSessions() {
  const sessionCount = useRef(1);

  const [sessions, setSessions] = useState<ChatSession[]>(() => [makeSession(1)]);
  const [activeId, setActiveId] = useState<string>(() => sessions[0].id);
  const [statusMap, setStatusMap] = useState<Record<string, ChatStatus>>({});
  const [statusTextMap, setStatusTextMap] = useState<Record<string, string>>({});
  const [statusHistoryMap, setStatusHistoryMap] = useState<Record<string, ChatStatus[]>>({});
  const abortMap = useRef<Record<string, AbortController>>({});

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSIONS_KEY);
      const rawActive = localStorage.getItem(ACTIVE_KEY);
      if (raw) {
        const parsed: ChatSession[] = JSON.parse(raw);
        if (parsed.length > 0) {
          sessionCount.current = parsed.length;
          setSessions(parsed);
          const activeExists = rawActive && parsed.some((s) => s.id === rawActive);
          setActiveId(activeExists ? rawActive! : parsed[0].id);
        }
      }
    } catch {}
  }, []);

  // Persist sessions
  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    } catch {}
  }, [sessions]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_KEY, activeId);
    } catch {}
  }, [activeId]);

  const newSession = useCallback(() => {
    sessionCount.current += 1;
    const s = makeSession(sessionCount.current);
    setSessions((prev) => [...prev, s]);
    setActiveId(s.id);
  }, []);

  const closeSession = useCallback((id: string) => {
    setSessions((prev) => {
      if (prev.length === 1) return prev;
      const next = prev.filter((s) => s.id !== id);
      setActiveId((cur) => (cur === id ? next[next.length - 1].id : cur));
      return next;
    });
  }, []);

  const sendMessage = useCallback(
    async (query: string) => {
      if (!query.trim()) return;
      const currentId = activeId;
      const userMsgId = uid();
      const asstMsgId = uid();

      const userMsg: Message = { id: userMsgId, role: "user", content: query };
      const asstMsg: Message = { id: asstMsgId, role: "assistant", content: "", isStreaming: true };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== currentId) return s;
          const isFirst = s.messages.length === 0;
          return {
            ...s,
            title: isFirst
              ? query.slice(0, 38) + (query.length > 38 ? "…" : "")
              : s.title,
            messages: [...s.messages, userMsg, asstMsg],
          };
        })
      );

      setStatusMap((p) => ({ ...p, [currentId]: "retrieving" }));
      setStatusTextMap((p) => ({ ...p, [currentId]: "Retrieving from news archive..." }));
      setStatusHistoryMap((p) => ({ ...p, [currentId]: ["retrieving"] }));

      const ctrl = new AbortController();
      abortMap.current[currentId] = ctrl;

      try {
        const res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
          signal: ctrl.signal,
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
              case "status": {
                const msg =
                  typeof content === "object" ? content.message ?? "" : content;
                setStatusTextMap((p) => ({ ...p, [currentId]: msg }));
                let newStatus: ChatStatus | null = null;
                if (msg.includes("web")) newStatus = "searching";
                else if (msg.includes("Analys")) newStatus = "analysing";
                else if (msg.includes("compan")) newStatus = "extracting";
                if (newStatus) {
                  const ns = newStatus;
                  setStatusMap((p) => ({ ...p, [currentId]: ns }));
                  setStatusHistoryMap((p) => ({
                    ...p,
                    [currentId]: [...(p[currentId] ?? []), ns],
                  }));
                }
                break;
              }
              case "token": {
                const text =
                  typeof content === "object" ? content.text ?? "" : content;
                setSessions((prev) =>
                  prev.map((s) =>
                    s.id !== currentId
                      ? s
                      : {
                          ...s,
                          messages: s.messages.map((m) =>
                            m.id !== asstMsgId
                              ? m
                              : { ...m, content: m.content + text }
                          ),
                        }
                  )
                );
                break;
              }
              case "companies": {
                const companies: Company[] =
                  typeof content === "object" ? content.companies ?? [] : [];
                setSessions((prev) =>
                  prev.map((s) =>
                    s.id !== currentId
                      ? s
                      : {
                          ...s,
                          messages: s.messages.map((m) =>
                            m.id !== asstMsgId ? m : { ...m, companies }
                          ),
                        }
                  )
                );
                break;
              }
              case "done": {
                setSessions((prev) =>
                  prev.map((s) =>
                    s.id !== currentId
                      ? s
                      : {
                          ...s,
                          messages: s.messages.map((m) =>
                            m.id !== asstMsgId ? m : { ...m, isStreaming: false }
                          ),
                        }
                  )
                );
                setStatusMap((p) => ({ ...p, [currentId]: "done" }));
                setStatusTextMap((p) => ({ ...p, [currentId]: "" }));
                break;
              }
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setSessions((prev) =>
          prev.map((s) =>
            s.id !== currentId
              ? s
              : {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id !== asstMsgId
                      ? m
                      : {
                          ...m,
                          content: "Something went wrong. Please try again.",
                          isStreaming: false,
                        }
                  ),
                }
          )
        );
        setStatusMap((p) => ({ ...p, [currentId]: "error" }));
      }
    },
    [activeId]
  );

  const abort = useCallback(() => {
    abortMap.current[activeId]?.abort();
    setStatusMap((p) => ({ ...p, [activeId]: "idle" }));
  }, [activeId]);

  const addNotification = useCallback(
    (text: string) => {
      const notifMsg: Message = {
        id: uid(),
        role: "assistant",
        content: text,
        isNotification: true,
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeId ? { ...s, messages: [...s.messages, notifMsg] } : s
        )
      );
    },
    [activeId]
  );

  const activeSession = sessions.find((s) => s.id === activeId) ?? sessions[0];
  const status: ChatStatus = statusMap[activeId] ?? "idle";
  const statusText: string = statusTextMap[activeId] ?? "";
  const statusHistory: ChatStatus[] = statusHistoryMap[activeId] ?? [];

  return {
    sessions,
    activeId,
    activeSession,
    status,
    statusText,
    statusHistory,
    setActiveId,
    newSession,
    closeSession,
    sendMessage,
    abort,
    addNotification,
  };
}
