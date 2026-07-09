import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Save, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import {
  INTAKE_SECTIONS,
  SECTION_FIELDS,
  calculateCompletion,
  type ChildEntry,
  type ClientIntake,
  type IntakeSectionId,
  type PartnerEntry,
  type SiblingEntry,
  type TattooEntry,
  type WorkEntry,
} from "@/lib/intake";

type Props = { clientId: string; professionalId: string };

const AUTOSAVE_MS = 1200;

export function IntakeForm({ clientId, professionalId }: Props) {
  const qc = useQueryClient();
  const [section, setSection] = useState<IntakeSectionId>("opening");
  const [draft, setDraft] = useState<Partial<ClientIntake>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const { data: intake, isLoading } = useQuery({
    queryKey: ["client-intake", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_intakes")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (intake) setDraft(intake);
  }, [intake]);

  const save = useMutation({
    mutationFn: async (patch: Partial<ClientIntake>) => {
      const payload = {
        client_id: clientId,
        professional_id: professionalId,
        ...draft,
        ...patch,
        last_section_edited: section,
        completion_percentage: calculateCompletion({ ...draft, ...patch }),
      };
      const { data, error } = await supabase
        .from("client_intakes")
        .upsert(payload, { onConflict: "client_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSavedAt(new Date());
      qc.setQueryData(["client-intake", clientId], data);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const scheduleSave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save.mutate({}), AUTOSAVE_MS);
  }, [save]);

  const update = useCallback(
    (patch: Partial<ClientIntake>) => {
      setDraft((prev) => ({ ...prev, ...patch }));
      scheduleSave();
    },
    [scheduleSave],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const completion = useMemo(() => calculateCompletion(draft), [draft]);
  const sectionCompletion = useMemo(() => {
    const fields = SECTION_FIELDS[section];
    const filled = fields.filter((f) => {
      const v = draft[f];
      if (v === null || v === undefined) return false;
      if (typeof v === "string") return v.trim().length > 0;
      if (Array.isArray(v)) return v.length > 0;
      return true;
    }).length;
    return Math.round((filled / fields.length) * 100);
  }, [draft, section]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Carregando anamnese…
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      {/* Sidebar */}
      <aside className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[14px] font-medium uppercase tracking-[0.28em] text-gold">
            Preenchimento total
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-serif text-3xl text-primary">{completion}%</span>
          </div>
          <Progress value={completion} className="mt-3 h-1.5" />
          <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
            {save.isPending ? (
              <>
                <Loader2 className="size-3 animate-spin" /> Salvando…
              </>
            ) : savedAt ? (
              <>
                <CheckCircle2 className="size-3 text-emerald-700" /> Salvo às{" "}
                {savedAt.toLocaleTimeString("pt-BR")}
              </>
            ) : (
              <>Salvamento automático ativo</>
            )}
          </p>
        </div>

        <nav className="rounded-lg border border-border bg-card p-2">
          {INTAKE_SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm transition ${
                section === s.id
                  ? "bg-lilac-soft text-primary font-medium"
                  : "text-foreground/80 hover:bg-lilac-soft/50 hover:text-primary"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="min-w-0 space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[14px] font-medium uppercase tracking-[0.28em] text-gold">
              Anamnese psicogenealógica
            </p>
            <h2 className="mt-1 font-serif text-2xl text-primary">
              {INTAKE_SECTIONS.find((s) => s.id === section)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{sectionCompletion}% desta seção</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => save.mutate({})}
              disabled={save.isPending}
            >
              <Save className="size-3.5" /> Salvar agora
            </Button>
          </div>
        </header>

        <div className="rounded-lg border border-border bg-card p-6">
          {section === "opening" && <SectionOpening draft={draft} update={update} />}
          {section === "personal" && <SectionPersonal draft={draft} update={update} />}
          {section === "relationships" && <SectionRelationships draft={draft} update={update} />}
          {section === "body" && <SectionBody draft={draft} update={update} />}
          {section === "origins" && <SectionOrigins draft={draft} update={update} />}
          {section === "subjective" && <SectionSubjective draft={draft} update={update} />}
          {section === "siblings" && <SectionSiblings draft={draft} update={update} />}
          {section === "professional" && <SectionProfessional draft={draft} update={update} />}
          {section === "clan_checklist" && <SectionClanChecklist draft={draft} update={update} />}
          {section === "clan_narratives" && <SectionClanNarratives draft={draft} update={update} />}
          {section === "additional" && <SectionAdditional draft={draft} update={update} />}
        </div>
      </div>
    </div>
  );
}

// ---- Field helpers ----

type SectionProps = {
  draft: Partial<ClientIntake>;
  update: (patch: Partial<ClientIntake>) => void;
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-foreground">{label}</Label>
      {children}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TextField(props: {
  label: string;
  field: keyof ClientIntake;
  draft: Partial<ClientIntake>;
  update: (p: Partial<ClientIntake>) => void;
  hint?: string;
  type?: string;
}) {
  const value = (props.draft[props.field] as string | number | null | undefined) ?? "";
  return (
    <Field label={props.label} hint={props.hint}>
      <Input
        type={props.type ?? "text"}
        value={value as string}
        onChange={(e) =>
          props.update({
            [props.field]:
              props.type === "number"
                ? e.target.value === ""
                  ? null
                  : Number(e.target.value)
                : e.target.value,
          } as Partial<ClientIntake>)
        }
      />
    </Field>
  );
}

function AreaField(props: {
  label: string;
  field: keyof ClientIntake;
  draft: Partial<ClientIntake>;
  update: (p: Partial<ClientIntake>) => void;
  hint?: string;
  rows?: number;
}) {
  const value = (props.draft[props.field] as string | null | undefined) ?? "";
  return (
    <Field label={props.label} hint={props.hint}>
      <Textarea
        rows={props.rows ?? 4}
        value={value}
        onChange={(e) => props.update({ [props.field]: e.target.value } as Partial<ClientIntake>)}
      />
    </Field>
  );
}

// ---- Sections ----

function SectionOpening({ draft, update }: SectionProps) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Registre o que o cliente traz como foco do atendimento. Este é o "quero olhar isso" — o
        ponto de partida da leitura psicogenealógica.
      </p>
      <AreaField
        label="Intenção do atendimento — o que ele(a) quer ser visto?"
        field="presenting_intention"
        rows={8}
        draft={draft}
        update={update}
        hint="Dores, desequilíbrios, temas recorrentes. Cada análise nasce de um objetivo claro."
      />
      <AreaField
        label="Observações sobre a grafia / assinatura"
        field="signature_notes"
        rows={3}
        draft={draft}
        update={update}
        hint="Traços marcantes, pressão, inclinação, legibilidade — insumo para a análise."
      />
    </div>
  );
}

function SectionPersonal({ draft, update }: SectionProps) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <TextField label="Nome completo" field="full_name" draft={draft} update={update} />
      <TextField label="Quem escolheu o nome" field="name_chooser" draft={draft} update={update} />
      <AreaField
        label="Intenção do nome"
        field="name_intention"
        rows={2}
        draft={draft}
        update={update}
      />
      <AreaField
        label="Repetição do nome no clã"
        field="name_repetition_in_family"
        rows={2}
        draft={draft}
        update={update}
      />
      <TextField
        label="Data, local e hora de nascimento"
        field="birth_datetime"
        type="datetime-local"
        draft={draft}
        update={update}
      />
      <TextField label="Local de nascimento" field="birth_place" draft={draft} update={update} />
      <Field label="Sexo">
        <Select value={(draft.gender as string) ?? ""} onValueChange={(v) => update({ gender: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Selecionar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="F">Feminino</SelectItem>
            <SelectItem value="M">Masculino</SelectItem>
            <SelectItem value="other">Outro</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <TextField label="Religião" field="religion" draft={draft} update={update} />
      <TextField label="Escolaridade" field="education" draft={draft} update={update} />
      <TextField label="Profissão" field="profession" draft={draft} update={update} />
      <TextField label="Etnia materna" field="ethnicity_maternal" draft={draft} update={update} />
      <TextField label="Etnia paterna" field="ethnicity_paternal" draft={draft} update={update} />
    </div>
  );
}

function SectionRelationships({ draft, update }: SectionProps) {
  const partners = (draft.partners as PartnerEntry[] | null) ?? [];
  const children = (draft.children as ChildEntry[] | null) ?? [];

  return (
    <div className="space-y-8">
      <div className="grid gap-5 md:grid-cols-3">
        <Field label="Estado civil">
          <Select
            value={(draft.civil_status as string) ?? ""}
            onValueChange={(v) => update({ civil_status: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Solteiro(a)</SelectItem>
              <SelectItem value="married">Casado(a)</SelectItem>
              <SelectItem value="stable_union">União estável</SelectItem>
              <SelectItem value="divorced">Divorciado(a)</SelectItem>
              <SelectItem value="widowed">Viúvo(a)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <TextField
          label="Data do casamento / marco"
          field="union_date"
          type="date"
          draft={draft}
          update={update}
        />
        <TextField
          label="Nº de relacionamentos / separações"
          field="relationships_count"
          type="number"
          draft={draft}
          update={update}
        />
      </div>

      <RepeatableList
        title="Parceiros(as)"
        emptyLabel="Sem parceiros registrados. Adicione cada relação, atual ou passada."
        items={partners}
        onChange={(next) => update({ partners: next as unknown as ClientIntake["partners"] })}
        blank={{}}
        renderRow={(row, patch) => (
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Nome"
              value={row.name ?? ""}
              onChange={(e) => patch({ name: e.target.value })}
            />
            <Input
              type="date"
              placeholder="Nascimento"
              value={row.birth_date ?? ""}
              onChange={(e) => patch({ birth_date: e.target.value })}
            />
            <Input
              type="date"
              placeholder="Data da união"
              value={row.union_date ?? ""}
              onChange={(e) => patch({ union_date: e.target.value })}
            />
            <Input
              type="date"
              placeholder="Data da separação"
              value={row.separation_date ?? ""}
              onChange={(e) => patch({ separation_date: e.target.value })}
            />
            <Textarea
              className="md:col-span-2"
              placeholder="Sobre ele(a): como é / como foi a relação"
              rows={2}
              value={row.description ?? ""}
              onChange={(e) => patch({ description: e.target.value })}
            />
            <Textarea
              className="md:col-span-2"
              placeholder="Causas da separação (se aplicável)"
              rows={2}
              value={row.causes ?? ""}
              onChange={(e) => patch({ causes: e.target.value })}
            />
          </div>
        )}
      />

      <RepeatableList
        title="Filhos"
        emptyLabel="Sem filhos registrados. Inclua também gestações abortadas."
        items={children}
        onChange={(next) => update({ children: next as unknown as ClientIntake["children"] })}
        blank={{}}
        renderRow={(row, patch) => (
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Nome"
              value={row.name ?? ""}
              onChange={(e) => patch({ name: e.target.value })}
            />
            <Input
              type="date"
              placeholder="Data de nascimento"
              value={row.birth_date ?? ""}
              onChange={(e) => patch({ birth_date: e.target.value })}
            />
            <Input
              placeholder="Ordem gestacional (1º, 2º…)"
              value={row.gestational_order ?? ""}
              onChange={(e) => patch({ gestational_order: e.target.value })}
            />
            <Input
              placeholder="Semanas gestacionais"
              value={row.gestational_weeks ?? ""}
              onChange={(e) => patch({ gestational_weeks: e.target.value })}
            />
            <Input
              type="date"
              placeholder="Data da morte (se aplicável)"
              value={row.death_date ?? ""}
              onChange={(e) => patch({ death_date: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!row.aborted} onCheckedChange={(v) => patch({ aborted: !!v })} />
              Gestação abortada
            </label>
            <Textarea
              className="md:col-span-2"
              placeholder="Como é a relação com ele(a)?"
              rows={2}
              value={row.relationship_notes ?? ""}
              onChange={(e) => patch({ relationship_notes: e.target.value })}
            />
          </div>
        )}
      />
    </div>
  );
}

function SectionBody({ draft, update }: SectionProps) {
  const tattoos = (draft.tattoos as TattooEntry[] | null) ?? [];
  return (
    <div className="space-y-6">
      <RepeatableList
        title="Tatuagens"
        emptyLabel="Sem tatuagens registradas."
        items={tattoos}
        onChange={(next) => update({ tattoos: next as unknown as ClientIntake["tattoos"] })}
        blank={{}}
        renderRow={(row, patch) => (
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Local do corpo"
              value={row.location ?? ""}
              onChange={(e) => patch({ location: e.target.value })}
            />
            <Input
              placeholder="Lado (esq/dir)"
              value={row.side ?? ""}
              onChange={(e) => patch({ side: e.target.value })}
            />
            <Input
              type="date"
              placeholder="Quando"
              value={row.date ?? ""}
              onChange={(e) => patch({ date: e.target.value })}
            />
            <Input
              placeholder="URL da foto (opcional)"
              value={row.photo_url ?? ""}
              onChange={(e) => patch({ photo_url: e.target.value })}
            />
            <Textarea
              className="md:col-span-2"
              rows={2}
              placeholder="Significado / contexto"
              value={row.meaning ?? ""}
              onChange={(e) => patch({ meaning: e.target.value })}
            />
          </div>
        )}
      />
      <AreaField
        label="Pintas / manchas grandes"
        field="moles_notes"
        draft={draft}
        update={update}
        rows={3}
        hint="Local, e se há similar em outro membro da família."
      />
      <AreaField
        label="Cicatrizes"
        field="scars_notes"
        draft={draft}
        update={update}
        rows={3}
        hint="Onde, quando, em qual contexto."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Alargador (quando colocou)"
          field="ear_stretcher"
          draft={draft}
          update={update}
        />
        <TextField
          label="Piercing (quando colocou)"
          field="piercings"
          draft={draft}
          update={update}
        />
      </div>
      <AreaField
        label="Falta de membros"
        field="missing_limbs"
        draft={draft}
        update={update}
        rows={2}
      />
      <AreaField
        label="Membros supranumerários ou de lateralidade invertida"
        field="extra_or_inverted_limbs"
        draft={draft}
        update={update}
        rows={2}
      />
    </div>
  );
}

function SectionOrigins({ draft, update }: SectionProps) {
  return (
    <div className="space-y-5">
      <AreaField
        label="Concepção — programada? notícia no clã?"
        field="conception_notes"
        draft={draft}
        update={update}
        rows={4}
      />
      <AreaField
        label="Gestação — preocupações, notícias impactantes, doenças, quedas"
        field="pregnancy_notes"
        draft={draft}
        update={update}
        rows={4}
      />
      <AreaField
        label="Parto — tipo, duração, complicações"
        field="birth_notes"
        draft={draft}
        update={update}
        rows={4}
      />

      <div className="mt-4 rounded-md border border-lilac-soft bg-lilac-soft/40 p-4">
        <p className="text-[14px] font-medium uppercase tracking-[0.28em] text-gold mb-3">
          Condições dos pais na gestação
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <AreaField
            label="Financeiro — mãe"
            field="parents_financial_mother"
            rows={2}
            draft={draft}
            update={update}
          />
          <AreaField
            label="Financeiro — pai"
            field="parents_financial_father"
            rows={2}
            draft={draft}
            update={update}
          />
          <AreaField
            label="Emocional — mãe"
            field="parents_emotional_mother"
            rows={2}
            draft={draft}
            update={update}
          />
          <AreaField
            label="Emocional — pai"
            field="parents_emotional_father"
            rows={2}
            draft={draft}
            update={update}
          />
          <AreaField
            label="Profissional — mãe"
            field="parents_professional_mother"
            rows={2}
            draft={draft}
            update={update}
          />
          <AreaField
            label="Profissional — pai"
            field="parents_professional_father"
            rows={2}
            draft={draft}
            update={update}
          />
        </div>
      </div>

      <AreaField
        label="Contexto histórico / social no nascimento"
        field="historical_context_at_birth"
        draft={draft}
        update={update}
        rows={4}
        hint="Fato marcante no clã, cidade ou país."
      />
    </div>
  );
}

function SectionSubjective({ draft, update }: SectionProps) {
  return (
    <div className="space-y-5">
      <AreaField
        label="Missão de vida (primeiro pensamento)"
        field="life_mission"
        draft={draft}
        update={update}
        rows={4}
      />
      <AreaField
        label="Traumas de infância"
        field="childhood_traumas"
        draft={draft}
        update={update}
        rows={5}
      />
      <AreaField
        label="Profissão dos sonhos na infância"
        field="childhood_dream_profession"
        draft={draft}
        update={update}
        rows={3}
      />
      <AreaField
        label="Padrões que não gosta em si"
        field="disliked_patterns"
        draft={draft}
        update={update}
        rows={4}
      />
    </div>
  );
}

function SectionSiblings({ draft, update }: SectionProps) {
  const siblings = (draft.siblings as SiblingEntry[] | null) ?? [];
  return (
    <div className="space-y-6">
      <AreaField
        label="Como foi/é a relação com os irmãos"
        field="siblings_relationship"
        draft={draft}
        update={update}
        rows={3}
      />
      <RepeatableList
        title="Irmãos"
        emptyLabel="Sem irmãos registrados."
        items={siblings}
        onChange={(next) => update({ siblings: next as unknown as ClientIntake["siblings"] })}
        blank={{}}
        renderRow={(row, patch) => (
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Nome"
              value={row.name ?? ""}
              onChange={(e) => patch({ name: e.target.value })}
            />
            <Input
              placeholder="Ordem de nascimento"
              value={row.birth_order ?? ""}
              onChange={(e) => patch({ birth_order: e.target.value })}
            />
            <Input
              type="date"
              placeholder="Nascimento"
              value={row.birth_date ?? ""}
              onChange={(e) => patch({ birth_date: e.target.value })}
            />
            <Input
              type="date"
              placeholder="Morte (se aplicável)"
              value={row.death_date ?? ""}
              onChange={(e) => patch({ death_date: e.target.value })}
            />
            <Textarea
              className="md:col-span-2"
              rows={2}
              placeholder="Características"
              value={row.characteristics ?? ""}
              onChange={(e) => patch({ characteristics: e.target.value })}
            />
          </div>
        )}
      />
      <AreaField
        label="Falecimentos de irmãos antes/depois do cliente (inclusive abortos e natimortos)"
        field="siblings_deaths_notes"
        draft={draft}
        update={update}
        rows={4}
      />
      <AreaField
        label="Falecimentos precoces / abortos de irmãos dos pais"
        field="parents_siblings_deaths"
        draft={draft}
        update={update}
        rows={4}
      />
      <AreaField
        label="Relação com os pais — segurança, apoio nas decisões"
        field="parents_relationship"
        draft={draft}
        update={update}
        rows={4}
      />
      <AreaField
        label="Eventos marcantes no ambiente escolar"
        field="school_events"
        draft={draft}
        update={update}
        rows={4}
      />
      <AreaField
        label="Abortos do(a) cliente — quantos e em que idades"
        field="own_abortions"
        draft={draft}
        update={update}
        rows={3}
      />
      <AreaField
        label="Enfermidades e acidentes — breve relato com idades"
        field="own_illnesses"
        draft={draft}
        update={update}
        rows={5}
      />
    </div>
  );
}

function SectionProfessional({ draft, update }: SectionProps) {
  const work = (draft.work_history as WorkEntry[] | null) ?? [];
  return (
    <div className="space-y-6">
      <RepeatableList
        title="Histórico profissional"
        emptyLabel="Sem cargos registrados."
        items={work}
        onChange={(next) =>
          update({ work_history: next as unknown as ClientIntake["work_history"] })
        }
        blank={{}}
        renderRow={(row, patch) => (
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Cargo"
              value={row.role ?? ""}
              onChange={(e) => patch({ role: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={row.start_date ?? ""}
                onChange={(e) => patch({ start_date: e.target.value })}
              />
              <Input
                type="date"
                value={row.end_date ?? ""}
                onChange={(e) => patch({ end_date: e.target.value })}
              />
            </div>
            <Textarea
              className="md:col-span-2"
              rows={2}
              placeholder="Como foi trabalhar aí?"
              value={row.experience ?? ""}
              onChange={(e) => patch({ experience: e.target.value })}
            />
          </div>
        )}
      />
      <AreaField
        label="Formação acadêmica (seja específico)"
        field="formal_education"
        draft={draft}
        update={update}
        rows={3}
      />
      <Field label="A formação foi escolha do próprio cliente?">
        <Select
          value={
            draft.education_chosen_by_self === null || draft.education_chosen_by_self === undefined
              ? ""
              : draft.education_chosen_by_self
                ? "yes"
                : "no"
          }
          onValueChange={(v) => update({ education_chosen_by_self: v === "" ? null : v === "yes" })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecionar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Sim</SelectItem>
            <SelectItem value="no">Não</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <AreaField
        label="Perspectiva futura"
        field="future_perspective"
        draft={draft}
        update={update}
        rows={6}
        hint="Vida laboral, após aposentadoria, viagens, esportes, estudos…"
      />
    </div>
  );
}

const CLAN_ITEMS: { field: keyof ClientIntake; label: string }[] = [
  { field: "clan_homicides", label: "Homicídios" },
  { field: "clan_suicides", label: "Suicídios" },
  { field: "clan_alcoholism", label: "Alcoolismo" },
  { field: "clan_chemical_dependency", label: "Dependência química" },
  { field: "clan_mental_illness", label: "Doença / deficiência mental" },
  { field: "clan_physical_disability", label: "Deficiência física" },
  { field: "clan_epilepsy", label: "Epilepsia" },
  { field: "clan_autism", label: "Autismo" },
  { field: "clan_respiratory", label: "Doenças respiratórias" },
  { field: "clan_cardiovascular", label: "Doenças cardiovasculares" },
  { field: "clan_surgeries", label: "Cirurgias" },
  { field: "clan_car_accidents", label: "Acidentes de carro" },
  { field: "clan_cancer", label: "Câncer" },
  { field: "clan_stroke", label: "AVC" },
  { field: "clan_incest", label: "Incestos" },
  { field: "clan_migrants", label: "Migrantes" },
  { field: "clan_homosexuality", label: "Homossexualidade" },
];

function SectionClanChecklist({ draft, update }: SectionProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Para cada item, indique o(s) membro(s) portador(es). Depois, aponte-os no genograma.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {CLAN_ITEMS.map((it) => (
          <AreaField
            key={it.field}
            label={it.label}
            field={it.field}
            draft={draft}
            update={update}
            rows={2}
          />
        ))}
      </div>
      <AreaField
        label="Outras observações"
        field="clan_other_observations"
        draft={draft}
        update={update}
        rows={4}
      />
    </div>
  );
}

function SectionClanNarratives({ draft, update }: SectionProps) {
  return (
    <div className="space-y-5">
      <AreaField
        label="Eventos importantes ocorridos ou contados na família"
        field="clan_important_events"
        draft={draft}
        update={update}
        rows={6}
        hint="Guerras, perseguições, migrações, mortes traumáticas, disputas de herança, síndromes, infertilidade…"
      />
      <AreaField
        label="Ligações — aproximação, intensidade, afastamento, ódio, repúdio"
        field="clan_bonds_ruptures"
        draft={draft}
        update={update}
        rows={6}
        hint="Casamentos entre primos, histórias de amor marcantes, ressentimentos, parentes afastados."
      />
      <AreaField
        label="Histórias contadas repetidamente / através de gerações"
        field="clan_repeated_stories"
        draft={draft}
        update={update}
        rows={5}
      />
      <AreaField
        label="Segredos — o que se sabe, supõe ou intui que não é comentado"
        field="clan_secrets"
        draft={draft}
        update={update}
        rows={6}
        hint="Mesmo intuições. Anote o primitivo que emerge."
      />
    </div>
  );
}

function SectionAdditional({ draft, update }: SectionProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <AreaField
          label="Brincadeiras preferidas na infância"
          field="favorite_childhood_games"
          draft={draft}
          update={update}
          rows={3}
        />
        <AreaField
          label="Medos na infância"
          field="childhood_fears"
          draft={draft}
          update={update}
          rows={3}
        />
        <AreaField
          label="Sonhos / pesadelos reiterados"
          field="recurring_dreams"
          draft={draft}
          update={update}
          rows={3}
        />
        <AreaField
          label="Contos de fada / histórias marcantes"
          field="marking_fairy_tales"
          draft={draft}
          update={update}
          rows={3}
        />
        <TextField
          label="Agenesia de dente (qual?)"
          field="dental_agenesis"
          draft={draft}
          update={update}
        />
        <TextField
          label="Canal em algum dente (qual?)"
          field="dental_root_canal"
          draft={draft}
          update={update}
        />
        <AreaField
          label="Herança cultural materna"
          field="cultural_heritage_maternal"
          draft={draft}
          update={update}
          rows={4}
        />
        <AreaField
          label="Herança cultural paterna"
          field="cultural_heritage_paternal"
          draft={draft}
          update={update}
          rows={4}
        />
      </div>

      <div className="rounded-md border border-lilac-soft bg-lilac-soft/40 p-4">
        <p className="text-[14px] font-medium uppercase tracking-[0.28em] text-gold mb-3">
          Átomo social
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <AreaField
            label="Objeto marcante (nome e significado)"
            field="social_atom_object"
            draft={draft}
            update={update}
            rows={2}
          />
          <AreaField
            label="Livro marcante"
            field="social_atom_book"
            draft={draft}
            update={update}
            rows={2}
          />
          <AreaField
            label="Animal de estimação"
            field="social_atom_pet"
            draft={draft}
            update={update}
            rows={2}
          />
          <AreaField
            label="Momento histórico marcante"
            field="social_atom_historic_moment"
            draft={draft}
            update={update}
            rows={2}
          />
          <AreaField
            label="Música que marcou"
            field="social_atom_music"
            draft={draft}
            update={update}
            rows={2}
          />
          <AreaField
            label="Pessoas mais próximas"
            field="social_atom_close_people"
            draft={draft}
            update={update}
            rows={2}
          />
          <AreaField
            label="Símbolos, ideias, ideologias importantes"
            field="social_atom_symbols"
            draft={draft}
            update={update}
            rows={2}
          />
          <AreaField
            label="Outras memórias do clã"
            field="social_atom_other"
            draft={draft}
            update={update}
            rows={2}
          />
        </div>
      </div>
    </div>
  );
}

// ---- Repeatable list ----

function RepeatableList<T extends object>({
  title,
  emptyLabel,
  items,
  onChange,
  blank,
  renderRow,
}: {
  title: string;
  emptyLabel: string;
  items: T[];
  onChange: (next: T[]) => void;
  blank: T;
  renderRow: (row: T, patch: (p: Partial<T>) => void) => React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-medium uppercase tracking-[0.28em] text-gold">{title}</p>
        <Button size="sm" variant="outline" onClick={() => onChange([...items, { ...blank }])}>
          <Plus className="size-3.5" /> Adicionar
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm italic text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((row, i) => (
            <div key={i} className="rounded-md border border-border bg-background/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">#{i + 1}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-3.5" /> Remover
                </Button>
              </div>
              {renderRow(row, (patch) => {
                const next = [...items];
                next[i] = { ...row, ...patch };
                onChange(next);
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
