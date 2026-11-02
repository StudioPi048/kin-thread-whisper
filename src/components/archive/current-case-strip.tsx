import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readVisits, type Visit } from "@/lib/recent-activity";

const TAB_LABEL: Record<string, string> = {
  overview: "Visão geral",
  genogram: "Genossociograma",
  spreadsheet: "Planilha do clã",
  anamnese: "Anamnese",
  sessions: "Sessões",
  timeline: "Linha do tempo",
};

/**
 * Caso atual como contexto constante fora do dossiê. Do navegador vem só
 * ID + aba (recent-activity); o nome é lido do banco sob RLS, nunca salvo.
 */
export function CurrentCaseStrip({ userId, pathname }: { userId: string; pathname: string }) {
  const [visit, setVisit] = useState<Visit | null>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setVisit(readVisits(userId)[0] ?? null);
  }, [userId, pathname]);
  const inDossier = pathname.startsWith("/app/clientes/");
  const q = useQuery({
    queryKey: ["case-strip-name", visit?.clientId],
    enabled: !!visit && !inDossier && !hidden,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("full_name, preferred_name")
        .eq("id", visit!.clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (!visit || inDossier || hidden || !q.data) return null;
  const name = q.data.preferred_name || q.data.full_name;
  return (
    <div
      className="flex min-h-11 items-center gap-3 border-b border-border bg-card px-4 text-[14px]"
      role="region"
      aria-label="Caso atual"
    >
      <span className="text-muted-foreground">Caso atual:</span>
      <Link
        to="/app/clientes/$clientId"
        params={{ clientId: visit.clientId }}
        search={{ tab: visit.tab as "overview" }}
        className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-2"
      >
        {name}
        <span className="text-muted-foreground">· {TAB_LABEL[visit.tab] ?? "Dossiê"}</span>
        <ArrowRight className="size-4" aria-hidden />
      </Link>
      <button
        type="button"
        onClick={() => setHidden(true)}
        className="ml-auto inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        aria-label="Ocultar caso atual nesta visita"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
