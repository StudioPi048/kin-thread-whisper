import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { genogramGenderOptions } from "@/lib/genogram";
import type { Database } from "@/integrations/supabase/types";

type PersonRow = Database["public"]["Tables"]["genogram_persons"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  editing?: PersonRow | null;
  /** Posição sugerida no canvas para novos nós. */
  defaultPosition?: { x: number; y: number };
}

interface FormState {
  full_name: string;
  preferred_name: string;
  gender: string;
  birth_date: string;
  death_date: string;
  is_deceased: boolean;
  is_proband: boolean;
  occupation: string;
  notes: string;
}

const empty: FormState = {
  full_name: "",
  preferred_name: "",
  gender: "desconhecido",
  birth_date: "",
  death_date: "",
  is_deceased: false,
  is_proband: false,
  occupation: "",
  notes: "",
};

export function PersonFormDialog({
  open,
  onOpenChange,
  clientId,
  editing,
  defaultPosition,
}: Props) {
  const qc = useQueryClient();
  const [v, setV] = useState<FormState>(empty);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setV({
        full_name: editing.full_name,
        preferred_name: editing.preferred_name ?? "",
        gender: editing.gender ?? "desconhecido",
        birth_date: editing.birth_date ?? "",
        death_date: editing.death_date ?? "",
        is_deceased: editing.is_deceased,
        is_proband: editing.is_proband,
        occupation: editing.occupation ?? "",
        notes: editing.notes ?? "",
      });
    } else {
      setV(empty);
    }
  }, [open, editing]);

  const mutation = useMutation({
    mutationFn: async (form: FormState) => {
      if (!form.full_name.trim()) throw new Error("Nome é obrigatório");
      const payload = {
        client_id: clientId,
        full_name: form.full_name.trim(),
        preferred_name: form.preferred_name.trim() || null,
        gender: form.gender || null,
        birth_date: form.birth_date || null,
        death_date: form.death_date || null,
        is_deceased: form.is_deceased || Boolean(form.death_date),
        is_proband: form.is_proband,
        occupation: form.occupation.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        const { error } = await supabase
          .from("genogram_persons")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("genogram_persons").insert({
          ...payload,
          position_x: defaultPosition?.x ?? 0,
          position_y: defaultPosition?.y ?? 0,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["genogram", clientId] });
      toast.success(editing ? "Pessoa atualizada." : "Pessoa adicionada.");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function set<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((p) => ({ ...p, [k]: val }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-primary">
            {editing ? "Editar pessoa" : "Nova pessoa"}
          </DialogTitle>
          <DialogDescription>
            Membro do sistema familiar. Toda edição fica registrada no dossiê.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(v);
          }}
        >
          <Row>
            <Field label="Nome completo *" id="full_name">
              <Input
                id="full_name"
                required
                autoFocus
                value={v.full_name}
                onChange={(e) => set("full_name", e.target.value)}
              />
            </Field>
            <Field label="Apelido" id="preferred_name">
              <Input
                id="preferred_name"
                value={v.preferred_name}
                onChange={(e) => set("preferred_name", e.target.value)}
              />
            </Field>
          </Row>

          <Row>
            <Field label="Gênero" id="gender">
              <Select value={v.gender} onValueChange={(x) => set("gender", x)}>
                <SelectTrigger id="gender">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {genogramGenderOptions.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      <span className="mr-2 font-serif">{g.symbol}</span> {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Ocupação" id="occupation">
              <Input
                id="occupation"
                value={v.occupation}
                onChange={(e) => set("occupation", e.target.value)}
              />
            </Field>
          </Row>

          <Row>
            <Field label="Nascimento" id="birth_date">
              <Input
                id="birth_date"
                type="date"
                value={v.birth_date}
                onChange={(e) => set("birth_date", e.target.value)}
              />
            </Field>
            <Field label="Falecimento" id="death_date">
              <Input
                id="death_date"
                type="date"
                value={v.death_date}
                onChange={(e) => set("death_date", e.target.value)}
              />
            </Field>
          </Row>

          <Field label="Notas" id="notes">
            <Textarea
              id="notes"
              rows={3}
              value={v.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Segredos, padrões, síndromes de aniversário, missões transgeracionais..."
            />
          </Field>

          <div className="space-y-2 rounded-lg border border-border bg-parchment/40 p-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={v.is_proband}
                onCheckedChange={(c) => set("is_proband", c === true)}
              />
              É o paciente-índice (proband)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={v.is_deceased}
                onCheckedChange={(c) => set("is_deceased", c === true)}
              />
              Já faleceu
            </label>
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
              {mutation.isPending ? "Salvando..." : editing ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
