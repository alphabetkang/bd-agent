export interface Company {
  name: string;
  context: string;
  source: string;
  url: string;
}

export interface SourceDoc {
  id: string;
  title: string;
  url: string;
  source: string;
  text: string;
}

export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  companies?: Company[];
  sources?: SourceDoc[];
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

export interface Article {
  url: string;
  title: string;
  published: string;
  source: string;
  snippet: string;
  companies: string[];
  pinned?: boolean;
}

export interface ShortlistedCompany {
  name: string;
  rationale: string;
}

export interface ResearchAgent {
  id: string;
  prompt: string;
  name: string;
  createdAt: number;
  articles: Article[];
  summary: string;
  status: "loading" | "ready" | "error";
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
