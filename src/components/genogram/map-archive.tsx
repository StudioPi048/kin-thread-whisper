import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { invalidateCase } from "@/lib/clinical-intel";
import { formatDateBR, relationshipLabel } from "@/lib/genogram";
import { readCasePages } from "@/lib/read-case-pages";
import { editGenogram } from "./genogram-integrity";

type Person = Tables<"genogram_persons">;
type Link = Tables<"genogram_relationships">;

const displayName = (person?: Person) =>
  person?.full_name.trim() || person?.preferred_name?.trim() || "Pessoa indisponível";
const dates = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function MapArchive({
  open,
  onOpenChange,
  clientId,
  people,
  archivedPeople,
  small,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  people: readonly Person[];
  archivedPeople: readonly Person[];
  small: boolean;
}) {
  const qc = useQueryClient();
  const removed = useQuery({
    queryKey: ["genogram-removed-relationships", clientId],
    enabled: open,
    queryFn: async () => {
      const rows = await readCasePages(
        (after, limit) => {
          const page = supabase
            .from("genogram_removed_relationships")
            .select("id, client_id, snapshot, removed_at, restored_at")
            .eq("client_id", clientId)
            .is("restored_at", null)
            .order("id")
            .limit(limit);
          return after ? page.gt("id", after) : page;
        },
        (entry) => entry.id,
      );
      return rows.sort((first, second) => second.removed_at.localeCompare(first.removed_at));
    },
  });
  const restorePerson = useMutation({
    mutationFn: (person: Person) =>
      editGenogram("set_genogram_person_archived", {
        _client_id: clientId,
        _person_id: person.id,
        _expected: person.updated_at,
        _archived: false,
      }),
    onSuccess: async () => {
      await invalidateCase(qc, clientId);
      toast.success("Familiar restaurado no mapa.");
    },
    onError: async () => invalidateCase(qc, clientId),
  });
  const restoreLink = useMutation({
    mutationFn: (id: string) =>
      editGenogram("undo_genogram_relationship_removal", {
        _client_id: clientId,
        _removal_id: id,
      }),
    onSuccess: async () => {
      await invalidateCase(qc, clientId);
      toast.success("Vínculo restaurado no mapa.");
    },
    onError: async () => invalidateCase(qc, clientId),
  });
  const pending = restorePerson.isPending || restoreLink.isPending;
  const fault = restorePerson.error ?? restoreLink.error;
  const byId = new Map([...people, ...archivedPeople].map((person) => [person.id, person]));

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) {
          restorePerson.reset();
          restoreLink.reset();
        }
        onOpenChange(next);
      }}
    >
      <SheetContent
        side={small ? "bottom" : "right"}
        className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-h-none sm:max-w-lg"
      >
        <SheetHeader className="shrink-0 border-b px-5 py-5 pr-12 text-left">
          <SheetTitle>Arquivo do mapa</SheetTitle>
          <SheetDescription>
            Restaure familiares arquivados e vínculos removidos deste genossociograma.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-5">
          {fault && (
            <p
              role="alert"
              className="rounded border border-clinical-critical/30 p-3 text-sm text-destructive"
            >
              {fault.message}
            </p>
          )}
          <section aria-labelledby="geno-archive-people">
            <h3 id="geno-archive-people" className="font-semibold text-forest">
              Familiares arquivados
            </h3>
            {archivedPeople.length ? (
              <ul className="mt-2 divide-y border-y">
                {[...archivedPeople]
                  .sort((a, b) => displayName(a).localeCompare(displayName(b), "pt-BR"))
                  .map((person) => (
                    <li
                      key={person.id}
                      className="flex flex-wrap items-start justify-between gap-2 py-3"
                    >
                      <div className="min-w-0 [overflow-wrap:anywhere]">
                        <strong className="block text-sm">{displayName(person)}</strong>
                        {person.relationship_to_proband && (
                          <p className="text-sm text-muted-foreground">
                            {person.relationship_to_proband}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        disabled={pending}
                        onClick={() => {
                          restoreLink.reset();
                          restorePerson.mutate(person);
                        }}
                      >
                        <ArchiveRestore className="size-4" aria-hidden />
                        {restorePerson.isPending && restorePerson.variables.id === person.id
                          ? "Restaurando…"
                          : "Restaurar familiar"}
                      </Button>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Nenhum familiar arquivado.</p>
            )}
          </section>
          <section aria-labelledby="geno-archive-links">
            <h3 id="geno-archive-links" className="font-semibold text-forest">
              Vínculos removidos
            </h3>
            {removed.isPending ? (
              <p role="status" className="mt-2 text-sm">
                Carregando vínculos…
              </p>
            ) : removed.isError ? (
              <div className="mt-2 space-y-2">
                <p role="alert" className="text-sm text-destructive">
                  Não foi possível carregar os vínculos removidos.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void removed.refetch()}
                >
                  Recarregar vínculos
                </Button>
              </div>
            ) : removed.data.length ? (
              <ul className="mt-2 divide-y border-y">
                {removed.data.map((entry) => {
                  const link = entry.snapshot as unknown as Link;
                  const first = byId.get(link.from_person_id);
                  const second = byId.get(link.to_person_id);
                  const unavailable = !first || !second;
                  const archived = first?.archived_at || second?.archived_at;
                  const variant = [
                    relationshipLabel(link.relationship_type, link.qualifier),
                    link.marriage_order && `União ${link.marriage_order}`,
                    formatDateBR(link.start_date),
                    link.end_date && `até ${formatDateBR(link.end_date)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li key={entry.id} className="space-y-2 py-3 text-sm [overflow-wrap:anywhere]">
                      <div>
                        <strong className="block">
                          {displayName(first)} · {displayName(second)}
                        </strong>
                        <p className="text-muted-foreground">{variant}</p>
                        <p className="text-muted-foreground">
                          Removido em {dates.format(new Date(entry.removed_at))}
                        </p>
                      </div>
                      {unavailable ? (
                        <p>Uma das fichas está indisponível.</p>
                      ) : archived ? (
                        <p>Restaure o familiar arquivado para desfazer a remoção.</p>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        disabled={pending || unavailable || !!archived}
                        onClick={() => {
                          restorePerson.reset();
                          restoreLink.mutate(entry.id);
                        }}
                      >
                        <Undo2 className="size-4" aria-hidden />
                        {restoreLink.isPending && restoreLink.variables === entry.id
                          ? "Restaurando…"
                          : "Desfazer remoção"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhum vínculo removido para restaurar.
              </p>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
