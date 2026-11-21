import { IntakeEventProposal, type IntakeFinding } from "./intake-event-proposal";
import { IntakeConflictReview } from "./intake-conflict-review";
import { useUnsaved } from "@/components/unsaved/unsaved-guard";
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2, CheckCircle2 } from "lucide-react";

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
import { KeyedDebounce } from "@/lib/unsaved";
import {
  INTAKE_SECTIONS,
  SECTION_FIELDS,
  INTAKE_QUESTION_LABELS,
  INTAKE_ANSWER_STATUS,
  INTAKE_ANSWER_SOURCE,
  INTAKE_SECTION_SOURCE,
  answerContext,
  findIntakeQuestions,
  isIntakeSection,
  intakeBirthTimeInput,
  intakeBirthTimeStorage,
  type IntakeContextKey,
  calculateCompletion,
  sectionCompletion as calcSectionCompletion,
  INTAKE_UNKNOWN,
  type ChildEntry,
  type ClientIntake,
  type IntakeSectionId,
  type PartnerEntry,
  type SiblingEntry,
  type TattooEntry,
  type WorkEntry,
} from "@/lib/intake";
import {
  acknowledgeIntakeEdits,
  captureIntakeEdits,
  intakePatch,
  persistIntakeEdits,
  type IntakeConflicts,
  type IntakeEdits,
  type IntakeFields,
} from "./intake-save";

type Props = { clientId: string; professionalId: string; focusQuestion?: string };
const IntakeContext = createContext<{
  draft: Partial<ClientIntake>;
  update: (field: keyof ClientIntake, key: IntakeContextKey, value: string | null) => void;
  propose: (finding: IntakeFinding) => void;
} | null>(null);

const AUTOSAVE_MS = 1200;

export function IntakeForm(props: Props) {
  return <CaseIntakeForm key={`${props.professionalId}:${props.clientId}`} {...props} />;
}

function CaseIntakeForm({ clientId, professionalId, focusQuestion }: Props) {
  const qc = useQueryClient();
  const linkedField = Object.keys(INTAKE_QUESTION_LABELS).find(
    (field) => field === focusQuestion,
  ) as keyof ClientIntake | undefined;
  const linkedSection = linkedField
    ? INTAKE_SECTIONS.find(({ id }) => SECTION_FIELDS[id].includes(linkedField))?.id
    : undefined;
  const [activeSection, setSection] = useState<IntakeSectionId | undefined>(linkedSection);
  const [activeMode, setMode] = useState<"brief" | "full" | undefined>(
    linkedField ? "full" : undefined,
  );
  const [search, setSearch] = useState("");
  const [withoutSource, setWithoutSource] = useState(false);
  const [finding, setFinding] = useState<IntakeFinding>();
  const [focusRequest, setFocusRequest] = useState<{ field?: keyof ClientIntake } | undefined>(
    linkedField ? { field: linkedField } : undefined,
  );
  const formRef = useRef<HTMLDivElement>(null);
  const sectionTitleRef = useRef<HTMLHeadingElement>(null);
  const [pending, setPending] = useState<IntakeEdits>({});
  const pendingRef = useRef<IntakeEdits>({});
  const replacePending = (edits: IntakeEdits) => {
    pendingRef.current = edits;
    setPending(edits);
  };
  const [conflicts, setConflicts] = useState<IntakeConflicts>({});
  const revision = useRef(0);
  const persistedRevision = useRef(0);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const queryKey = ["client-intake", professionalId, clientId] as const;
  const readIntake = async () => {
    const { data, error } = await supabase
      .from("client_intakes")
      .select("*")
      .eq("client_id", clientId)
      .eq("professional_id", professionalId)
      .maybeSingle();
    if (error) throw error;
    return data;
  };
  const intakeQuery = useQuery({ queryKey, queryFn: readIntake });
  const intake = intakeQuery.data;
  const draft = useMemo(() => ({ ...intake, ...intakePatch(intake, pending) }), [intake, pending]);
  const hasPending = Object.keys(pending).length > 0;
  const canSave = Object.keys(pending).some((key) => !conflicts[key]);
  const conflictCount = Object.keys(conflicts).length;
  const mode = activeMode ?? (intake ? "full" : "brief");
  const section =
    activeSection ??
    (isIntakeSection(intake?.last_section_edited) ? intake.last_section_edited : "opening");
  const results = useMemo(() => {
    const matches = findIntakeQuestions(search, withoutSource ? draft : undefined);
    return withoutSource ? matches : matches.slice(0, 10);
  }, [draft, search, withoutSource]);

  useEffect(() => {
    if (!linkedField || !linkedSection) return;
    setMode("full");
    setSection(linkedSection);
    setFocusRequest({ field: linkedField });
  }, [linkedField, linkedSection]);

  useEffect(() => {
    if (!focusRequest) return;
    const field = focusRequest.field
      ? formRef.current?.querySelector<HTMLElement>(`[data-intake-field="${focusRequest.field}"]`)
      : undefined;
    const control = field?.querySelector<HTMLElement>(
      "input, textarea, select, button[role=combobox]",
    );
    const target = field ?? sectionTitleRef.current;
    target?.scrollIntoView({ block: "nearest" });
    (control ?? target)?.focus({ preventScroll: true });
  }, [focusRequest, intakeQuery.isLoading]);

  const save = useMutation({
    mutationFn: (edits: IntakeEdits) =>
      persistIntakeEdits(
        {
          read: readIntake,
          insert: async (patch) => {
            const { data, error } = await supabase
              .from("client_intakes")
              .insert({ ...patch, client_id: clientId, professional_id: professionalId })
              .select()
              .single();
            if (error?.code === "23505") return null;
            if (error) throw error;
            return data;
          },
          update: async (patch, previous) => {
            const { data, error } = await supabase
              .from("client_intakes")
              .update(patch)
              .eq("client_id", clientId)
              .eq("professional_id", professionalId)
              .eq("updated_at", previous.updated_at)
              .select()
              .maybeSingle();
            if (error) throw error;
            return data;
          },
        },
        edits,
      ),
    onSuccess: async ({ row, accepted, conflicts: foundConflicts, wrote }) => {
      // A read started before the write could otherwise restore the older cache.
      await qc.cancelQueries({ queryKey, exact: true });
      qc.setQueryData<ClientIntake | null>(queryKey, (cached) =>
        cached && row && cached.updated_at > row.updated_at ? cached : row,
      );
      replacePending(acknowledgeIntakeEdits(pendingRef.current, accepted, row));
      setConflicts(foundConflicts);
      if (wrote) {
        persistedRevision.current++;
        setSavedAt(new Date());
      }
    },
  });
  const mutate = useRef(save.mutateAsync);
  mutate.current = save.mutateAsync;
  const [queue] = useState(
    () =>
      new KeyedDebounce<{ pending: true }>(async () => {
        // Captura o rascunho com a versão já confirmada pelo envio anterior.
        const edits = pendingRef.current;
        if (Object.keys(edits).length) await mutate.current(edits);
      }, AUTOSAVE_MS),
  );

  useUnsaved(`intake:${clientId}`, {
    label: "Anamnese",
    isDirty: () => Object.keys(pendingRef.current).length > 0 || queue.hasPending(),
    save: async () => {
      await queue.flush();
      if (Object.keys(pendingRef.current).length)
        throw new Error("Resolva as alterações feitas em outra aba antes de sair.");
    },
    discard: async () => {
      const confirmed = persistedRevision.current;
      await queue.discardAndWait();
      replacePending({});
      setConflicts({});
      save.reset();
      if (persistedRevision.current > confirmed)
        toast.info(
          "O envio em andamento da Anamnese foi confirmado. As outras alterações foram descartadas.",
        );
    },
  });
  useEffect(() => () => queue.discard(), [queue]);

  const update = (patch: Parameters<typeof captureIntakeEdits>[0], field?: keyof ClientIntake) => {
    if (activeMode === undefined) setMode(mode);
    const lastField = field ?? Object.keys(patch).find((key) => !key.includes(":"));
    const lastSection =
      mode === "brief"
        ? lastField && ["clan_important_events", "clan_bonds_ruptures"].includes(lastField)
          ? "clan_narratives"
          : "opening"
        : section;
    const current = pendingRef.current;
    const edits = captureIntakeEdits(
      { ...patch, last_section_edited: lastSection, last_field_edited: lastField },
      ++revision.current,
      intake,
      current,
    );
    replacePending({ ...current, ...edits });
    queue.push("intake", { pending: true });
  };

  const resolve = (key: string, keepDraft: boolean) => {
    const conflict = conflicts[key];
    const current = { ...pendingRef.current };
    if (!conflict || !current[key]) return;
    if (keepDraft) current[key] = { ...current[key], expected: conflict.current };
    else delete current[key];
    replacePending(current);
    setConflicts((previous) => {
      const remaining = { ...previous };
      delete remaining[key];
      return remaining;
    });
    if (keepDraft) {
      queue.push("intake", { pending: true });
      void queue.flush().catch(() => {});
    }
  };

  const completion = calculateCompletion(draft);
  const { filled, total } = calcSectionCompletion(draft, section);
  const sectionCompletion = Math.round((filled / total) * 100);
  const selectQuestion = (next: IntakeSectionId, field?: keyof ClientIntake) => {
    setMode("full");
    setSection(next);
    setSearch("");
    setFocusRequest({ field });
  };
  const lastQuestion = intake?.last_field_edited
    ? (Object.keys(INTAKE_QUESTION_LABELS).find((field) => field === intake.last_field_edited) as
        keyof ClientIntake | undefined)
    : undefined;

  if (intakeQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Carregando anamnese…
      </div>
    );
  }

  if (intakeQuery.isError && intake === undefined) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4"
      >
        <p className="text-clinical-critical">Não foi possível carregar a anamnese.</p>
        <Button variant="outline" className="min-h-11" onClick={() => void intakeQuery.refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  return (
    <div className="dossier-intake">
      <header className="dossier-intake-head">
        <div className="dossier-intake-mode">
          <h2>Anamnese</h2>
          <div role="group" aria-label="Modo da anamnese" className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              aria-pressed={mode === "brief"}
              className="min-h-11"
              variant={mode === "brief" ? "forest" : "ghost"}
              onClick={() => {
                setMode("brief");
                setSection("opening");
              }}
            >
              Primeira sessão
            </Button>
            <Button
              type="button"
              aria-pressed={mode === "full"}
              className="min-h-11"
              variant={mode === "full" ? "forest" : "ghost"}
              onClick={() => setMode("full")}
            >
              Anamnese completa
            </Button>
          </div>
        </div>
        <label className="grid w-full gap-1.5 text-sm font-medium sm:max-w-xs">
          Buscar pergunta
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ex.: gestação, profissão"
            className="min-h-11 text-base"
          />
        </label>
        {lastQuestion && isIntakeSection(intake?.last_section_edited) && (
          <Button
            variant="outline"
            className="min-h-11"
            type="button"
            onClick={() =>
              selectQuestion(intake.last_section_edited as IntakeSectionId, lastQuestion)
            }
          >
            Retomar última pergunta
          </Button>
        )}
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={withoutSource}
            onChange={(event) => setWithoutSource(event.target.checked)}
          />
          Respostas sem fonte própria
        </label>
        {(search.trim() || withoutSource) && (
          <div
            className="basis-full border-t border-border pt-2"
            aria-label="Perguntas encontradas"
          >
            {results.length ? (
              <ul className="grid max-h-72 gap-x-4 overflow-y-auto sm:grid-cols-2">
                {results.map(({ section, field, label }) => (
                  <li key={field ?? section.id}>
                    <button
                      type="button"
                      className="min-h-11 w-full rounded-md px-2 py-1 text-left text-sm hover:bg-accent"
                      onClick={() => selectQuestion(section.id, field)}
                    >
                      <strong className="block text-foreground">{label}</strong>
                      {field && <span className="text-muted-foreground">{section.label}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status" className="text-sm text-muted-foreground">
                {withoutSource
                  ? "Nenhuma resposta sem fonte própria encontrada."
                  : "Nenhuma pergunta encontrada."}
              </p>
            )}
          </div>
        )}
      </header>
      <div className="dossier-intake-save">
        <p role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {save.isPending ? (
            <>
              <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" /> Salvando anamnese…
            </>
          ) : save.isError ? (
            <span className="text-clinical-critical">
              Falha ao salvar. As respostas continuam aqui.
            </span>
          ) : conflictCount ? (
            <span className="text-clinical-warning">
              {conflictCount === 1
                ? "Uma alteração precisa ser comparada."
                : `${conflictCount} alterações precisam ser comparadas.`}
            </span>
          ) : hasPending ? (
            <span className="text-clinical-warning">Alterações pendentes</span>
          ) : savedAt ? (
            <>
              <CheckCircle2 aria-hidden className="size-4 shrink-0 text-clinical-positive" />
              Anamnese salva às{" "}
              {savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </>
          ) : (
            <>Salvamento automático ativo</>
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => void queue.flush().catch(() => {})}
          disabled={save.isPending || !canSave}
        >
          <Save aria-hidden className="size-4" />
          {save.isError ? "Tentar salvar de novo" : "Salvar agora"}
        </Button>
      </div>
      <IntakeConflictReview
        conflicts={conflicts}
        pending={pending}
        saving={save.isPending}
        onResolve={resolve}
        onOpenQuestion={selectQuestion}
      />
      <IntakeContext.Provider
        value={{
          draft,
          update: (field, key, value) =>
            update(
              {
                [`context:${field}:${key}`]: value,
              },
              field,
            ),
          propose: setFinding,
        }}
      >
        <div ref={formRef} className="dossier-intake-workarea">
          <aside className="dossier-intake-reference">
            <div className="dossier-intake-completion">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                <p className="font-semibold text-primary">Preenchimento total</p>
                <span className="font-semibold tabular-nums text-primary">{completion}%</span>
              </div>
              <Progress
                value={completion}
                aria-label="Preenchimento total"
                className="mt-3 h-1.5"
              />
            </div>

            {mode === "full" && (
              <>
                <label className="dossier-intake-select">
                  Seção da anamnese
                  <select
                    className="min-h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-base"
                    value={section}
                    onChange={(event) => setSection(event.target.value as IntakeSectionId)}
                  >
                    {INTAKE_SECTIONS.map(({ id, label }) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <nav aria-label="Seções da anamnese" className="dossier-intake-index">
                  {INTAKE_SECTIONS.map((s) => {
                    const sc = calcSectionCompletion(draft, s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-current={section === s.id ? "step" : undefined}
                        onClick={() => setSection(s.id)}
                        className="dossier-intake-index-item"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span>{s.label}</span>
                          <span className="dossier-intake-question-count">
                            {sc.filled}/{sc.total}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </nav>
              </>
            )}
          </aside>

          <div className="dossier-intake-sheet">
            <header className="dossier-intake-section-head">
              <h3 ref={sectionTitleRef} tabIndex={-1} className="scroll-mt-44 text-balance">
                {mode === "brief"
                  ? "Pontos de partida"
                  : INTAKE_SECTIONS.find((s) => s.id === section)?.label}
              </h3>
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-3 text-sm sm:flex sm:flex-wrap">
                {mode === "full" && (
                  <label className="col-span-2 grid min-w-0 gap-1.5 font-medium text-foreground">
                    <span>Origem da informação</span>
                    <select
                      className="min-h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-base font-normal sm:w-auto sm:text-sm"
                      value={
                        ((draft.section_sources as Record<string, string> | null) ?? {})[section] ??
                        ""
                      }
                      onChange={(event) =>
                        update({ [`source:${section}`]: event.target.value || null })
                      }
                    >
                      <option value="">Não registrada</option>
                      {Object.entries(INTAKE_SECTION_SOURCE).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {mode === "full" && (
                  <span className="self-center text-muted-foreground">
                    {sectionCompletion}% desta seção
                  </span>
                )}
              </div>
            </header>

            <div className="dossier-intake-fields">
              {mode === "brief" ? (
                <div className="space-y-5">
                  <AreaField
                    label={INTAKE_QUESTION_LABELS.presenting_intention}
                    field="presenting_intention"
                    draft={draft}
                    update={update}
                  />
                  <AreaField
                    label={INTAKE_QUESTION_LABELS.clan_important_events}
                    field="clan_important_events"
                    draft={draft}
                    update={update}
                  />
                  <AreaField
                    label={INTAKE_QUESTION_LABELS.clan_bonds_ruptures}
                    field="clan_bonds_ruptures"
                    draft={draft}
                    update={update}
                  />
                </div>
              ) : (
                <>
                  {section === "opening" && <SectionOpening draft={draft} update={update} />}
                  {section === "personal" && <SectionPersonal draft={draft} update={update} />}
                  {section === "relationships" && (
                    <SectionRelationships draft={draft} update={update} />
                  )}
                  {section === "body" && <SectionBody draft={draft} update={update} />}
                  {section === "origins" && <SectionOrigins draft={draft} update={update} />}
                  {section === "subjective" && <SectionSubjective draft={draft} update={update} />}
                  {section === "siblings" && <SectionSiblings draft={draft} update={update} />}
                  {section === "professional" && (
                    <SectionProfessional draft={draft} update={update} />
                  )}
                  {section === "clan_checklist" && (
                    <SectionClanChecklist draft={draft} update={update} />
                  )}
                  {section === "clan_narratives" && (
                    <SectionClanNarratives draft={draft} update={update} />
                  )}
                  {section === "additional" && <SectionAdditional draft={draft} update={update} />}
                </>
              )}
            </div>
          </div>
        </div>
      </IntakeContext.Provider>
      {finding && (
        <IntakeEventProposal
          clientId={clientId}
          finding={finding}
          onClose={() => setFinding(undefined)}
        />
      )}
    </div>
  );
}

// ---- Field helpers ----

type SectionProps = {
  draft: Partial<ClientIntake>;
  update: (patch: IntakeFields) => void;
};

function Field({
  label,
  hint,
  children,
  id,
  onUnknown,
  isUnknown,
  field,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  id?: string;
  onUnknown?: () => void;
  isUnknown?: boolean;
  field?: keyof ClientIntake;
}) {
  return (
    <div className="space-y-1.5 scroll-mt-44" data-intake-field={field} tabIndex={-1}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-[15px] text-foreground">
          {label}
        </Label>
        {onUnknown && (
          <button
            type="button"
            onClick={onUnknown}
            aria-pressed={isUnknown}
            className={`min-h-11 rounded-md px-2 text-sm underline-offset-2 hover:underline ${isUnknown ? "font-semibold text-primary" : "text-muted-foreground"}`}
          >
            {isUnknown ? "Marcado: desconhecido" : "Não se sabe"}
          </button>
        )}
      </div>
      {children}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      {field && <AnswerMetadata field={field} label={label} />}
    </div>
  );
}

function AnswerMetadata({ field, label }: { field: keyof ClientIntake; label: string }) {
  const context = useContext(IntakeContext);
  if (!context) return null;
  const metadata = answerContext(context.draft, field);
  const { status, source, note } = metadata;
  const answer = context.draft[field];
  const eligible =
    [
      "presenting_intention",
      "clan_important_events",
      "clan_bonds_ruptures",
      "clan_repeated_stories",
    ].includes(field) &&
    typeof answer === "string" &&
    answer.trim() !== "" &&
    answer !== INTAKE_UNKNOWN &&
    status !== "unknown" &&
    status !== "not_applicable";
  const statuses = Object.entries(INTAKE_ANSWER_STATUS);
  const sources = Object.entries(INTAKE_ANSWER_SOURCE);
  const control = "min-h-11 min-w-0 rounded-md border border-input bg-card px-3 text-base";
  return (
    <details className="text-sm text-muted-foreground">
      <summary className="min-h-11 cursor-pointer py-3 font-medium">
        {[
          source ? (sources.find(([key]) => key === source)?.[1] ?? source) : "Fonte sem registro",
          status ? (statuses.find(([key]) => key === status)?.[1] ?? status) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        <span className="sr-only"> · {label}</span>
      </summary>
      <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
        <label className="grid min-w-0 gap-1.5">
          Situação
          <select
            className={control}
            value={status ?? ""}
            onChange={(e) => context.update(field, "status", e.target.value || null)}
          >
            <option value="">Sem marcação</option>
            {statuses.map(([key, text]) => (
              <option key={key} value={key}>
                {text}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1.5">
          Fonte
          <select
            className={control}
            value={source ?? ""}
            onChange={(e) => context.update(field, "source", e.target.value || null)}
          >
            <option value="">Não registrada</option>
            {sources.map(([key, text]) => (
              <option key={key} value={key}>
                {text}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1.5 sm:col-span-2">
          Referência ou observação
          <Textarea
            rows={2}
            value={note ?? ""}
            onChange={(e) => context.update(field, "note", e.target.value || null)}
          />
        </label>
        {eligible && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 justify-self-start sm:col-span-2"
            onClick={() => context.propose({ field, label, text: answer, context: metadata })}
          >
            Propor acontecimento
          </Button>
        )}
      </div>
    </details>
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
  const id = useId();
  const textual = !props.type || props.type === "text";
  const inputValue = props.type === "datetime-local" ? intakeBirthTimeInput(String(value)) : value;
  return (
    <Field
      id={id}
      field={props.field}
      label={props.label}
      hint={props.hint}
      isUnknown={value === INTAKE_UNKNOWN}
      onUnknown={
        textual
          ? () =>
              props.update({
                [props.field]: value === INTAKE_UNKNOWN ? "" : INTAKE_UNKNOWN,
              } as Partial<ClientIntake>)
          : undefined
      }
    >
      <Input
        id={id}
        type={props.type ?? "text"}
        value={inputValue}
        onChange={(e) => {
          const value = e.target.value;
          let stored: string | number | null = value;
          if (props.type === "datetime-local") stored = intakeBirthTimeStorage(value);
          if (props.type === "date") stored = value || null;
          if (props.type === "number") stored = value ? Number(value) : null;
          props.update({ [props.field]: stored } as Partial<ClientIntake>);
        }}
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
  const id = useId();
  return (
    <Field
      id={id}
      field={props.field}
      label={props.label}
      hint={props.hint}
      isUnknown={value === INTAKE_UNKNOWN}
      onUnknown={() =>
        props.update({
          [props.field]: value === INTAKE_UNKNOWN ? "" : INTAKE_UNKNOWN,
        } as Partial<ClientIntake>)
      }
    >
      <Textarea
        id={id}
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
        label={INTAKE_QUESTION_LABELS.presenting_intention}
        field="presenting_intention"
        rows={8}
        draft={draft}
        update={update}
        hint="Dores, desequilíbrios, temas recorrentes. Cada análise nasce de um objetivo claro."
      />
      <AreaField
        label={INTAKE_QUESTION_LABELS.signature_notes}
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
      <TextField
        label={INTAKE_QUESTION_LABELS.full_name}
        field="full_name"
        draft={draft}
        update={update}
      />
      <TextField
        label={INTAKE_QUESTION_LABELS.name_chooser}
        field="name_chooser"
        draft={draft}
        update={update}
      />
      <AreaField
        label={INTAKE_QUESTION_LABELS.name_intention}
        field="name_intention"
        rows={2}
        draft={draft}
        update={update}
      />
      <AreaField
        label={INTAKE_QUESTION_LABELS.name_repetition_in_family}
        field="name_repetition_in_family"
        rows={2}
        draft={draft}
        update={update}
      />
      <TextField
        label={INTAKE_QUESTION_LABELS.birth_datetime}
        field="birth_datetime"
        type="datetime-local"
        draft={draft}
        update={update}
      />
      <TextField
        label={INTAKE_QUESTION_LABELS.birth_place}
        field="birth_place"
        draft={draft}
        update={update}
      />
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
      <TextField
        label={INTAKE_QUESTION_LABELS.religion}
        field="religion"
        draft={draft}
        update={update}
      />
      <TextField
        label={INTAKE_QUESTION_LABELS.education}
        field="education"
        draft={draft}
        update={update}
      />
      <TextField
        label={INTAKE_QUESTION_LABELS.profession}
        field="profession"
        draft={draft}
        update={update}
      />
      <TextField
        label={INTAKE_QUESTION_LABELS.ethnicity_maternal}
        field="ethnicity_maternal"
        draft={draft}
        update={update}
      />
      <TextField
        label={INTAKE_QUESTION_LABELS.ethnicity_paternal}
        field="ethnicity_paternal"
        draft={draft}
        update={update}
      />
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
          label={INTAKE_QUESTION_LABELS.union_date}
          field="union_date"
          type="date"
          draft={draft}
          update={update}
        />
        <TextField
          label={INTAKE_QUESTION_LABELS.relationships_count}
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
        label={INTAKE_QUESTION_LABELS.moles_notes}
        field="moles_notes"
        draft={draft}
        update={update}
        rows={3}
        hint="Local, e se há similar em outro membro da família."
      />
      <AreaField
        label={INTAKE_QUESTION_LABELS.scars_notes}
        field="scars_notes"
        draft={draft}
        update={update}
        rows={3}
        hint="Onde, quando, em qual contexto."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label={INTAKE_QUESTION_LABELS.ear_stretcher}
          field="ear_stretcher"
          draft={draft}
          update={update}
        />
        <TextField
          label={INTAKE_QUESTION_LABELS.piercings}
          field="piercings"
          draft={draft}
          update={update}
        />
      </div>
      <AreaField
        label={INTAKE_QUESTION_LABELS.missing_limbs}
        field="missing_limbs"
        draft={draft}
        update={update}
        rows={2}
      />
      <AreaField
        label={INTAKE_QUESTION_LABELS.extra_or_inverted_limbs}
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
        label={INTAKE_QUESTION_LABELS.conception_notes}
        field="conception_notes"
        draft={draft}
        update={update}
        rows={4}
      />
      <AreaField
        label={INTAKE_QUESTION_LABELS.pregnancy_notes}
        field="pregnancy_notes"
        draft={draft}
        update={update}
        rows={4}
      />
      <AreaField
        label={INTAKE_QUESTION_LABELS.birth_notes}
        field="birth_notes"
        draft={draft}
        update={update}
        rows={4}
      />

      <div className="mt-4 rounded-md border border-lilac-soft bg-lilac-soft/40 p-4">
        <p className="mb-3 text-sm font-semibold text-bronze">Condições dos pais na gestação</p>
        <div className="grid gap-4 md:grid-cols-2">
          <AreaField
            label={INTAKE_QUESTION_LABELS.parents_financial_mother}
            field="parents_financial_mother"
            rows={2}
            draft={draft}
            update={update}
          />
          <AreaField
            label={INTAKE_QUESTION_LABELS.parents_financial_father}
            field="parents_financial_father"
            rows={2}
            draft={draft}
            update={update}
          />
          <AreaField
            label={INTAKE_QUESTION_LABELS.parents_emotional_mother}
            field="parents_emotional_mother"
            rows={2}
            draft={draft}
            update={update}
          />
          <AreaField
            label={INTAKE_QUESTION_LABELS.parents_emotional_father}
            field="parents_emotional_father"
            rows={2}
            draft={draft}
            update={update}
          />
          <AreaField
            label={INTAKE_QUESTION_LABELS.parents_professional_mother}
            field="parents_professional_mother"
            rows={2}
            draft={draft}
            update={update}
          />
          <AreaField
            label={INTAKE_QUESTION_LABELS.parents_professional_father}
            field="parents_professional_father"
            rows={2}
            draft={draft}
            update={update}
          />
        </div>
      </div>

      <AreaField
        label={INTAKE_QUESTION_LABELS.historical_context_at_birth}
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
        label={INTAKE_QUESTION_LABELS.life_mission}
        field="life_mission"
        draft={draft}
        update={update}
        rows={4}
      />
      <AreaField
        label={INTAKE_QUESTION_LABELS.childhood_traumas}
        field="childhood_traumas"
        draft={draft}
        update={update}
        rows={5}
      />
      <AreaField
        label={INTAKE_QUESTION_LABELS.childhood_dream_profession}
        field="childhood_dream_profession"
        draft={draft}
        update={update}
        rows={3}
      />
      <AreaField
        label={INTAKE_QUESTION_LABELS.disliked_patterns}
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
        label={INTAKE_QUESTION_LABELS.siblings_relationship}
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
        label={INTAKE_QUESTION_LABELS.siblings_deaths_notes}
        field="siblings_deaths_notes"
        draft={draft}
        update={update}
        rows={4}
      />
      <AreaField
        label={INTAKE_QUESTION_LABELS.parents_siblings_deaths}
        field="parents_siblings_deaths"
        draft={draft}
        update={update}
        rows={4}
      />
      <AreaField
        label={INTAKE_QUESTION_LABELS.parents_relationship}
        field="parents_relationship"
        draft={draft}
        update={update}
        rows={4}
      />
      <AreaField
        label={INTAKE_QUESTION_LABELS.school_events}
        field="school_events"
        draft={draft}
        update={update}
        rows={4}
      />
      <AreaField
        label={INTAKE_QUESTION_LABELS.own_abortions}
        field="own_abortions"
        draft={draft}
        update={update}
        rows={3}
      />
      <AreaField
        label={INTAKE_QUESTION_LABELS.own_illnesses}
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
        label={INTAKE_QUESTION_LABELS.formal_education}
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
        label={INTAKE_QUESTION_LABELS.future_perspective}
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
        Para cada item, indique o(s) membro(s) portador(es). Depois, aponte-os no genossociograma.
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
        label={INTAKE_QUESTION_LABELS.clan_other_observations}
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
        label={INTAKE_QUESTION_LABELS.clan_important_events}
        field="clan_important_events"
        draft={draft}
        update={update}
        rows={6}
        hint="Guerras, perseguições, migrações, mortes traumáticas, disputas de herança, síndromes, infertilidade…"
      />
      <AreaField
        label={INTAKE_QUESTION_LABELS.clan_bonds_ruptures}
        field="clan_bonds_ruptures"
        draft={draft}
        update={update}
        rows={6}
        hint="Casamentos entre primos, histórias de amor marcantes, ressentimentos, parentes afastados."
      />
      <AreaField
        label={INTAKE_QUESTION_LABELS.clan_repeated_stories}
        field="clan_repeated_stories"
        draft={draft}
        update={update}
        rows={5}
      />
      <AreaField
        label={INTAKE_QUESTION_LABELS.clan_secrets}
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
          label={INTAKE_QUESTION_LABELS.favorite_childhood_games}
          field="favorite_childhood_games"
          draft={draft}
          update={update}
          rows={3}
        />
        <AreaField
          label={INTAKE_QUESTION_LABELS.childhood_fears}
          field="childhood_fears"
          draft={draft}
          update={update}
          rows={3}
        />
        <AreaField
          label={INTAKE_QUESTION_LABELS.recurring_dreams}
          field="recurring_dreams"
          draft={draft}
          update={update}
          rows={3}
        />
        <AreaField
          label={INTAKE_QUESTION_LABELS.marking_fairy_tales}
          field="marking_fairy_tales"
          draft={draft}
          update={update}
          rows={3}
        />
        <TextField
          label={INTAKE_QUESTION_LABELS.dental_agenesis}
          field="dental_agenesis"
          draft={draft}
          update={update}
        />
        <TextField
          label={INTAKE_QUESTION_LABELS.dental_root_canal}
          field="dental_root_canal"
          draft={draft}
          update={update}
        />
        <AreaField
          label={INTAKE_QUESTION_LABELS.cultural_heritage_maternal}
          field="cultural_heritage_maternal"
          draft={draft}
          update={update}
          rows={4}
        />
        <AreaField
          label={INTAKE_QUESTION_LABELS.cultural_heritage_paternal}
          field="cultural_heritage_paternal"
          draft={draft}
          update={update}
          rows={4}
        />
      </div>

      <div className="rounded-md border border-lilac-soft bg-lilac-soft/40 p-4">
        <p className="mb-3 text-sm font-semibold text-bronze">Átomo social</p>
        <div className="grid gap-4 md:grid-cols-2">
          <AreaField
            label={INTAKE_QUESTION_LABELS.social_atom_object}
            field="social_atom_object"
            draft={draft}
            update={update}
            rows={2}
          />
          <AreaField
            label={INTAKE_QUESTION_LABELS.social_atom_book}
            field="social_atom_book"
            draft={draft}
            update={update}
            rows={2}
          />
          <AreaField
            label={INTAKE_QUESTION_LABELS.social_atom_pet}
            field="social_atom_pet"
            draft={draft}
            update={update}
            rows={2}
          />
          <AreaField
            label={INTAKE_QUESTION_LABELS.social_atom_historic_moment}
            field="social_atom_historic_moment"
            draft={draft}
            update={update}
            rows={2}
          />
          <AreaField
            label={INTAKE_QUESTION_LABELS.social_atom_music}
            field="social_atom_music"
            draft={draft}
            update={update}
            rows={2}
          />
          <AreaField
            label={INTAKE_QUESTION_LABELS.social_atom_close_people}
            field="social_atom_close_people"
            draft={draft}
            update={update}
            rows={2}
          />
          <AreaField
            label={INTAKE_QUESTION_LABELS.social_atom_symbols}
            field="social_atom_symbols"
            draft={draft}
            update={update}
            rows={2}
          />
          <AreaField
            label={INTAKE_QUESTION_LABELS.social_atom_other}
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
        <p className="text-sm font-semibold text-bronze">{title}</p>
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
