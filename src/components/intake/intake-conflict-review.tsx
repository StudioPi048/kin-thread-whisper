import { Button } from "@/components/ui/button";
import type { Json } from "@/integrations/supabase/types";
import {
  INTAKE_ANSWER_SOURCE,
  INTAKE_ANSWER_STATUS,
  INTAKE_QUESTION_LABELS,
  INTAKE_SECTIONS,
  INTAKE_SECTION_SOURCE,
  SECTION_FIELDS,
  type ClientIntake,
  type IntakeSectionId,
} from "@/lib/intake";
import type { IntakeConflicts, IntakeEdits } from "./intake-save";

function describeChange(key: string) {
  if (key.startsWith("source:")) {
    const section = INTAKE_SECTIONS.find(({ id }) => id === key.slice("source:".length));
    return {
      label: `${section?.label ?? "Seção"} · Origem da informação`,
      section,
      field: undefined,
      values: INTAKE_SECTION_SOURCE,
    };
  }
  const parts = key.split(":");
  const field = (parts.length === 3 ? parts[1] : parts[0]) as keyof ClientIntake;
  const attribute = parts[2];
  const section = INTAKE_SECTIONS.find(({ id }) => SECTION_FIELDS[id].includes(field));
  const label = INTAKE_QUESTION_LABELS[field as keyof typeof INTAKE_QUESTION_LABELS] ?? key;
  if (attribute === "status")
    return { label: `${label} · Situação`, section, field, values: INTAKE_ANSWER_STATUS };
  if (attribute === "source")
    return { label: `${label} · Fonte`, section, field, values: INTAKE_ANSWER_SOURCE };
  return {
    label: attribute === "note" ? `${label} · Referência ou observação` : label,
    section,
    field,
  };
}

function formatValue(value: Json | undefined, labels?: Record<string, string>): string {
  if (value == null || value === "") return "Sem registro";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "string") return labels?.[value] ?? value;
  if (Array.isArray(value))
    return value.length ? value.map((entry) => formatValue(entry)).join("\n") : "Sem registro";
  if (typeof value === "object") {
    return (
      Object.values(value)
        .filter((entry) => entry != null && entry !== "")
        .map((entry) => formatValue(entry))
        .join(" · ") || "Sem registro"
    );
  }
  return String(value);
}

export function IntakeConflictReview({
  conflicts,
  pending,
  saving,
  onResolve,
  onOpenQuestion,
}: {
  conflicts: IntakeConflicts;
  pending: IntakeEdits;
  saving: boolean;
  onResolve: (key: string, keepDraft: boolean) => void;
  onOpenQuestion: (section: IntakeSectionId, field?: keyof ClientIntake) => void;
}) {
  const entries = Object.entries(conflicts).filter(([key]) => pending[key]);
  if (!entries.length) return null;
  return (
    <section
      aria-label="Conflitos de edição"
      className="space-y-3 rounded-lg border border-clinical-warning/50 bg-card p-3"
    >
      <p className="text-sm text-foreground">
        A versão salva mudou enquanto você editava. Compare os registros e escolha o que manter.
      </p>
      {entries.map(([key, { previous, current }]) => {
        const { label, section, field, values } = describeChange(key);
        return (
          <details
            key={key}
            open={entries.length === 1}
            className="rounded-md border border-border px-3"
          >
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">
              {label}
            </summary>
            <dl className="grid gap-3 border-t border-border py-3 text-sm sm:grid-cols-3">
              {(
                [
                  ["Versão anterior", previous],
                  ["Versão salva", current],
                  ["Seu rascunho", pending[key].value],
                ] as const
              ).map(([title, value]) => (
                <div key={title} className="min-w-0">
                  <dt className="font-semibold">{title}</dt>
                  <dd className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere] text-muted-foreground">
                    {formatValue(value, values)}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2 pb-3">
              <Button
                type="button"
                className="min-h-11"
                disabled={saving}
                onClick={() => onResolve(key, true)}
              >
                Salvar meu rascunho
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={saving}
                onClick={() => onResolve(key, false)}
              >
                Usar versão salva
              </Button>
              {section && (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11"
                  onClick={() => onOpenQuestion(section.id, field)}
                >
                  {field ? "Ir à pergunta" : "Ir à seção"}
                </Button>
              )}
            </div>
          </details>
        );
      })}
    </section>
  );
}
