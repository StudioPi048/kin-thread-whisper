import { Link } from "@tanstack/react-router";
import {
  MoreHorizontal,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  ArrowUpRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
export type DossierStatus = "active" | "archived";
export type ConsentStatus = "signed" | "pending" | "none";
export type MaterialStability = "stable" | "planned" | "experimental" | "deprecated";

export type PatternItem = {
  label: string;
  type?: "sentido" | "lealdade" | "aniversario" | "geral";
};

export interface DossierCardProps {
  /** Unique ID — routing key */
  id: string;
  /** Número de registro editorial (e.g. "000214") */
  registrationNumber: string;
  /** Nome completo normalizado */
  patientName: string;
  /** Nome preferido, se houver */
  preferredName?: string | null;
  /** Subtítulo — especialidade / tag principal */
  subtitle?: string | null;
  /** Idade calculada */
  age?: number | null;
  /** Cidade de nascimento */
  birthplace?: string | null;
  /** Queixa principal */
  presentingComplaint?: string | null;
  /** Status do dossiê */
  status: DossierStatus;
  /** Padrões clínicos (dados reais — nunca fictícios) */
  patterns?: PatternItem[];
  /** Insight da IA Clínica. null/undefined = não renderiza nada */
  aiInsight?: string | null;
  /** Status de consentimento */
  consentStatus?: ConsentStatus;
  /**
   * Variante visual — altera estrutura, densidade e metadados exibidos:
   *
   * "full"    → Tela de Clientes: dossiê completo, todos os blocos
   * "compact" → Dashboard / Agenda / Busca: versão densa, sem blocos longos
   */
  variant?: "full" | "compact";
  /* Ações de gestão */
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function DossierCard({
  id,
  registrationNumber,
  patientName,
  preferredName,
  subtitle,
  age,
  birthplace,
  presentingComplaint,
  status,
  patterns = [],
  aiInsight,
  consentStatus = "none",
  variant = "full",
  onEdit,
  onArchive,
  onDelete,
}: DossierCardProps) {
  return (
    <article className="atlas-dossier-card">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">Registro {registrationNumber}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Ações para ${patientName}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive}>
              {status === "archived" ? <ArchiveRestore /> : <Archive />}
              {status === "archived" ? "Reativar" : "Arquivar"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Link to="/app/clientes/$clientId" params={{ clientId: id }} className="group block">
        <h3 className="group-hover:underline underline-offset-4">{preferredName || patientName}</h3>
        <p className="mt-2">
          {[age != null ? `${age} anos` : null, birthplace, subtitle].filter(Boolean).join(" · ") ||
            "Dossiê do cliente"}
        </p>
      </Link>
      {variant === "full" && presentingComplaint && (
        <p className="line-clamp-3">{presentingComplaint}</p>
      )}
      {patterns.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {patterns.slice(0, 3).map((p, i) => (
            <span className="atlas-chip" key={i}>
              {p.label}
            </span>
          ))}
        </div>
      )}
      {aiInsight && <p>{aiInsight}</p>}
      <footer>
        <div className="flex flex-wrap gap-2">
          <span className="atlas-status">
            {status === "active" ? "Em acompanhamento" : "Arquivado"}
          </span>
          {consentStatus === "pending" && <span>Consentimento pendente</span>}
          {consentStatus === "signed" && <span>Consentimento registrado</span>}
        </div>
        <Link
          to="/app/clientes/$clientId"
          params={{ clientId: id }}
          aria-label={`Abrir dossiê de ${patientName}`}
        >
          <ArrowUpRight size={18} />
        </Link>
      </footer>
    </article>
  );
}
export function DossierCardSkeleton({ variant = "full" }: { variant?: "full" | "compact" }) {
  return (
    <div className="atlas-dossier-card" aria-busy="true" aria-label="Carregando dossiê">
      <div className="skeleton h-4 w-1/3" />
      <div className="skeleton h-7 w-2/3" />
      <div className={`skeleton w-full ${variant === "full" ? "h-20" : "h-8"}`} />
    </div>
  );
}
