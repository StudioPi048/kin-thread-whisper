import type { ReactNode } from "react";
import { FolderOpen } from "lucide-react";
export interface ArchiveEmptyStateProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  withSeal?: boolean;
  image?: string;
}
export function ArchiveEmptyState({ title, description, action }: ArchiveEmptyStateProps) {
  return (
    <section className="atlas-empty">
      <FolderOpen size={32} strokeWidth={1.3} aria-hidden />
      <h2>{title}</h2>
      <p>{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </section>
  );
}
