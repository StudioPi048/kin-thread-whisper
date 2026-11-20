import type { ReactNode } from "react";
import "./document-header.css";
export interface DocumentHeaderProps {
  breadcrumb?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  illustration?: ReactNode;
  children?: ReactNode;
}
export function DocumentHeader({
  breadcrumb,
  title,
  subtitle,
  actions,
  illustration,
  children,
}: DocumentHeaderProps) {
  return (
    <header
      className="archive-document-header atlas-page-header"
      data-illustrated={illustration != null ? "true" : undefined}
    >
      <div className="container-liz">
        <div className="archive-document-content">
          {breadcrumb != null && breadcrumb !== title && (
            <nav aria-label="Localização" className="atlas-breadcrumb">
              {breadcrumb}
            </nav>
          )}
          <div className="atlas-page-heading">
            <div className="min-w-0">
              <div role="heading" aria-level={1} className="atlas-title">
                {title}
              </div>
              {subtitle && <div className="atlas-subtitle">{subtitle}</div>}
            </div>
            {actions && <div className="atlas-page-actions">{actions}</div>}
          </div>
          {children && <div className="archive-document-extra mt-5">{children}</div>}
        </div>
        {illustration != null && (
          <div className="archive-document-illustration" aria-hidden="true">
            {illustration}
          </div>
        )}
      </div>
    </header>
  );
}
