import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2 } from "lucide-react";

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  persons: PersonRow[];
  editing?: RelRow | null;
  seed?: { from?: string; to?: string };
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
}: Props) {
  const qc = useQueryClient();
  const [v, setV] = useState<FormState>(empty);

  useEffect(() => {
    if (!open) return;
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
      setV({ ...empty, from_person_id: seed?.from ?? "", to_person_id: seed?.to ?? "" });
    }
  }, [open, editing, seed]);

  const qualifierOptions = useMemo(
    () => relationshipQualifiers[v.relationship_type] ?? [],
    [v.relationship_type],
  );

  const mutation = useMutation({
    mutationFn: async (form: FormState) => {
      if (!form.from_person_id || !form.to_person_id) throw new Error("Escolha as duas pessoas");
      if (form.from_person_id === form.to_person_id) throw new Error("Escolha pessoas diferentes");
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
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("genogram_relationships").insert(payload);
        if (error) throw error;
      }
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["genogram", clientId] });
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

  const fromHint = v.relationship_type === "parent" ? "Pai/mãe" : "Pessoa A";
  const toHint = v.relationship_type === "parent" ? "Filho(a)" : "Pessoa B";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:max-w-lg w-full border-l-[5px] border-l-gold"
      >
        {/* Header Magazine Style */}
        <div className="bg-plum px-8 py-10 relative overflow-hidden shrink-0">
          <span className="section-number absolute right-4 top-4 opacity-10 text-white">∞</span>
          <SheetHeader className="relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-gold text-2xl font-bold text-plum shadow-md">
                <Link2 className="size-8" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-gold">
                  Conexão
                </p>
                <SheetTitle className="font-serif text-3xl font-bold text-white mt-1">
                  {editing ? "Editar vínculo" : "Novo vínculo"}
                </SheetTitle>
              </div>
            </div>
            <SheetDescription className="text-white/60 text-[14px]">
              Vínculos entrelaçam os dados. Registre parentalidade, uniões, rupturas ou
              aproximações.
            </SheetDescription>
          </SheetHeader>
        </div>

        <ScrollArea className="flex-1 bg-background px-8 py-6">
          <form
            id="rel-form"
            className="space-y-6 pb-8"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate(v);
            }}
          >
            <div className="space-y-2">
              <Label className="text-[13px] font-bold text-foreground">Natureza da relação</Label>
              <Select
                value={v.relationship_type}
                onValueChange={(x) =>
                  setV((p) => ({ ...p, relationship_type: x as RelationshipType, qualifier: "" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {relationshipTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="font-bold">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-5 border-l-2 border-dashed border-border pl-4 ml-2">
              <div className="space-y-2 relative">
                <div className="absolute -left-[23px] top-4 size-2.5 rounded-full bg-border" />
                <Label className="text-[13px] font-bold text-foreground">{fromHint}</Label>
                <Select
                  value={v.from_person_id}
                  onValueChange={(x) => setV((p) => ({ ...p, from_person_id: x }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {persons.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.preferred_name || p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 relative">
                <div className="absolute -left-[23px] top-4 size-2.5 rounded-full bg-border" />
                <Label className="text-[13px] font-bold text-foreground">{toHint}</Label>
                <Select
                  value={v.to_person_id}
                  onValueChange={(x) => setV((p) => ({ ...p, to_person_id: x }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {persons.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.preferred_name || p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {qualifierOptions.length > 0 && (
              <div className="space-y-2 pt-2">
                <Label className="text-[13px] font-bold text-foreground">
                  Intensidade / Qualificador
                </Label>
                <Select
                  value={v.qualifier || undefined}
                  onValueChange={(x) => setV((p) => ({ ...p, qualifier: x }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
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
                <Label className="text-[13px] font-bold text-foreground">Ordem desta união</Label>
                <Select
                  value={v.marriage_order || "none"}
                  onValueChange={(x) =>
                    setV((p) => ({ ...p, marriage_order: x === "none" ? "" : x }))
                  }
                >
                  <SelectTrigger>
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
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Use quando a pessoa teve mais de um casamento — aparece como ①/②/③ na linha do
                  casal para diferenciar cônjuges.
                </p>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <Label className="text-[13px] font-bold text-foreground">Anotações sistêmicas</Label>
              <Textarea
                rows={4}
                value={v.notes}
                onChange={(e) => setV((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Contexto clínico deste vínculo, datas de início/fim, observações de tensão ou alienação..."
                className="resize-none"
              />
            </div>
          </form>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-border bg-card px-8 py-5 shrink-0 flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" form="rel-form" disabled={mutation.isPending} variant="gold">
            {mutation.isPending ? "Salvando..." : editing ? "Salvar vínculo" : "Criar conexão"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
