import { useState } from "react";
import { Download } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  prepareDossierReport,
  saveDossierReportPdf,
  type ReportOptions,
} from "@/lib/dossier-report";
import { readExportPage } from "@/lib/download-export";

const fields = [
  { name: "family", label: "Família e filiações registradas" },
  { name: "timeline", label: "Linha do tempo do dossiê" },
  { name: "sessions", label: "Datas e estado das sessões" },
] as const;

export function DossierReportDialog({
  clientId,
  userId,
  onClose,
}: {
  clientId: string;
  userId: string;
  onClose: () => void;
}) {
  const [fieldsSelected, setFieldsSelected] = useState<ReportOptions>({
    family: true,
    timeline: true,
    sessions: false,
    includeNotes: false,
    reducedIdentity: true,
  });
  const prepare = useMutation({
    mutationFn: (selected: ReportOptions) =>
      prepareDossierReport(readExportPage, userId, clientId, selected),
  });
  const save = useMutation({ mutationFn: saveDossierReportPdf });

  function change(name: keyof ReportOptions, checked: boolean) {
    setFieldsSelected({
      ...fieldsSelected,
      [name]: checked,
      ...((name === "reducedIdentity" && checked) || (name === "sessions" && !checked)
        ? { includeNotes: false }
        : {}),
    });
    prepare.reset();
    save.reset();
  }

  const busy = prepare.isPending || save.isPending;
  const error = prepare.error ?? save.error;

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle>Preparar relatório PDF</DialogTitle>
        <DialogDescription>
          Escolha as seções e confira a prévia. O relatório reúne os registros da sua conta.
        </DialogDescription>
        <fieldset disabled={busy} className="grid gap-1 text-sm">
          <legend className="mb-1 font-semibold text-forest">Seções do relatório</legend>
          {fields.map(({ name, label }) => (
            <label key={name} className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={fieldsSelected[name]}
                onChange={(event) => change(name, event.target.checked)}
              />
              {label}
            </label>
          ))}
          <label className="flex min-h-11 items-center gap-2 border-t border-border">
            <input
              type="checkbox"
              checked={fieldsSelected.reducedIdentity}
              onChange={(event) => change("reducedIdentity", event.target.checked)}
            />
            Ocultar nomes e detalhes livres. Mostrar apenas o ano nas datas.
          </label>
          {fieldsSelected.sessions && !fieldsSelected.reducedIdentity && (
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={fieldsSelected.includeNotes}
                onChange={(event) => change("includeNotes", event.target.checked)}
              />
              Incluir notas manuais de sessão
            </label>
          )}
        </fieldset>
        {prepare.data && (
          <section
            aria-label="Prévia do relatório"
            className="max-h-[34dvh] overflow-auto rounded-md border border-border p-3 text-sm"
            tabIndex={0}
          >
            <h3 className="font-semibold text-forest">{prepare.data.title}</h3>
            {prepare.data.sections.map((section) => (
              <div className="mt-3" key={section.title}>
                <h4 className="font-medium">{section.title}</h4>
                {section.lines.length ? (
                  <ul className="mt-1 space-y-1">
                    {section.lines.map((line, index) => (
                      <li key={index} className="whitespace-pre-line break-words">
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-ink-soft">Sem registros para este relatório.</p>
                )}
              </div>
            ))}
          </section>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error.message || "Não foi possível preparar o relatório. Tente novamente."}
          </p>
        )}
        {save.isSuccess && (
          <p role="status" className="text-sm text-forest">
            Relatório PDF gerado.
          </p>
        )}
        <DialogFooter aria-busy={busy}>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={busy || !fields.some(({ name }) => fieldsSelected[name])}
            onClick={() => prepare.mutate(fieldsSelected)}
          >
            {prepare.isPending ? "Preparando…" : "Conferir prévia"}
          </Button>
          <Button
            className="min-h-11"
            disabled={busy || !prepare.data}
            onClick={() => prepare.data && save.mutate(prepare.data)}
          >
            <Download size={16} aria-hidden /> Baixar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
