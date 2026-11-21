import { useId, useState } from "react";
import { Clock3, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { relationshipQualifiers } from "@/lib/genogram";
import {
  parentageSources,
  type ParentageSource,
  historyLinks,
  type ParentageHistoryEntry,
} from "@/lib/parentage-review";

function LinkList({
  links,
  nameFor,
}: {
  links: ParentageHistoryEntry["after_links"];
  nameFor: (id: string) => string;
}) {
  const items = historyLinks(links);
  if (!items.length) return <span className="text-muted-foreground">Sem filiação registrada.</span>;
  return (
    <ul className="space-y-1">
      {items.map((link) => (
        <li key={link.id}>
          {nameFor(link.from_person_id)}
          <span className="text-muted-foreground">
            {" · "}
            {relationshipQualifiers.parent.find(({ value }) => value === link.qualifier)?.label ??
              "Natureza por confirmar"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ParentageHistory({
  entries,
  loading,
  error,
  onRetry,
  onShowAll,
  more,
  undoableId,
  pending,
  onUndo,
  nameFor,
  currentUserId,
}: {
  entries: readonly ParentageHistoryEntry[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onShowAll: () => void;
  more: boolean;
  undoableId?: string;
  pending: boolean;
  onUndo: (id: string) => void;
  nameFor: (id: string) => string;
  currentUserId?: string;
}) {
  const headingId = useId();
  const [confirmUndo, setConfirmUndo] = useState<string | null>(null);
  const displayDate = (value: string) =>
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(value),
    );
  return (
    <section className="geno-parentage-history" aria-labelledby={headingId}>
      <h3 id={headingId} className="flex items-center gap-2 font-semibold">
        <Clock3 className="size-4" aria-hidden /> Histórico de filiação
      </h3>
      {loading && <p role="status">Carregando revisões…</p>}
      {error && (
        <p role="alert">
          Não foi possível carregar o histórico.{" "}
          <Button size="sm" variant="outline" onClick={onRetry}>
            Tentar novamente
          </Button>
        </p>
      )}
      {!loading && !error && entries.length === 0 && (
        <p>Nenhuma revisão registrada para esta pessoa.</p>
      )}
      {entries.length > 0 && (
        <ol>
          {entries.map((entry) => {
            const reverted = entries.find(({ id }) => id === entry.undone_review_id);
            const decision =
              entry.decision === "undo"
                ? "Filiação restaurada"
                : entry.workbook_import
                  ? "Filiação importada do Excel"
                  : entry.decision === "edit"
                    ? "Filiação alterada"
                    : "Filiação confirmada";
            const source = Object.hasOwn(parentageSources, entry.source)
              ? parentageSources[entry.source as ParentageSource]
              : parentageSources.unverified;
            return (
              <li key={entry.id}>
                <details>
                  <summary>
                    <strong>{decision}</strong>
                    <time dateTime={entry.created_at}>{displayDate(entry.created_at)}</time>
                  </summary>
                  <div className="geno-parentage-history-change">
                    <div>
                      <strong>Antes</strong>
                      <LinkList links={entry.before_links} nameFor={nameFor} />
                    </div>
                    <div>
                      <strong>Depois</strong>
                      <LinkList links={entry.after_links} nameFor={nameFor} />
                    </div>
                  </div>
                  <p>
                    {entry.professional_id === currentUserId ? "Você" : "Profissional responsável"}
                    {" · "}
                    {source}
                    {entry.note && <> · {entry.note}</>}
                  </p>
                  {entry.imported_review_created_at && (
                    <p>
                      Revisão de origem em{" "}
                      <time dateTime={entry.imported_review_created_at}>
                        {displayDate(entry.imported_review_created_at)}
                      </time>
                    </p>
                  )}
                  {reverted && <p>Restaura a revisão de {displayDate(reverted.created_at)}.</p>}
                </details>
                {entry.id === undoableId && (
                  <div className="flex flex-wrap gap-2 px-2 pb-2">
                    <Button
                      size="sm"
                      variant={confirmUndo === entry.id ? "forest" : "outline"}
                      disabled={pending}
                      onClick={() => {
                        if (confirmUndo !== entry.id) setConfirmUndo(entry.id);
                        else onUndo(entry.id);
                      }}
                    >
                      <Undo2 className="size-4" aria-hidden />
                      {pending
                        ? "Restaurando…"
                        : confirmUndo === entry.id
                          ? "Restaurar filiação anterior"
                          : "Desfazer última revisão"}
                    </Button>
                    {confirmUndo === entry.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => setConfirmUndo(null)}
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {more && (
        <Button size="sm" variant="ghost" onClick={onShowAll}>
          Mostrar revisões anteriores
        </Button>
      )}
    </section>
  );
}
