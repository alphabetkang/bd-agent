import { Company, UserSource } from "@/types";

const API_BASE = "/api";

export async function exportReport(
  query: string,
  companies: Company[],
  answer: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/reports/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, companies, answer }),
  });

  if (!res.ok) throw new Error("Report export failed");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="(.+)"/);
  a.download = match ? match[1] : "report.md";
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchSources(): Promise<UserSource[]> {
  const res = await fetch(`${API_BASE}/sources`);
  if (!res.ok) throw new Error("Failed to load sources");
  return res.json();
}

export async function addUrlSource(url: string, name?: string): Promise<UserSource> {
  const res = await fetch(`${API_BASE}/sources/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, name: name ?? "" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Failed to add source");
  }
  return res.json();
}

export async function uploadSource(file: File): Promise<UserSource> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/sources/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Upload failed");
  }
  return res.json();
}

export async function deleteSource(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/sources/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Delete failed");
}
