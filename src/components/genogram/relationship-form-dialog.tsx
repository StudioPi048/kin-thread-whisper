import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { supabase } from "@/integrations/supabase/client";
import {
  relationshipQualifiers,
  relationshipTypes,
  type RelationshipType,
} from "@/lib/genogram";
import type { Database } from "@/integrations/supabase/types";

type PersonRow = Database["public"]["Tables"]["genogram_persons"]["Row"];
type RelRow = Database["public"]["Tables"]["genogram_relationships"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  persons: PersonRow[];
  editing?: RelRow | null;
  /** Pré-seleciona pessoas quando criado via drag & drop no canvas. */
  seed?: { from?: string; to?: string };
}

interface FormState {
  from_person_id: string;
  to_person_id: string;
  relationship_type: RelationshipType;
  qualifier: string;
  notes: string;
}

const empty: FormState = {
  from_person_id: "",
  to_person_id: "",
  relationship_type: "union",
  qualifier: "",
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
      setV({
        from_person_id: editing.from_person_id,
        to_person_id: editing.to_person_id,
        relationship_type: editing.relationship_type as RelationshipType,
        qualifier: editing.qualifier ?? "",
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
      if (form.from_person_id === form.to_person_id)
        throw new Error("Escolha pessoas diferentes");
      const payload = {
        client_id: clientId,
        from_person_id: form.from_person_id,
        to_person_id: form.to_person_id,
        relationship_type: form.relationship_type,
        qualifier: form.qualifier || null,
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
      toast.success(editing ? "Relação atualizada." : "Relação criada.");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const fromHint =
    v.relationship_type === "parent" ? "Pai/mãe" : "Pessoa A";
  const toHint = v.relationship_type === "parent" ? "Filho(a)" : "Pessoa B";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-primary">
            {editing ? "Editar relação" : "Nova relação"}
          </DialogTitle>
          <DialogDescription>
            Padrões vinculares: parentalidade, uniões, irmandade e vínculos emocionais.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(v);
          }}
        >
          <div className="space-y-1.5">
            <Label>Tipo</Label>
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
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{fromHint}</Label>
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
            <div className="space-y-1.5">
              <Label>{toHint}</Label>
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
            <div className="space-y-1.5">
              <Label>Qualificador</Label>
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

          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea
              rows={2}
              value={v.notes}
              onChange={(e) => setV((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Contexto do vínculo, datas, observações clínicas..."
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : editing ? "Salvar" : "Criar vínculo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
