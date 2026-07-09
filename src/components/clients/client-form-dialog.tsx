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
import {
  clientFormSchema,
  genderOptions,
  parseTags,
  type ClientFormValues,
  type GenderValue,
} from "@/lib/clients";
import type { Database } from "@/integrations/supabase/types";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionalId: string;
  editing?: ClientRow | null;
}

const emptyValues: ClientFormValues = {
  full_name: "",
  preferred_name: "",
  birth_date: "",
  gender: "",
  birthplace: "",
  phone: "",
  email: "",
  presenting_complaint: "",
  clinical_notes: "",
  tags_input: "",
  consent_given: false,
  consent_notes: "",
};

export function ClientFormDialog({ open, onOpenChange, professionalId, editing }: Props) {
  const qc = useQueryClient();
  const [values, setValues] = useState<ClientFormValues>(emptyValues);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setValues({
        full_name: editing.full_name ?? "",
        preferred_name: editing.preferred_name ?? "",
        birth_date: editing.birth_date ?? "",
        gender: (editing.gender as GenderValue | null) ?? "",
        birthplace: editing.birthplace ?? "",
        phone: editing.phone ?? "",
        email: editing.email ?? "",
        presenting_complaint: editing.presenting_complaint ?? "",
        clinical_notes: editing.clinical_notes ?? "",
        tags_input: (editing.tags ?? []).join(", "),
        consent_given: Boolean(editing.consent_given_at),
        consent_notes: editing.consent_notes ?? "",
      });
    } else {
      setValues(emptyValues);
    }
  }, [open, editing]);

  const mutation = useMutation({
    mutationFn: async (v: ClientFormValues) => {
      const parsed = clientFormSchema.parse(v);
      const payload = {
        professional_id: professionalId,
        full_name: parsed.full_name,
        preferred_name: parsed.preferred_name || null,
        birth_date: parsed.birth_date || null,
        gender: parsed.gender || null,
        birthplace: parsed.birthplace || null,
        phone: parsed.phone || null,
        email: parsed.email || null,
        presenting_complaint: parsed.presenting_complaint || null,
        clinical_notes: parsed.clinical_notes || null,
        tags: parseTags(parsed.tags_input),
        consent_given_at: parsed.consent_given
          ? (editing?.consent_given_at ?? new Date().toISOString())
          : null,
        consent_notes: parsed.consent_notes || null,
      };
      if (editing) {
        const { data, error } = await supabase
          .from("clients")
          .update(payload)
          .eq("id", editing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from("clients").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client"] });
      toast.success(editing ? "Dossiê atualizado." : "Cliente cadastrado.");
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar cliente");
    },
  });

  function set<K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-primary">
            {editing ? "Editar dossiê" : "Novo cliente"}
          </DialogTitle>
          <DialogDescription>
            Registro clínico protegido. Todos os campos podem ser editados a qualquer momento.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-6 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(values);
          }}
        >
          <section className="space-y-4">
            <SectionLabel>Identidade</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome completo *" htmlFor="full_name">
                <Input
                  id="full_name"
                  value={values.full_name}
                  onChange={(e) => set("full_name", e.target.value)}
                  required
                  autoFocus
                />
              </Field>
              <Field label="Como prefere ser chamado(a)" htmlFor="preferred_name">
                <Input
                  id="preferred_name"
                  value={values.preferred_name}
                  onChange={(e) => set("preferred_name", e.target.value)}
                />
              </Field>
              <Field label="Data de nascimento" htmlFor="birth_date">
                <Input
                  id="birth_date"
                  type="date"
                  value={values.birth_date}
                  onChange={(e) => set("birth_date", e.target.value)}
                />
              </Field>
              <Field label="Gênero" htmlFor="gender">
                <Select
                  value={values.gender || undefined}
                  onValueChange={(v) => set("gender", v as GenderValue)}
                >
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {genderOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Local de nascimento" htmlFor="birthplace" className="sm:col-span-2">
                <Input
                  id="birthplace"
                  value={values.birthplace}
                  onChange={(e) => set("birthplace", e.target.value)}
                  placeholder="Cidade, estado, país"
                />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <SectionLabel>Contato</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Telefone" htmlFor="phone">
                <Input
                  id="phone"
                  value={values.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+55 ..."
                />
              </Field>
              <Field label="E-mail" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  value={values.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <SectionLabel>Clínico</SectionLabel>
            <Field label="Queixa apresentada" htmlFor="presenting_complaint">
              <Textarea
                id="presenting_complaint"
                value={values.presenting_complaint}
                onChange={(e) => set("presenting_complaint", e.target.value)}
                rows={3}
                placeholder="O que trouxe essa pessoa até você?"
              />
            </Field>
            <Field label="Notas iniciais" htmlFor="clinical_notes">
              <Textarea
                id="clinical_notes"
                value={values.clinical_notes}
                onChange={(e) => set("clinical_notes", e.target.value)}
                rows={4}
                placeholder="Contexto, observações, hipóteses iniciais..."
              />
            </Field>
            <Field label="Tags" htmlFor="tags_input">
              <Input
                id="tags_input"
                value={values.tags_input}
                onChange={(e) => set("tags_input", e.target.value)}
                placeholder="luto, síndrome-aniversário, ruptura-afetiva"
              />
              <p className="mt-1.5 text-sm text-muted-foreground">Separe por vírgula.</p>
            </Field>
          </section>

          <section className="rounded-lg border border-border bg-parchment/40 p-4">
            <SectionLabel>Consentimento (LGPD)</SectionLabel>
            <label className="mt-3 flex items-start gap-3">
              <Checkbox
                id="consent_given"
                checked={values.consent_given}
                onCheckedChange={(c) => set("consent_given", c === true)}
              />
              <span className="text-sm leading-relaxed text-foreground">
                Cliente autorizou o registro de dados clínicos nesta plataforma, ciente do sigilo
                profissional e das disposições da LGPD.
              </span>
            </label>
            <div className="mt-4">
              <Field label="Observações do consentimento" htmlFor="consent_notes">
                <Input
                  id="consent_notes"
                  value={values.consent_notes}
                  onChange={(e) => set("consent_notes", e.target.value)}
                  placeholder="Como e quando foi obtido"
                />
              </Field>
            </div>
          </section>

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
              {mutation.isPending ? "Salvando..." : editing ? "Salvar alterações" : "Criar dossiê"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[14px] font-medium uppercase tracking-[0.28em] text-gold">{children}</p>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={"space-y-1.5 " + (className ?? "")}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
