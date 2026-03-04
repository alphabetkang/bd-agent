"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatStatus, Message } from "@/types";
import { Spinner } from "@/components/ui/Spinner";
import styles from "./MessageItem.module.css";

interface MessageItemProps {
  message: Message;
  response: Message | null;
  selected: boolean;
  onSelect: (id: string | null) => void;
  statusHistory?: ChatStatus[];
}

const PIPELINE_STEPS: { id: ChatStatus; label: string }[] = [
  { id: "retrieving", label: "Searching knowledge base" },
  { id: "searching",  label: "Searching the web" },
  { id: "analysing",  label: "Synthesizing results" },
  { id: "extracting", label: "Identifying companies" },
];

const STEP_IDS = new Set<ChatStatus>(PIPELINE_STEPS.map((s) => s.id));

export function MessageItem({ message, response, selected, onSelect, statusHistory }: MessageItemProps) {
  const isSelectable = !!response?.companies?.length && !response?.isStreaming;

  const [visibleSteps, setVisibleSteps] = useState<{ id: ChatStatus; state: "active" | "done" }[]>([]);
  const activatedAtRef = useRef<Partial<Record<ChatStatus, number>>>({});
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const processedLenRef = useRef(0);
  const prevStepRef = useRef<ChatStatus | undefined>(undefined);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      processedLenRef.current = 0;
      prevStepRef.current = undefined;
      activatedAtRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!response?.isStreaming || !statusHistory?.length) return;

    const newEntries = statusHistory
      .slice(processedLenRef.current)
      .filter((s) => STEP_IDS.has(s));

    if (!newEntries.length) {
      processedLenRef.current = statusHistory.length;
      return;
    }
    processedLenRef.current = statusHistory.length;

    newEntries.forEach((status, i) => {
      const predecessor = i === 0 ? prevStepRef.current : newEntries[i - 1];

      activatedAtRef.current[status] = Date.now();
      setVisibleSteps((prev) =>
        prev.some((s) => s.id === status)
          ? prev
          : [...prev, { id: status, state: "active" as const }]
      );

      if (predecessor && STEP_IDS.has(predecessor)) {
        const elapsed = Date.now() - (activatedAtRef.current[predecessor] ?? Date.now() - 500);
        const delay = Math.max(0, 500 - elapsed);
        const t = setTimeout(() => {
          setVisibleSteps((prev) =>
            prev.map((s) => (s.id === predecessor ? { ...s, state: "done" as const } : s))
          );
        }, delay);
        timersRef.current.push(t);
      }
    });

    prevStepRef.current = newEntries[newEntries.length - 1];
  }, [statusHistory, response?.isStreaming]);

  function handleClick() {
    if (!response || !isSelectable) return;
    onSelect(selected ? null : response.id);
  }

  if (message.isNotification) {
    return (
      <div className={styles.notification}>
        <CheckCircle size={13} color="#22c55e" style={{ flexShrink: 0, marginTop: 1 }} />
        <div className={styles.notificationText}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.command} ${selected ? styles.selected : ""} ${isSelectable ? styles.selectable : ""}`}
      onClick={handleClick}
    >
      <div className={styles.commandRow}>
        <span className={styles.prompt}>›</span>
        <span className={styles.commandText}>{message.content}</span>
        {response?.isStreaming && <Spinner size={11} />}
      </div>

      {response?.isStreaming && visibleSteps.length > 0 && (
        <div className={styles.stepLog}>
          {visibleSteps.map(({ id, state }) => {
            const step = PIPELINE_STEPS.find((s) => s.id === id)!;
            return (
              <div
                key={id}
                className={`${styles.stepItem} ${state === "done" ? styles.stepDone : styles.stepActive}`}
              >
                <span className={styles.stepIcon}>
                  {state === "done" ? <Check size={11} /> : <Spinner size={11} />}
                </span>
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {response && response.companies && response.companies.length > 0 && (
        <div className={styles.companyCount}>
          <span className={`${styles.countBadge} ${selected ? styles.countBadgeSelected : ""}`}>
            {response.companies.length}{" "}
            {response.companies.length === 1 ? "company" : "companies"} identified
            {isSelectable && !selected && <span className={styles.viewHint}> · click to view</span>}
          </span>
        </div>
      )}
    </div>
  );
}
