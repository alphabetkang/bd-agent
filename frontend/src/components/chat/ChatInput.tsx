"use client";

import { KeyboardEvent, useRef, useState } from "react";
import { Send, Square } from "lucide-react";
import styles from "./ChatInput.module.css";

interface ChatInputProps {
  onSend: (query: string) => void;
  onAbort: () => void;
  isStreaming: boolean;
}

export function ChatInput({ onSend, onAbort, isStreaming }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    onSend(trimmed);
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  return (
    <div className={styles.inputArea}>
      <div className={styles.inputWrapper}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={value}
          onChange={(e) => { setValue(e.target.value); handleInput(); }}
          onKeyDown={handleKey}
          placeholder="Ask about companies, markets, funding, trends..."
          rows={1}
          disabled={isStreaming}
        />

        <div className={styles.actions}>
          <span className={styles.hint}>
            {isStreaming ? "" : "Enter to send · Shift+Enter for newline"}
          </span>
          {isStreaming ? (
            <button
              className={styles.stopBtn}
              onClick={onAbort}
              title="Stop"
            >
              <Square size={14} />
              <span>Stop</span>
            </button>
          ) : (
            <button
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={!value.trim()}
              title="Send"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
