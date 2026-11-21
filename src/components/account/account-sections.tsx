import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, RefreshCw } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  preferencesKey,
  type Preferences,
} from "@/lib/preferences";
import { usePreferences } from "./use-preferences";
import { exportAccountData } from "@/lib/data-export";
import { downloadJson, readExportPage } from "@/lib/download-export";
import {
  listPendingDossierDeletions,
  pendingDossierDeletionsKey,
  resumeDossierDeletion,
} from "@/lib/delete-client-dossier";

const card =
  "rounded-[14px] border border-material-border bg-surface-document p-6 shadow-surface sm:p-8";

export function AccountPreferences({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const q = usePreferences(userId);
  const [draft, setDraft] = useState<Preferences | null>(null);
  const form = draft ?? q.data ?? DEFAULT_PREFERENCES;
  const save = useMutation({
    mutationFn: async (submitted: Preferences) => {
      const { data, error } = await supabase
        .from("profiles")
        .update({ preferences: submitted })
        .eq("id", userId)
        .select("preferences")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Perfil não encontrado");
      return parsePreferences(data.preferences);
    },
    onSuccess: async (saved) => {
      const queryKey = preferencesKey(userId);
      await qc.cancelQueries({ queryKey, exact: true });
      qc.setQueryData(queryKey, saved);
      setDraft(null);
    },
  });
  const dirty = !!q.data && JSON.stringify(form) !== JSON.stringify(q.data);
  const fieldsDisabled = !q.data || save.isPending;

  return (
    <section className={card} aria-labelledby="prefs-h">
      <h2 id="prefs-h" className="m-0 font-serif text-2xl text-ink">
        Preferências
      </h2>
      <p className="mt-1 text-[14px] text-muted-foreground">
        Salvas na sua conta e aplicadas em qualquer dispositivo.
      </p>
      {q.isError && !q.data ? (
        <p role="alert" className="mt-4 text-[15px] text-destructive">
          Não foi possível carregar.{" "}
          <Button size="sm" variant="outline" className="min-h-11" onClick={() => q.refetch()}>
            <RefreshCw className="mr-1 size-4" /> Tentar de novo
          </Button>
        </p>
      ) : (
        <div className="mt-4 space-y-4 text-[15px]">
          <fieldset disabled={fieldsDisabled}>
            <legend className="font-semibold">Tamanho do texto</legend>
            <div className="mt-2 flex gap-2">
              {(["normal", "large"] as const).map((v) => (
                <label
                  key={v}
                  className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3"
                >
                  <input
                    type="radio"
                    name="textSize"
                    checked={form.textSize === v}
                    onChange={() => setDraft({ ...form, textSize: v })}
                    className="size-4"
                  />
                  {v === "normal" ? "Padrão" : "Maior"}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={fieldsDisabled}>
            <legend className="font-semibold">Visão inicial da Agenda</legend>
            <div className="mt-2 flex gap-2">
              {(["day", "week"] as const).map((v) => (
                <label
                  key={v}
                  className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3"
                >
                  <input
                    type="radio"
                    name="agendaView"
                    checked={form.agendaView === v}
                    onChange={() => setDraft({ ...form, agendaView: v })}
                    className="size-4"
                  />
                  {v === "day" ? "Dia" : "Semana"}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={form.reduceMotion}
              onChange={(e) => setDraft({ ...form, reduceMotion: e.target.checked })}
              disabled={fieldsDisabled}
              className="size-5"
            />
            Reduzir animações (além da configuração do sistema)
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="min-h-11"
              disabled={!dirty || save.isPending}
              onClick={() => save.mutate(form)}
            >
              {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {save.isError ? "Tentar salvar de novo" : "Salvar preferências"}
            </Button>
            <span
              role="status"
              className={save.isError ? "text-destructive" : "text-muted-foreground"}
            >
              {save.isError
                ? `Não salvo: ${save.error instanceof Error ? save.error.message : "erro"}.`
                : save.isPending
                  ? "Salvando preferências…"
                  : q.isPending
                    ? "Carregando preferências…"
                    : save.isSuccess && !dirty
                      ? "Salvo"
                      : ""}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

/** Exporta os dados do próprio usuário (lidos com as regras de acesso dele). Áudios não são incluídos. */
export function DataExport({ userId }: { userId: string }) {
  const [state, setState] = useState<{
    phase: "idle" | "running" | "error" | "done";
    msg?: string;
  }>({ phase: "idle" });

  const run = async () => {
    setState({ phase: "running" });
    try {
      const out = await exportAccountData(readExportPage, userId);
      downloadJson(out, `genealiz-conta-${new Date().toISOString().slice(0, 10)}.json`);
      setState({ phase: "done" });
    } catch (e) {
      setState({ phase: "error", msg: e instanceof Error ? e.message : "Falha" });
    }
  };

  return (
    <section className={card} aria-labelledby="export-h">
      <h2 id="export-h" className="m-0 font-serif text-2xl text-ink">
        Exportar meus dados
      </h2>
      <p className="mt-1 text-[15px] text-muted-foreground">
        Baixa um JSON de toda a conta com perfil, dossiês, mapas, vínculos, anamneses, sessões,
        autorizações e revisões. Os arquivos de áudio e fotos ficam fora do download. Você pode
        exportar um caso pelo menu do próprio dossiê.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button className="min-h-11" onClick={run} disabled={state.phase === "running"}>
          {state.phase === "running" ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Download className="mr-2 size-4" />
          )}
          {state.phase === "error" ? "Tentar exportar de novo" : "Exportar"}
        </Button>
        <span
          role="status"
          className={
            state.phase === "error"
              ? "text-[15px] text-destructive"
              : "text-[15px] text-muted-foreground"
          }
        >
          {state.phase === "error"
            ? `Falhou: ${state.msg}`
            : state.phase === "done"
              ? "Arquivo gerado."
              : ""}
        </span>
      </div>
    </section>
  );
}

export function PendingDossierDeletions({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const key = pendingDossierDeletionsKey(userId);
  const pending = useQuery({ queryKey: key, queryFn: listPendingDossierDeletions, retry: false });
  const resume = useMutation({
    mutationFn: resumeDossierDeletion,
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <section id="exclusoes" className={card + " scroll-mt-6"} aria-labelledby="exclusoes-h">
      <h2 id="exclusoes-h" className="m-0 font-serif text-2xl text-ink">
        Limpeza de arquivos
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Retome a limpeza de áudios ou fotos quando a exclusão de um dossiê for interrompida.
      </p>
      {pending.isPending ? (
        <p role="status" className="mt-4 text-sm text-ink-soft">
          Consultando exclusões pendentes…
        </p>
      ) : pending.isError ? (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          Não foi possível consultar as exclusões.
          <Button variant="outline" className="min-h-11" onClick={() => void pending.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : pending.data.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">Nenhuma limpeza pendente.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {pending.data.map((job) => (
            <li
              key={job.client_id}
              className="flex flex-wrap items-center justify-between gap-3 py-2"
            >
              <span className="text-sm">Pedido de {date.format(new Date(job.created_at))}</span>
              <Button
                variant="outline"
                className="min-h-11"
                disabled={resume.isPending}
                onClick={() => resume.mutate(job.client_id)}
              >
                {resume.isPending && resume.variables === job.client_id
                  ? "Limpando…"
                  : "Retomar limpeza"}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {resume.isError && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {resume.error.message}
        </p>
      )}
      {resume.isSuccess && (
        <p role="status" className="mt-2 text-sm text-forest">
          Arquivos removidos.
        </p>
      )}
    </section>
  );
}
