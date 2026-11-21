import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  AUDIO_CONSENT_SCOPE,
  AUDIO_CONSENT_SOURCE,
  latestAudioDecision,
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
  sessions,
  initialSessionId,
  requestedScope,
}: {
  clientId: string;
  events: AudioConsentEvent[];
  loading: boolean;
  unavailable: boolean;
  refresh: () => Promise<unknown>;
  sessions: { id: string; label: string }[];
  initialSessionId?: string;
  requestedScope?: { sessionId?: string };
}) {
  const [change, setChange] = useState<{
    scope: AudioConsentScope;
    granted: boolean;
    sessionId: string;
    targetLabel: string;
  }>();
  const [source, setSource] = useState<AudioConsentSource | "">("");
  const [selection, setSelection] = useState<{ request: typeof requestedScope; id: string }>();
  const target =
    selection && selection.request === requestedScope
      ? selection.id
      : requestedScope
        ? requestedScope.sessionId
        : initialSessionId;
  const selected = sessions.find((session) => session.id === target);
  const sessionId = selected?.id ?? "";
  const targetUnavailable = !!target && !selected;
  const [termVersion, setVersion] = useState("");
  const [reference, setReference] = useState("");
  const activeEvents = sessionId
    ? events.filter((event) => !event.session_id || event.session_id === sessionId)
    : events;
  const save = useMutation({
    mutationFn: async () => {
      if (!change || !source) return;
      const { error } = await supabase.rpc("record_audio_consent_details", {
        _client_id: clientId,
        _scope: change.scope,
        _granted: change.granted,
        _source: source,
        ...(change.sessionId ? { _session_id: change.sessionId } : {}),
        ...(termVersion.trim() ? { _term_version: termVersion.trim() } : {}),
        ...(reference.trim() ? { _document_reference: reference.trim() } : {}),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await refresh();
      setChange(undefined);
      setSource("");
      setVersion("");
      setReference("");
    },
  });

  return (
    <section
      id="audio-consents"
      tabIndex={-1}
      aria-labelledby="audio-consents-title"
      className="dossier-session-consents scroll-mt-24"
    >
      <div>
        <h2 id="audio-consents-title" className="dossier-work-heading">
          Autorizações de áudio
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre a decisão do consultante para cada finalidade, no caso inteiro ou em uma sessão.
        </p>
      </div>
      {(sessions.length > 0 || targetUnavailable) && (
        <label className="grid min-w-0 max-w-md grid-cols-[minmax(0,1fr)] gap-1.5 text-sm font-medium">
          Aplicação da decisão
          <select
            className="min-h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-base"
            value={targetUnavailable ? target : sessionId}
            disabled={!!change || save.isPending}
            onChange={(e) => setSelection({ request: requestedScope, id: e.target.value })}
          >
            {targetUnavailable && <option value={target}>Sessão indisponível</option>}
            <option value="">Caso inteiro</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.label}
              </option>
            ))}
          </select>
        </label>
      )}
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
          <ul className="dossier-consent-list">
            {(Object.keys(AUDIO_CONSENT_SCOPE) as AudioConsentScope[]).map((scope) => {
              const latest = latestAudioDecision(events, scope, sessionId || undefined);
              return (
                <li key={scope}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                    <h3 className="text-sm font-semibold">{AUDIO_CONSENT_SCOPE[scope]}</h3>
                    <span className="dossier-consent-state" data-granted={latest?.granted === true}>
                      {latest?.granted ? "Autorizado" : latest ? "Revogado" : "Sem autorização"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{scopeDetail[scope]}</p>
                  <Button
                    variant="outline"
                    className="min-h-11"
                    aria-label={`${latest?.granted ? "Revogar" : "Registrar autorização para"} ${AUDIO_CONSENT_SCOPE[scope].toLowerCase()}`}
                    disabled={save.isPending || targetUnavailable}
                    onClick={() => {
                      save.reset();
                      setChange({
                        scope,
                        granted: !latest?.granted,
                        sessionId,
                        targetLabel: selected?.label ?? "Caso inteiro",
                      });
                      setSource("");
                      setVersion("");
                      setReference("");
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
              <p className="text-sm">
                Aplicação da decisão · <strong>{change.targetLabel}</strong>
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
              {!change.granted && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {change.scope === "recording"
                    ? "A revogação impede iniciar gravações e armazenar áudios pendentes neste escopo."
                    : "A revogação impede novos envios para a IA neste escopo."}{" "}
                  Os registros já guardados permanecem no dossiê.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm">
                  Versão do termo (opcional)
                  <input
                    className="min-h-11 min-w-0 rounded-md border border-input bg-card px-3 text-base"
                    value={termVersion}
                    maxLength={100}
                    onChange={(e) => setVersion(e.target.value)}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  Referência do documento (opcional)
                  <input
                    className="min-h-11 min-w-0 rounded-md border border-input bg-card px-3 text-base"
                    value={reference}
                    maxLength={500}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </label>
              </div>
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
          {activeEvents.length > 0 && (
            <details>
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">
                Histórico de autorizações ({activeEvents.length})
              </summary>
              <ol className="space-y-2 border-t border-border pt-3 text-sm">
                {activeEvents.map((event) => (
                  <li key={event.id}>
                    <strong>{AUDIO_CONSENT_SCOPE[event.scope as AudioConsentScope]}</strong>
                    <span className="ml-2 text-muted-foreground">{eventLabel(event)}</span>
                    <p className="text-muted-foreground">
                      {event.session_id
                        ? (sessions.find((session) => session.id === event.session_id)?.label ??
                          "Sessão anterior")
                        : "Caso inteiro"}
                      {event.term_version && ` · termo ${event.term_version}`}
                    </p>
                    {event.document_reference && (
                      <p className="break-words">{event.document_reference}</p>
                    )}
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
