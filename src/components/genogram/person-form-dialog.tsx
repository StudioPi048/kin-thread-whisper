import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X, User } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { genogramGenderOptions } from "@/lib/genogram";
import { personLifeEvents, type LifeEvent } from "@/lib/patterns";
import type { Database } from "@/integrations/supabase/types";

type PersonRow = Database["public"]["Tables"]["genogram_persons"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  editing?: PersonRow | null;
  defaultPosition?: { x: number; y: number };
  defaultRelationship?: string;
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
  cause_of_death: string;
  health_conditions: string[];
  life_events: LifeEvent[];
  notes: string;
  relationship_to_proband: string;
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
  cause_of_death: "",
  health_conditions: [],
  life_events: [],
  notes: "",
  relationship_to_proband: "",
};

export function PersonFormDialog({
  open,
  onOpenChange,
  clientId,
  editing,
  defaultPosition,
  defaultRelationship,
}: Props) {
  const qc = useQueryClient();
  const [v, setV] = useState<FormState>(empty);
  const [conditionInput, setConditionInput] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventDesc, setEventDesc] = useState("");

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
        cause_of_death: editing.cause_of_death ?? "",
        health_conditions: editing.health_conditions ?? [],
        life_events: personLifeEvents(editing),
        notes: editing.notes ?? "",
        relationship_to_proband: editing.relationship_to_proband ?? "",
      });
    } else {
      setV({ ...empty, relationship_to_proband: defaultRelationship ?? "" });
    }
    setConditionInput("");
    setEventDate("");
    setEventType("");
    setEventDesc("");
  }, [open, editing, defaultRelationship]);

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
        cause_of_death: form.cause_of_death.trim() || null,
        health_conditions: form.health_conditions,
        life_events:
          form.life_events as unknown as Database["public"]["Tables"]["genogram_persons"]["Insert"]["life_events"],
        notes: form.notes.trim() || null,
        relationship_to_proband: form.relationship_to_proband.trim() || null,
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
      toast.success(editing ? "Dossiê salvo." : "Pessoa adicionada.");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function set<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((p) => ({ ...p, [k]: val }));
  }

  function addCondition() {
    const c = conditionInput.trim();
    if (!c) return;
    if (v.health_conditions.includes(c)) {
      setConditionInput("");
      return;
    }
    set("health_conditions", [...v.health_conditions, c]);
    setConditionInput("");
  }

  function removeCondition(c: string) {
    set(
      "health_conditions",
      v.health_conditions.filter((x) => x !== c),
    );
  }

  function addEvent() {
    if (!eventDate || !eventDesc.trim()) return;
    set("life_events", [
      ...v.life_events,
      { date: eventDate, type: eventType.trim() || undefined, description: eventDesc.trim() },
    ]);
    setEventDate("");
    setEventType("");
    setEventDesc("");
  }

  function removeEvent(i: number) {
    set(
      "life_events",
      v.life_events.filter((_, idx) => idx !== i),
    );
  }

  // Visual header: initials
  const initials = v.full_name
    ? v.full_name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "?";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Editorial width: sm:max-w-2xl */}
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:max-w-xl w-full border-l-0 shadow-2xl rounded-l-3xl overflow-hidden"
      >
        {/* Header Magazine Style */}
        <div className="bg-forest-soft px-8 py-10 relative shrink-0 border-b border-mahogany/10">
          <span className="section-number absolute right-4 top-4 opacity-5 text-mahogany">
            {initials}
          </span>
          <SheetHeader className="relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-serif font-bold text-mahogany shadow-sm">
                {initials}
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-mahogany/50">
                  Dossiê
                </p>
                <SheetTitle className="font-serif text-3xl font-bold text-mahogany">
                  {editing ? "Editar Dossiê" : "Nova Adição"}
                </SheetTitle>
              </div>
            </div>
            {!v.is_proband && v.relationship_to_proband && (
              <span className="mt-2 inline-block rounded-full bg-mahogany/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-mahogany">
                Contexto: {v.relationship_to_proband}
              </span>
            )}
            <SheetDescription className="mt-2 font-sans text-[13px] text-mahogany/70">
              Preencha os dados do {editing ? "dossiê selecionado" : "novo integrante da árvore"}.
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* Scrollable Form Body */}
        <ScrollArea className="flex-1 bg-background px-8 py-6">
          <form
            id="person-form"
            className="space-y-8 pb-8"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate(v);
            }}
          >
            {/* Identidade */}
            <div className="space-y-4">
              <h3 className="font-serif text-xl font-bold text-primary border-b border-border pb-2">
                Identidade
              </h3>
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
                          <span className="mr-2 font-serif font-bold text-forest">
                            {g.symbol}
                          </span>{" "}
                          {g.label}
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
                    placeholder="Ex.: professora, militar"
                  />
                </Field>
              </Row>
            </div>

            {/* Ciclo de vida */}
            <div className="space-y-4">
              <h3 className="font-serif text-xl font-bold text-primary border-b border-border pb-2">
                Ciclo de Vida
              </h3>
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

              <div className="flex items-center gap-6 mt-2 mb-4">
                <label className="flex items-center gap-2 text-[14px] font-medium cursor-pointer">
                  <Checkbox
                    checked={v.is_deceased}
                    onCheckedChange={(c) => set("is_deceased", c === true)}
                  />
                  Já faleceu
                </label>
                <label className="flex items-center gap-2 text-[14px] font-bold text-forest cursor-pointer">
                  <Checkbox
                    checked={v.is_proband}
                    onCheckedChange={(c) => set("is_proband", c === true)}
                  />
                  É o paciente-índice
                </label>
              </div>

              {(v.is_deceased || v.death_date) && (
                <Field label="Causa da morte" id="cause_of_death">
                  <Input
                    id="cause_of_death"
                    value={v.cause_of_death}
                    onChange={(e) => set("cause_of_death", e.target.value)}
                    placeholder="Ex.: câncer de mama, acidente, suicídio"
                  />
                </Field>
              )}
            </div>

            {/* Saúde e Padrões */}
            <div className="space-y-4">
              <h3 className="font-serif text-xl font-bold text-primary border-b border-border pb-2">
                Padrões & Histórico
              </h3>

              <Field label="Condições de saúde (física/mental)" id="health_conditions">
                <div className="flex gap-2">
                  <Input
                    id="health_conditions"
                    value={conditionInput}
                    onChange={(e) => setConditionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCondition();
                      }
                    }}
                    placeholder="Diabetes, luto, depressão... (Enter para adicionar)"
                  />
                  <Button type="button" variant="forest" size="icon" onClick={addCondition}>
                    <Plus className="size-4" />
                  </Button>
                </div>
                {v.health_conditions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {v.health_conditions.map((c) => (
                      <Badge
                        key={c}
                        variant="secondary"
                        className="gap-1.5 font-semibold text-[13px] bg-accent/50 px-2 py-1"
                      >
                        {c}
                        <button
                          type="button"
                          onClick={() => removeCondition(c)}
                          className="opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </Field>

              <Field label="Eventos biográficos marcantes" id="life_events">
                <div className="rounded-lg border-2 border-dashed border-border bg-card p-4">
                  <div className="grid gap-3 sm:grid-cols-[130px_1fr_auto]">
                    <Input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      aria-label="Data"
                    />
                    <Input
                      value={eventDesc}
                      onChange={(e) => setEventDesc(e.target.value)}
                      placeholder="Descrição (ex.: exílio, casamento, aborto)"
                      aria-label="Descrição"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={addEvent}>
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  {v.life_events.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {v.life_events
                        .slice()
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((ev, i) => (
                          <li
                            key={`${ev.date}-${i}`}
                            className="flex items-center gap-3 rounded-md border border-border/70 bg-background px-3 py-2 shadow-sm"
                          >
                            <span className="font-mono text-[12px] font-bold text-muted-foreground">
                              {ev.date}
                            </span>
                            <span className="flex-1 truncate text-[14px] font-medium">
                              {ev.description}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeEvent(i)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="size-4" />
                            </button>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </Field>

              <Field label="Anotações sistêmicas (Mitos, Segredos)" id="notes">
                <Textarea
                  id="notes"
                  rows={4}
                  value={v.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Segredos de família, padrões repetitivos, síndromes de aniversário, missões transgeracionais invisíveis..."
                  className="resize-none"
                />
              </Field>
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
          <Button
            type="submit"
            form="person-form"
            disabled={mutation.isPending}
            variant="forest"
            size="lg"
          >
            {mutation.isPending ? "Salvando..." : editing ? "Salvar dossiê" : "Adicionar à árvore"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2">{children}</div>;
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[13px] font-bold text-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
