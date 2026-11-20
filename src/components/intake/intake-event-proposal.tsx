import { useId, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { clinicalIntelQuery, getMappablePersons, invalidateCase } from "@/lib/clinical-intel";
import { formatByPrecision, precisionOf } from "@/lib/timeline";
import type { IntakeAnswerContext } from "@/lib/intake";

export type IntakeFinding = {
  field: string;
  label: string;
  text: string;
  context: IntakeAnswerContext;
};

export function IntakeEventProposal({
  clientId,
  finding,
  onClose,
}: {
  clientId: string;
  finding: IntakeFinding;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fieldId = useId();
  const people = useQuery(clinicalIntelQuery(clientId));
  const persons = useMemo(
    () => getMappablePersons(people.data?.persons ?? [], people.data?.relationships ?? []),
    [people.data],
  );
  const [recordId] = useState(() => crypto.randomUUID());
  const [personId, setPerson] = useState("");
  const [eventType, setEventType] = useState("");
  const [description, setDescription] = useState(finding.text);
  const [date, setDate] = useState("");
  const dateText = date.trim();
  const datePrecision = precisionOf(dateText);
  const validDate = !dateText || datePrecision !== "unknown";
  const selected = persons.find((person) => person.id === personId);

  const save = useMutation({
    mutationFn: async () => {
      if (!selected || !eventType.trim() || !description.trim() || !validDate) {
        throw new Error("Confira os campos antes de registrar o acontecimento.");
      }
      const { data: current, error: readError } = await supabase
        .from("genogram_persons")
        .select("life_events, updated_at")
        .eq("id", personId)
        .eq("client_id", clientId)
        .maybeSingle();
      if (readError || !current) throw new Error("O familiar está indisponível.");
      const existing = Array.isArray(current.life_events) ? current.life_events : [];
      if (
        existing.some(
          (event) =>
            event && typeof event === "object" && !Array.isArray(event) && event.id === recordId,
        )
      )
        return;
      const { data, error } = await supabase
        .from("genogram_persons")
        .update({
          life_events: [
            ...existing,
            {
              id: recordId,
              type: eventType.trim(),
              description: description.trim(),
              date: dateText,
              source: "intake",
              source_field: finding.field,
              source_label: finding.label,
              source_type: finding.context.source ?? "",
              source_note: finding.context.note?.trim() ?? "",
            },
          ],
        })
        .eq("id", personId)
        .eq("client_id", clientId)
        .eq("updated_at", current.updated_at)
        .select("id")
        .maybeSingle();
      if (error || !data)
        throw new Error("O registro não foi gravado. Confira a ficha e tente de novo.");
    },
    onSuccess: () => invalidateCase(qc, clientId),
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {save.isSuccess ? "Acontecimento registrado" : "Propor acontecimento da anamnese"}
          </DialogTitle>
          <DialogDescription>{finding.label}</DialogDescription>
        </DialogHeader>
        {save.isSuccess ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild className="min-h-11">
              <Link
                to="/app/clientes/$clientId"
                params={{ clientId }}
                search={{ tab: "timeline", event: recordId }}
                onClick={onClose}
              >
                Ver na linha do tempo
              </Link>
            </Button>
            <Button variant="outline" className="min-h-11" onClick={onClose}>
              Voltar à anamnese
            </Button>
          </div>
        ) : (
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <label className="grid gap-1.5 text-sm font-medium">
              Familiar
              <select
                required
                className="min-h-11 min-w-0 rounded-md border border-input bg-card px-3 text-base"
                value={personId}
                disabled={save.isPending || people.isLoading}
                onChange={(event) => setPerson(event.target.value)}
              >
                <option value="">
                  {people.isLoading ? "Carregando…" : "Selecione um familiar"}
                </option>
                {persons.map((person) => (
                  <option key={person.id} value={person.id}>
                    {[
                      person.full_name || person.preferred_name || "Pessoa sem nome",
                      person.relationship_to_proband,
                      person.birth_date?.slice(0, 4),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </option>
                ))}
              </select>
            </label>
            {people.isError && (
              <p role="alert" className="text-sm text-destructive">
                Não foi possível carregar os familiares.{" "}
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => people.refetch()}
                >
                  Tentar de novo
                </Button>
              </p>
            )}
            <label className="grid gap-1.5 text-sm font-medium">
              Nome do acontecimento
              <Input
                required
                value={eventType}
                maxLength={120}
                disabled={save.isPending}
                placeholder="Ex.: Mudança de cidade"
                onChange={(event) => setEventType(event.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Data informada (opcional)
              <Input
                value={date}
                aria-describedby={fieldId}
                aria-invalid={!validDate}
                maxLength={24}
                disabled={save.isPending}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <p id={fieldId} className="text-sm text-muted-foreground">
              {validDate && dateText
                ? formatByPrecision(dateText, datePrecision)
                : "Use AAAA-MM-DD, AAAA-MM, AAAA, DD/MM ou um intervalo como 1980–1985."}
            </p>
            <label className="grid gap-1.5 text-sm font-medium">
              O que foi relatado
              <Textarea
                required
                value={description}
                disabled={save.isPending}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
              />
            </label>
            {save.error && (
              <p role="alert" className="text-sm text-destructive">
                {save.error.message}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                className="min-h-11"
                disabled={
                  !selected ||
                  !eventType.trim() ||
                  !description.trim() ||
                  !validDate ||
                  save.isPending
                }
              >
                {save.isPending ? "Registrando…" : "Confirmar no dossiê"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={save.isPending}
                onClick={onClose}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
