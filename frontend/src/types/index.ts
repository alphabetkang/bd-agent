export interface Company {
  name: string;
  context: string;
  source: string;
  url: string;
}

export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  companies?: Company[];
  isStreaming?: boolean;
  isNotification?: boolean;
}

export type ChatStatus =
  | "idle"
  | "retrieving"
  | "searching"
  | "analysing"
  | "extracting"
  | "done"
  | "error";

export interface SSEEvent {
  type: "status" | "token" | "companies" | "done" | "error";
  content: string | { message?: string; text?: string; companies?: Company[] };
}

export interface UserSource {
  id: string;
  name: string;
  type: "url" | "pdf" | "docx" | "file";
  url: string | null;
  added_at: string;
  chunk_count: number;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
}
