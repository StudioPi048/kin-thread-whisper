import { invalidateCase } from "@/lib/clinical-intel";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownUp } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { relationshipQualifiers, relationshipTypes, type RelationshipType } from "@/lib/genogram";
import type { Database } from "@/integrations/supabase/types";

type PersonRow = Database["public"]["Tables"]["genogram_persons"]["Row"];
type RelRow = Database["public"]["Tables"]["genogram_relationships"]["Row"];

export type ProposedParentageLink = { parentId: string; kind: string; note: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  persons: PersonRow[];
  editing?: RelRow | null;
  seed?: { from?: string; to?: string; type?: RelationshipType; qualifier?: string };
  onReviewParentage: (childId: string, seed: ProposedParentageLink) => void;
}

interface FormState {
  from_person_id: string;
  to_person_id: string;
  relationship_type: RelationshipType;
  qualifier: string;
  marriage_order: string; // "" | "1" | "2" | "3" | "4" | "5"
  notes: string;
}

const empty: FormState = {
  from_person_id: "",
  to_person_id: "",
  relationship_type: "union",
  qualifier: "",
  marriage_order: "",
  notes: "",
};

export function RelationshipFormDialog({
  open,
  onOpenChange,
  clientId,
  persons,
  editing,
  seed,
  onReviewParentage,
}: Props) {
  const qc = useQueryClient();
  const [v, setV] = useState<FormState>(empty);
  const [confirmRemoval, setConfirmRemoval] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirmRemoval(false);
    if (editing) {
      const rec = editing as RelRow & { marriage_order?: number | null };
      setV({
        from_person_id: editing.from_person_id,
        to_person_id: editing.to_person_id,
        relationship_type: editing.relationship_type as RelationshipType,
        qualifier: editing.qualifier ?? "",
        marriage_order: rec.marriage_order ? String(rec.marriage_order) : "",
        notes: editing.notes ?? "",
      });
    } else {
      setV({
        ...empty,
        from_person_id: seed?.from ?? "",
        to_person_id: seed?.to ?? "",
        relationship_type: seed?.type ?? empty.relationship_type,
        qualifier: seed?.qualifier ?? "",
      });
    }
  }, [open, editing, seed]);

  const qualifierOptions = useMemo(
    () =>
      v.relationship_type === "parent"
        ? [...relationshipQualifiers.parent, { value: "unknown", label: "Por confirmar" }]
        : (relationshipQualifiers[v.relationship_type] ?? []),
    [v.relationship_type],
  );

  const mutation = useMutation({
    mutationFn: async (form: FormState) => {
      if (!form.from_person_id || !form.to_person_id) throw new Error("Escolha as duas pessoas");
      if (form.from_person_id === form.to_person_id) throw new Error("Escolha pessoas diferentes");
      if (
        !persons.some((person) => person.id === form.from_person_id) ||
        !persons.some((person) => person.id === form.to_person_id)
      ) {
        throw new Error("Escolha duas pessoas cadastradas neste caso.");
      }
      if (form.relationship_type === "parent" || editing?.relationship_type === "parent")
        throw new Error("Abra a revisão de filiação para alterar este vínculo.");
      const marriageOrder =
        form.relationship_type === "union" && form.marriage_order
          ? Number(form.marriage_order)
          : null;

      // Pre-check: bloquear união duplicada com mesma ordem para o mesmo par.
      if (form.relationship_type === "union") {
        const { data: existing, error: checkErr } = await supabase
          .from("genogram_relationships")
          .select("id, from_person_id, to_person_id, marriage_order")
          .eq("client_id", clientId)
          .eq("relationship_type", "union");
        if (checkErr) throw checkErr;
        const pair = [form.from_person_id, form.to_person_id].sort().join("|");
        const clash = (existing ?? []).find((r) => {
          if (editing && r.id === editing.id) return false;
          const other = [r.from_person_id, r.to_person_id].sort().join("|");
          if (other !== pair) return false;
          return (r.marriage_order ?? null) === marriageOrder;
        });
        if (clash) {
          throw new Error(
            marriageOrder
              ? `Já existe uma união de ordem ${marriageOrder} entre essas duas pessoas.`
              : "Já existe uma união entre essas duas pessoas. Defina uma ordem (①, ②...) para diferenciar.",
          );
        }
      }

      const payload = {
        client_id: clientId,
        from_person_id: form.from_person_id,
        to_person_id: form.to_person_id,
        relationship_type: form.relationship_type,
        qualifier: form.qualifier || null,
        marriage_order: marriageOrder,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        const { error } = await supabase
          .from("genogram_relationships")
          .update(payload)
          .eq("id", editing.id)
          .eq("client_id", clientId)
          .neq("relationship_type", "parent");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("genogram_relationships").insert(payload);
        if (error) throw error;
      }
    },

    onSuccess: async () => {
      await invalidateCase(qc, clientId);
      toast.success(editing ? "Vínculo salvo." : "Vínculo criado na árvore.");
      onOpenChange(false);
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Erro";
      // Postgres unique_violation (23505) — fallback amigável caso o pré-check não pegue.
      if (/genogram_rel_union_unique_pair_order|duplicate key/i.test(msg)) {
        toast.error("União duplicada: já existe um vínculo com essa mesma ordem entre esse par.");
      } else {
        toast.error(msg);
      }
    },
  });

  const removal = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      if (editing.relationship_type === "parent")
        throw new Error("Abra a revisão de filiação para remover este vínculo.");
      const { error } = await supabase
        .from("genogram_relationships")
        .delete()
        .eq("client_id", clientId)
        .neq("relationship_type", "parent")
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateCase(qc, clientId);
      toast.success("Vínculo removido.");
      onOpenChange(false);
    },
    onError: () => toast.error("Não foi possível remover o vínculo. Tente novamente."),
  });

  const isParentLink = v.relationship_type === "parent";
  const fromHint = isParentLink ? "Pai, mãe ou responsável" : "Primeira pessoa";
  const toHint = isParentLink ? "Filho ou filha" : "Segunda pessoa";
  const pending = mutation.isPending || removal.isPending;

  const personLabel = (person?: PersonRow) =>
    [
      person?.full_name || person?.preferred_name || "Pessoa indisponível",
      person?.relationship_to_proband,
      person?.birth_date?.slice(0, 4),
    ]
      .filter(Boolean)
      .join(" · ");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-lg w-full">
        <SheetHeader className="shrink-0 border-b border-border px-5 py-5 pr-14 sm:px-7 sm:pr-14">
          <SheetTitle className="text-xl">
            {editing ? "Editar vínculo" : isParentLink ? "Definir filiação" : "Novo vínculo"}
          </SheetTitle>
          <SheetDescription>
            {isParentLink
              ? "Escolha as duas pessoas e confira a direção antes de abrir a revisão no mapa."
              : "Escolha se deseja registrar uma filiação, união, irmandade ou vínculo afetivo."}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0 bg-background px-5 py-5 sm:px-7">
          <form
            id="rel-form"
            className="space-y-6 pb-8"
            onSubmit={(e) => {
              e.preventDefault();
              if (isParentLink && !editing) {
                if (!v.from_person_id || !v.to_person_id || !v.qualifier) return;
                if (v.from_person_id === v.to_person_id) {
                  toast.error("Escolha duas pessoas diferentes.");
                  return;
                }
                onReviewParentage(v.to_person_id, {
                  parentId: v.from_person_id,
                  kind: v.qualifier,
                  note: v.notes,
                });
                onOpenChange(false);
                return;
              }
              mutation.mutate(v);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="geno-rel-type">Tipo de vínculo</Label>
              <Select
                value={v.relationship_type}
                onValueChange={(x) =>
                  setV((p) => ({ ...p, relationship_type: x as RelationshipType, qualifier: "" }))
                }
              >
                <SelectTrigger id="geno-rel-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {relationshipTypes
                    .filter(({ value }) => !editing || value !== "parent")
                    .map((t) => (
                      <SelectItem key={t.value} value={t.value} className="font-bold">
                        {t.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="geno-rel-from">{fromHint}</Label>
                <Select
                  value={v.from_person_id}
                  onValueChange={(x) => setV((p) => ({ ...p, from_person_id: x }))}
                >
                  <SelectTrigger id="geno-rel-from">
                    <SelectValue placeholder="Selecionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    {persons.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {personLabel(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="geno-rel-to">{toHint}</Label>
                <Select
                  value={v.to_person_id}
                  onValueChange={(x) => setV((p) => ({ ...p, to_person_id: x }))}
                >
                  <SelectTrigger id="geno-rel-to">
                    <SelectValue placeholder="Selecionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    {persons.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {personLabel(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isParentLink && v.from_person_id && v.to_person_id && (
              <div className="space-y-2 rounded-md border border-border bg-card p-3">
                <p className="text-sm">
                  <strong>{personLabel(persons.find(({ id }) => id === v.from_person_id))}</strong>{" "}
                  como genitor de{" "}
                  <strong>{personLabel(persons.find(({ id }) => id === v.to_person_id))}</strong>
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  disabled={pending}
                  onClick={() =>
                    setV((state) => ({
                      ...state,
                      from_person_id: state.to_person_id,
                      to_person_id: state.from_person_id,
                    }))
                  }
                >
                  <ArrowDownUp className="size-4" /> Inverter direção da filiação
                </Button>
              </div>
            )}

            {qualifierOptions.length > 0 && (
              <div className="space-y-2 pt-2">
                <Label htmlFor="geno-rel-qualifier">
                  {isParentLink ? "Natureza da filiação" : "Detalhe do vínculo"}
                </Label>
                <Select
                  value={v.qualifier || undefined}
                  onValueChange={(x) => setV((p) => ({ ...p, qualifier: x }))}
                >
                  <SelectTrigger id="geno-rel-qualifier">
                    <SelectValue placeholder={isParentLink ? "Selecionar…" : "Opcional"} />
                  </SelectTrigger>
                  <SelectContent>
                    {qualifierOptions.map((q) => (
                      <SelectItem key={q.value} value={q.value}>
                        {q.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {v.relationship_type === "union" && (
              <div className="space-y-2 pt-2">
                <Label htmlFor="geno-rel-order">Ordem desta união</Label>
                <Select
                  value={v.marriage_order || "none"}
                  onValueChange={(x) =>
                    setV((p) => ({ ...p, marriage_order: x === "none" ? "" : x }))
                  }
                >
                  <SelectTrigger id="geno-rel-order">
                    <SelectValue placeholder="União única" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">União única (padrão)</SelectItem>
                    <SelectItem value="1">① Primeira união</SelectItem>
                    <SelectItem value="2">② Segunda união</SelectItem>
                    <SelectItem value="3">③ Terceira união</SelectItem>
                    <SelectItem value="4">④ Quarta união</SelectItem>
                    <SelectItem value="5">⑤ Quinta união</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[14px] text-muted-foreground leading-snug">
                  Use quando a pessoa teve mais de um casamento — aparece como ①/②/③ na linha do
                  casal para diferenciar cônjuges.
                </p>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <Label htmlFor="geno-rel-notes">Origem e observações</Label>
              <Textarea
                id="geno-rel-notes"
                rows={3}
                value={v.notes}
                onChange={(e) => setV((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Ex.: relato da família, documento ou data da confirmação"
                className="resize-none"
              />
            </div>
          </form>
        </ScrollArea>

        {confirmRemoval && (
          <div className="border-t border-border px-5 py-3 text-sm text-foreground" role="alert">
            Remover este vínculo registrado? As pessoas continuam cadastradas. Confira também o
            parentesco da planilha, que pode sugerir novamente uma ligação.
          </div>
        )}
        <SheetFooter className="border-t border-border bg-card px-5 py-4 sm:px-7">
          {editing && (
            <Button
              type="button"
              variant={confirmRemoval ? "destructive" : "ghost"}
              className="mr-auto"
              disabled={pending}
              onClick={() => (confirmRemoval ? removal.mutate() : setConfirmRemoval(true))}
            >
              {removal.isPending
                ? "Removendo…"
                : confirmRemoval
                  ? "Confirmar remoção"
                  : "Remover vínculo"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => (confirmRemoval ? setConfirmRemoval(false) : onOpenChange(false))}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="rel-form"
            variant="forest"
            disabled={
              pending ||
              confirmRemoval ||
              !v.from_person_id ||
              !v.to_person_id ||
              (isParentLink && !v.qualifier)
            }
          >
            {isParentLink ? "Revisar no mapa" : mutation.isPending ? "Salvando…" : "Salvar vínculo"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
