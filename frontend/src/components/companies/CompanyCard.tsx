import { ExternalLink } from "lucide-react";
import { Company } from "@/types";
import styles from "./CompanyCard.module.css";

interface CompanyCardProps {
  company: Company;
  index: number;
  selected?: boolean;
  onClick?: () => void;
}

export function CompanyCard({ company, index, selected, onClick }: CompanyCardProps) {
  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ""} ${onClick ? styles.clickable : ""}`}
      style={{ animationDelay: `${index * 60}ms` }}
      onClick={onClick}
    >
      <div className={styles.cardHeader}>
        <span className={styles.companyName}>{company.name}</span>
        {company.url && (
          <a
            href={company.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
            title="Open source"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      <p className={styles.context}>{company.context}</p>

      {company.source && (
        <span className={styles.sourceBadge}>{company.source}</span>
      )}
    </div>
  );
}
