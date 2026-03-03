"use client";

import { useState } from "react";
import { Download, Building2 } from "lucide-react";
import { Company } from "@/types";
import { CompanyCard } from "./CompanyCard";
import { Spinner } from "@/components/ui/Spinner";
import { exportReport } from "@/lib/api";
import styles from "./CompaniesPanel.module.css";

interface CompaniesPanelProps {
  companies: Company[];
  query: string;
  answer: string;
  isLoading: boolean;
}

export function CompaniesPanel({
  companies,
  query,
  answer,
  isLoading,
}: CompaniesPanelProps) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (exporting || !companies.length) return;
    setExporting(true);
    try {
      await exportReport(query, companies, answer);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.headerLeft}>
          <Building2 size={14} color="var(--text-muted)" />
          <span className={styles.panelTitle}>Companies</span>
          {companies.length > 0 && (
            <span className={styles.countChip}>{companies.length}</span>
          )}
        </div>

        {companies.length > 0 && (
          <button
            className={styles.exportBtn}
            onClick={handleExport}
            disabled={exporting}
            title="Export report"
          >
            {exporting ? (
              <Spinner size={12} />
            ) : (
              <Download size={12} />
            )}
            <span>{exporting ? "Exporting..." : "Export Report"}</span>
          </button>
        )}
      </div>

      <div className={styles.panelBody}>
        {isLoading && companies.length === 0 ? (
          <div className={styles.loading}>
            <Spinner size={20} />
            <span>Identifying companies...</span>
          </div>
        ) : companies.length === 0 ? (
          <div className={styles.empty}>
            <Building2 size={24} color="var(--border)" />
            <p>Companies identified from your query will appear here.</p>
          </div>
        ) : (
          <div className={styles.companyList}>
            {companies.map((company, i) => (
              <CompanyCard key={company.name} company={company} index={i} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
