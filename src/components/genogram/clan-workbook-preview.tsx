import type { ReactNode } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClanSheet } from "@/lib/clan-import";
import type { planClanWorkbook } from "@/lib/clan-workbook";

const stateLabels = {
  include: "Incluir",
  update: "Atualizar",
  keep: "Manter",
  match: "Escolher pessoa",
  error: "Conferir",
};

export function ClanImportRow({
  line,
  name,
  metadata,
  status,
  attention,
  children,
}: {
  line: number;
  name: string;
  metadata?: string;
  status: string;
  attention?: boolean;
  children?: ReactNode;
}) {
  return (
    <li className="grid min-w-0 gap-2 p-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-5 sm:p-4">
      <div className="min-w-0 space-y-0.5 [overflow-wrap:anywhere]">
        <p className="font-semibold text-ink">{name || "Nome pendente"}</p>
        <p className="text-muted-foreground">
          Linha {line}
          {metadata && ` · ${metadata}`}
        </p>
      </div>
      <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]">
        <p className={attention ? "font-semibold text-clinical-critical" : "font-medium text-ink"}>
          {status}
        </p>
        {children}
      </div>
    </li>
  );
}

export function ClanSheetSelect({
  label,
  sheets,
  value,
  onChange,
  optional,
  disabled,
}: {
  label: string;
  sheets: ClanSheet[];
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="grid min-w-0 gap-1 text-sm font-medium">
      {label}
      <select
        className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-[15px]"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {optional && <option value="">Sem aba de vínculos</option>}
        {sheets.map((sheet) => (
          <option key={sheet.name} value={sheet.name}>
            {sheet.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ClanWorkbookPreview({
  preview,
  choices,
  onChoice,
  allowReplacement,
  onAllowReplacement,
  canReplace,
  pending,
  onTemplate,
}: {
  preview: ReturnType<typeof planClanWorkbook>;
  choices: Record<string, string>;
  onChoice: (key: string, value: string) => void;
  allowReplacement: boolean;
  onAllowReplacement: (value: boolean) => void;
  canReplace: boolean;
  pending: boolean;
  onTemplate: () => void;
}) {
  const needsReview = (person: (typeof preview.people)[number]) =>
    person.state === "error" || person.state === "match" || Boolean(choices[person.key]);
  const people = [...preview.people].sort(
    (left, right) =>
      Number(needsReview(right)) - Number(needsReview(left)) || left.line - right.line,
  );
  const links = [...preview.relations].sort(
    (left, right) =>
      Number(right.state === "error") - Number(left.state === "error") || left.line - right.line,
  );

  return (
    <div className="grid min-w-0 gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="font-semibold">Conferência por ID</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Campos vazios preservam os dados da ficha. Vínculos usam os IDs das pessoas. Se houver
            nomes iguais sem um ID correspondente, escolha a pessoa na própria linha.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={onTemplate}
          disabled={pending}
        >
          <FileSpreadsheet className="size-4" aria-hidden /> Baixar modelo
        </Button>
      </div>
      <section aria-labelledby="clan-import-people">
        <h3 id="clan-import-people" className="mb-2 font-semibold">
          Pessoas
        </h3>
        <ul className="divide-y divide-border rounded-md border border-border">
          {people.map((person) => (
            <ClanImportRow
              key={person.line}
              line={person.line}
              name={person.name}
              metadata={person.key ? `ID ${person.key}` : undefined}
              status={stateLabels[person.state]}
              attention={person.state === "error" || person.state === "match"}
            >
              {person.changes.length > 0 && (
                <p className="text-muted-foreground">{person.changes.join(" · ")}</p>
              )}
              {(person.state === "match" || choices[person.key]) && (
                <fieldset className="min-w-0 pt-2" disabled={pending}>
                  <legend className="text-sm font-medium">Correspondência no dossiê</legend>
                  {[
                    ...person.candidates.map((candidate) => ({
                      value: candidate.id,
                      label: candidate.full_name,
                      detail: [
                        candidate.relationship_to_proband,
                        candidate.birth_date ?? candidate.birth_date_partial,
                        candidate.id.slice(0, 8),
                      ]
                        .filter(Boolean)
                        .join(" · "),
                    })),
                    { value: "new", label: "Criar uma nova pessoa", detail: "" },
                    { value: "", label: "Deixar por resolver", detail: "" },
                  ].map(({ value, label, detail }) => (
                    <label key={value} className="flex min-h-11 items-start gap-2 py-2">
                      <input
                        type="radio"
                        className="mt-0.5 size-4 shrink-0"
                        name={`clan-match-${person.line}`}
                        checked={(choices[person.key] ?? "") === value}
                        onChange={() => onChoice(person.key, value)}
                      />
                      <span>
                        <span className="block">{label}</span>
                        {detail && <span className="text-muted-foreground">{detail}</span>}
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
            </ClanImportRow>
          ))}
        </ul>
      </section>
      {canReplace && (
        <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0"
            checked={allowReplacement}
            onChange={(event) => onAllowReplacement(event.target.checked)}
            disabled={pending}
          />
          <span>
            <strong className="block">
              Substituir a filiação das pessoas listadas na aba Vínculos
            </strong>
            A prévia mostra os genitores atuais e os propostos. As mudanças ficam no histórico de
            filiação.
          </span>
        </label>
      )}
      {links.length > 0 && (
        <section aria-labelledby="clan-import-links">
          <h3 id="clan-import-links" className="mb-2 font-semibold">
            Vínculos
          </h3>
          <ul className="divide-y divide-border rounded-md border border-border">
            {links.map((link) => (
              <ClanImportRow
                key={link.line}
                line={link.line}
                name={link.name}
                status={stateLabels[link.state]}
                attention={link.state === "error"}
              >
                <p className="text-muted-foreground">{link.detail}</p>
              </ClanImportRow>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
