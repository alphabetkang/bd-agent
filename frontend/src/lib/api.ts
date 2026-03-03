import { Company } from "@/types";

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
