import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  AUDIO_CONSENT_SCOPE,
  AUDIO_CONSENT_SOURCE,
  type AudioConsentEvent,
  type AudioConsentScope,
  type AudioConsentSource,
} from "@/lib/audio-consent";

const scopeDetail: Record<AudioConsentScope, string> = {
  recording: "Usar o microfone e guardar o áudio no dossiê da Genealiz.",
  external_processing:
    "Enviar o áudio e a transcrição a serviços externos de IA, via Lovable, para gerar um texto que a profissional revisa.",
};

function eventLabel(event: AudioConsentEvent) {
  return `${event.granted ? "Concedida" : "Revogada"} em ${new Date(event.created_at).toLocaleString("pt-BR")} · ${AUDIO_CONSENT_SOURCE[event.source as AudioConsentSource] ?? event.source}`;
}

export function AudioConsentPanel({
  clientId,
  events,
  loading,
  unavailable,
  refresh,
}: {
  clientId: string;
  events: AudioConsentEvent[];
  loading: boolean;
  unavailable: boolean;
  refresh: () => Promise<unknown>;
}) {
  const [change, setChange] = useState<{ scope: AudioConsentScope; granted: boolean }>();
  const [source, setSource] = useState<AudioConsentSource | "">("");
  const save = useMutation({
    mutationFn: async () => {
      if (!change || !source) return;
      const { error } = await supabase.rpc("record_audio_consent", {
        _client_id: clientId,
        _scope: change.scope,
        _granted: change.granted,
        _source: source,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await refresh();
      setChange(undefined);
      setSource("");
    },
  });

  return (
    <section className="space-y-4 rounded-sm border border-border bg-surface-document p-4 sm:p-5">
      <div>
        <h3 className="text-base font-semibold text-primary">Autorizações de áudio</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre a decisão do consultante para cada finalidade.
        </p>
      </div>
      {loading && (
        <p role="status" className="text-sm">
          Consultando autorizações…
        </p>
      )}
      {unavailable && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
          Autorizações indisponíveis. O registro manual está disponível.
          <Button variant="outline" className="min-h-11" onClick={() => void refresh()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {!loading && !unavailable && (
        <>
          <ul className="grid gap-3 lg:grid-cols-2">
            {(Object.keys(AUDIO_CONSENT_SCOPE) as AudioConsentScope[]).map((scope) => {
              const latest = events.find((event) => event.scope === scope);
              return (
                <li key={scope} className="space-y-2 rounded-sm border border-border p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                    <h4 className="text-sm font-semibold">{AUDIO_CONSENT_SCOPE[scope]}</h4>
                    <span className="text-sm text-muted-foreground">
                      {latest?.granted ? "Autorizado" : latest ? "Revogado" : "Sem autorização"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{scopeDetail[scope]}</p>
                  <Button
                    variant="outline"
                    className="min-h-11"
                    aria-label={`${latest?.granted ? "Revogar" : "Registrar autorização para"} ${AUDIO_CONSENT_SCOPE[scope].toLowerCase()}`}
                    disabled={save.isPending}
                    onClick={() => {
                      save.reset();
                      setChange({ scope, granted: !latest?.granted });
                      setSource("");
                    }}
                  >
                    {latest?.granted ? "Revogar autorização" : "Registrar autorização"}
                  </Button>
                </li>
              );
            })}
          </ul>
          {change && (
            <form
              className="space-y-3 rounded-sm border border-border bg-background p-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (source && !save.isPending) save.mutate();
              }}
            >
              <p className="text-sm font-semibold">
                {change.granted ? "Registrar autorização" : "Registrar revogação"} ·{" "}
                {AUDIO_CONSENT_SCOPE[change.scope]}
              </p>
              <label className="block text-sm">
                Origem da decisão
                <select
                  required
                  className="mt-1 block min-h-11 w-full max-w-xs rounded-sm border border-input bg-background p-2"
                  value={source}
                  onChange={(event) => setSource(event.target.value as AudioConsentSource)}
                >
                  <option value="">Selecione</option>
                  {Object.entries(AUDIO_CONSENT_SOURCE).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {save.isError && (
                <p role="alert" className="text-sm text-destructive">
                  A decisão não foi registrada. Confira a conexão e tente novamente.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button className="min-h-11" disabled={!source || save.isPending} type="submit">
                  {save.isPending ? "Registrando…" : "Confirmar decisão"}
                </Button>
                <Button
                  className="min-h-11"
                  variant="ghost"
                  disabled={save.isPending}
                  type="button"
                  onClick={() => setChange(undefined)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          )}
          {events.length > 0 && (
            <details>
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">
                Histórico de autorizações ({events.length})
              </summary>
              <ol className="space-y-2 border-t border-border pt-3 text-sm">
                {events.map((event) => (
                  <li key={event.id}>
                    <strong>{AUDIO_CONSENT_SCOPE[event.scope as AudioConsentScope]}</strong>
                    <span className="ml-2 text-muted-foreground">{eventLabel(event)}</span>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </>
      )}
    </section>
  );
}
