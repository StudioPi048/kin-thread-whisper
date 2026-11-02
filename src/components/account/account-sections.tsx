import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, RefreshCw } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DEFAULT_PREFERENCES, preferencesKey, type Preferences } from "@/lib/preferences";
import { usePreferences } from "./use-preferences";

const card = "rounded-[14px] border border-material-border bg-surface-document p-6 shadow-surface sm:p-8";

export function AccountPreferences({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const q = usePreferences(userId);
  const [form, setForm] = useState<Preferences>(DEFAULT_PREFERENCES);
  useEffect(() => {
    if (q.data) setForm(q.data);
  }, [q.data]);
  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .update({ preferences: form })
        .eq("id", userId)
        .select("preferences")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Perfil não encontrado");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: preferencesKey(userId) }),
  });
  const dirty = !!q.data && JSON.stringify(form) !== JSON.stringify(q.data);

  return (
    <section className={card} aria-labelledby="prefs-h">
      <h2 id="prefs-h" className="m-0 font-serif text-2xl text-ink">Preferências</h2>
      <p className="mt-1 text-[14px] text-muted-foreground">Salvas na sua conta e aplicadas em qualquer dispositivo.</p>
      {q.isError ? (
        <p role="alert" className="mt-4 text-[15px] text-destructive">
          Não foi possível carregar.{" "}
          <Button size="sm" variant="outline" className="min-h-11" onClick={() => q.refetch()}>
            <RefreshCw className="mr-1 size-4" /> Tentar de novo
          </Button>
        </p>
      ) : (
        <div className="mt-4 space-y-4 text-[15px]">
          <fieldset>
            <legend className="font-semibold">Tamanho do texto</legend>
            <div className="mt-2 flex gap-2">
              {(["normal", "large"] as const).map((v) => (
                <label key={v} className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3">
                  <input type="radio" name="textSize" checked={form.textSize === v} onChange={() => setForm({ ...form, textSize: v })} className="size-4" />
                  {v === "normal" ? "Padrão" : "Maior"}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="font-semibold">Visão inicial da Agenda</legend>
            <div className="mt-2 flex gap-2">
              {(["day", "week"] as const).map((v) => (
                <label key={v} className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3">
                  <input type="radio" name="agendaView" checked={form.agendaView === v} onChange={() => setForm({ ...form, agendaView: v })} className="size-4" />
                  {v === "day" ? "Dia" : "Semana"}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" checked={form.reduceMotion} onChange={(e) => setForm({ ...form, reduceMotion: e.target.checked })} className="size-5" />
            Reduzir animações (além da configuração do sistema)
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button className="min-h-11" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {save.isError ? "Tentar salvar de novo" : "Salvar preferências"}
            </Button>
            <span role="status" className={save.isError ? "text-destructive" : "text-muted-foreground"}>
              {save.isError
                ? `Não salvo: ${save.error instanceof Error ? save.error.message : "erro"}.`
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
  const [state, setState] = useState<{ phase: "idle" | "running" | "error" | "done"; msg?: string }>({ phase: "idle" });

  const run = async () => {
    setState({ phase: "running" });
    try {
      const tables = [
        "profiles",
        "clients",
        "client_intakes",
        "genogram_persons",
        "genogram_relationships",
        "genogram_layouts",
        "clinical_sessions",
        "hypothesis_reviews",
        "library_entries",
      ] as const;
      const out: Record<string, unknown> = { exported_at: new Date().toISOString(), user_id: userId, note: "Arquivos de áudio não incluídos." };
      for (const t of tables) {
        const { data, error } = await supabase.from(t).select("*");
        if (error) throw new Error(`${t}: ${error.message}`);
        out[t] = data;
      }
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `genealiz-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setState({ phase: "done" });
    } catch (e) {
      setState({ phase: "error", msg: e instanceof Error ? e.message : "Falha" });
    }
  };

  return (
    <section className={card} aria-labelledby="export-h">
      <h2 id="export-h" className="m-0 font-serif text-2xl text-ink">Exportar meus dados</h2>
      <p className="mt-1 text-[15px] text-muted-foreground">
        Baixa um arquivo JSON com seu perfil, clientes, familiares, vínculos, anamneses, sessões (sem áudio) e revisões. O arquivo contém dados
        clínicos — guarde-o em local seguro.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button className="min-h-11" onClick={run} disabled={state.phase === "running"}>
          {state.phase === "running" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
          {state.phase === "error" ? "Tentar exportar de novo" : "Exportar"}
        </Button>
        <span role="status" className={state.phase === "error" ? "text-[15px] text-destructive" : "text-[15px] text-muted-foreground"}>
          {state.phase === "error" ? `Falhou: ${state.msg}` : state.phase === "done" ? "Arquivo gerado." : ""}
        </span>
      </div>
    </section>
  );
}
