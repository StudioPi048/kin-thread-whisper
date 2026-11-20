import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readVisits, type Visit } from "@/lib/recent-activity";

const TAB_LABEL: Record<string, string> = {
  overview: "Visão geral",
  genogram: "Genossociograma",
  clan: "Planilha do clã",
  intake: "Anamnese",
  sessions: "Sessões",
  timeline: "Linha do tempo",
  patterns: "Padrões",
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
    <div className="workspace-current-case" role="region" aria-label="Retomar caso">
      <Link
        to="/app/clientes/$clientId"
        params={{ clientId: visit.clientId }}
        search={{ tab: visit.tab as "overview" }}
        className="workspace-current-link"
      >
        <span>
          <span className="workspace-current-label">
            Retomar · {TAB_LABEL[visit.tab] ?? "Dossiê"}
          </span>
          <strong title={name}>{name}</strong>
        </span>
        <ArrowRight size={15} aria-hidden />
      </Link>
      <button
        type="button"
        onClick={() => setHidden(true)}
        className="workspace-icon"
        aria-label="Ocultar caso atual nesta visita"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
