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
  const people = [...preview.people].sort(
    (left, right) =>
      Number(right.state === "error" || right.state === "match") -
        Number(left.state === "error" || left.state === "match") || left.line - right.line,
  );
  const links = [...preview.relations].sort(
    (left, right) =>
      Number(right.state === "error") - Number(left.state === "error") || left.line - right.line,
  );

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="font-semibold">Conferência por ID</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Campos vazios preservam os dados da ficha. Vínculos usam os IDs das pessoas, mesmo
            quando os nomes são iguais.
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
      <div>
        <p className="mb-2 text-sm" role="status">
          {people.filter((person) => person.state === "include").length} novas ·{" "}
          {people.filter((person) => person.state === "update").length} alterações ·{" "}
          {people.filter((person) => person.state === "match" || person.state === "error").length} a
          conferir
        </p>
        <div className="max-h-64 overflow-auto rounded-md border border-border">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">Alterações da aba de pessoas</caption>
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="p-2">Linha</th>
                <th className="p-2">Pessoa</th>
                <th className="p-2">Situação</th>
                <th className="p-2">Alterações</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.line} className="border-t border-border align-top">
                  <td className="p-2 tabular-nums">{person.line}</td>
                  <td className="p-2">
                    <p className="break-words font-medium">{person.name || "Nome pendente"}</p>
                    <p className="break-all text-muted-foreground">{person.key}</p>
                  </td>
                  <td className="p-2">{stateLabels[person.state]}</td>
                  <td className="p-2">{person.changes.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {people
        .filter((person) => person.state === "match" || Boolean(choices[person.key]))
        .map((person) => (
          <label key={person.line} className="grid gap-1 text-sm font-medium">
            Linha {person.line} · {person.name}
            <select
              className="min-h-11 rounded-md border border-input bg-background px-3 text-[15px]"
              value={choices[person.key] ?? ""}
              onChange={(event) => onChoice(person.key, event.target.value)}
              disabled={pending}
            >
              <option value="">Selecione a correspondência</option>
              <option value="new">Criar uma nova pessoa</option>
              {person.candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {[
                    candidate.full_name,
                    candidate.relationship_to_proband,
                    candidate.birth_date ?? candidate.birth_date_partial,
                    candidate.id.slice(0, 8),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </option>
              ))}
            </select>
          </label>
        ))}
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
        <div>
          <p className="mb-2 font-semibold">Vínculos</p>
          <ul className="max-h-60 divide-y divide-border overflow-auto rounded-md border border-border">
            {links.map((link) => (
              <li key={link.line} className="grid gap-1 p-3 text-sm">
                <p className="font-medium">
                  Linha {link.line} · {link.name} · {stateLabels[link.state]}
                </p>
                <p
                  className={
                    link.state === "error" ? "text-clinical-critical" : "text-muted-foreground"
                  }
                >
                  {link.detail}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
