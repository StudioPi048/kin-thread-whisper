import { createFileRoute, Link } from "@tanstack/react-router";
import { Send, Bot, User, Brain } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DocumentHeader } from "@/components/ui/document-header";

export const Route = createFileRoute("/_authenticated/app/ia-clinica")({
  component: IaClinicaPage,
});

function IaClinicaPage() {
  const [input, setInput] = useState("");

  const { data: recentClients = [] } = useQuery({
    queryKey: ["ia-clinica-recent-clients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, preferred_name, status")
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });
  const [messages, setMessages] = useState<Array<{ sender: "ai" | "user"; text: string }>>([
    {
      sender: "ai",
      text: "Olá! Sou a IA Clínica Liz, seu segundo cérebro para psicogenealogia. Posso analisar repetições transgeracionais, sugerir hipóteses para casos ou pesquisar conceitos teóricos. Em qual caso ou padrão estamos trabalhando hoje?",
    },
  ]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setInput("");

    // Simulate AI response based on keyword matching
    setTimeout(() => {
      let aiText =
        "Compreendo a dinâmica. Do ponto de vista transgeracional, isso sugere que o paciente pode estar carregando um mandato invisível. Recomendo mapear as profissões e causas de falecimento nas três gerações anteriores.";

      const lower = userMsg.toLowerCase();
      if (lower.includes("exemplo") || lower.includes("caso demonstrativo")) {
        aiText =
          "Em um caso demonstrativo, podemos detectar uma síndrome de aniversário em relação a datas familiares importantes (casamentos, nascimentos, falecimentos). Investigue coincidências de datas nas três gerações anteriores e observe repetições de queixas de abandono ou exclusão.";
      } else if (lower.includes("síndrome de aniversário") || lower.includes("aniversario")) {
        aiText =
          "A síndrome de aniversário (estudada por Anne Ancelin Schützenberger) aponta que eventos de vida importantes (doenças, acidentes, casamentos, mortes) tendem a se repetir na mesma data ou na mesma idade em gerações sucessivas. Recomendo investigar datas exatas dos avós e tios.";
      } else if (lower.includes("abandono") || lower.includes("trauma")) {
        aiText =
          "Traumas de abandono repetidos geram lealdades sistêmicas invisíveis onde os descendentes recriam a exclusão para se manterem 'fiéis' ao destino dos antepassados. O trabalho de constelação e genograma visa trazer esses excluídos de volta ao clã.";
      }

      setMessages((prev) => [...prev, { sender: "ai", text: aiText }]);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-90px)]">
      <DocumentHeader
        breadcrumb="Instituto Liz / Inteligência Clínica"
        title="Segundo Cérebro Clínico"
        subtitle="Seu assistente especialista em Psicogenealogia para análise de repetições transgeracionais e hipóteses diagnósticas."
        actions={
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full whitespace-nowrap">
            Protótipo · modo demonstração
          </span>
        }
      />
      {/* Main chat layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-slate-50/[0.3] p-6 gap-4 overflow-hidden h-full">
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 max-w-[80%] ${msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                <div
                  className={`size-8 rounded-full shrink-0 flex items-center justify-center border ${
                    msg.sender === "user"
                      ? "bg-forest-soft border-forest/30 text-forest"
                      : "bg-forest/5 border-forest/10 text-forest"
                  }`}
                >
                  {msg.sender === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
                </div>
                <div
                  className={`p-4 rounded-2xl shadow-sm text-[14px] leading-relaxed font-serif ${
                    msg.sender === "user"
                      ? "bg-forest text-white rounded-tr-none"
                      : "bg-white border border-border/50 text-primary rounded-tl-none"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Chat input */}
          <div className="shrink-0 flex gap-2 border-t border-border/50 pt-4 bg-transparent">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Pergunte à IA Clínica (ex: 'Quais padrões investigar?' ou 'O que é Síndrome de Aniversário?')..."
              className="flex-1 h-12 text-[14px] bg-white border-border/60"
            />
            <Button
              onClick={handleSend}
              className="h-12 w-12 p-0 flex items-center justify-center shrink-0"
            >
              <Send className="size-4 fill-current" />
            </Button>
          </div>
        </div>

        {/* Sidebar right (Context details) */}
        <div className="w-[300px] border-l border-border/50 bg-white p-6 hidden lg:block space-y-6 overflow-y-auto">
          <div className="flex items-center gap-2 pb-4 border-b border-border/40">
            <Brain className="size-5 text-forest" />
            <h3 className="font-serif text-lg font-bold text-primary">Cérebro Clínico</h3>
          </div>

          <div className="space-y-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Diretrizes de Análise
            </h4>
            <div className="p-3.5 bg-slate-50 border border-border/60 rounded-xl space-y-2 text-[12px] text-muted-foreground leading-relaxed">
              <p>
                🟢 <strong>Sempre uma hipótese:</strong> A IA sugere caminhos transgeracionais que o
                terapeuta deve validar na relação clínica.
              </p>
              <p>
                🟢 <strong>Foco Sistêmico:</strong> Cruza ocupações, perdas, causas de morte, idades
                e coincidências de datas.
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border/40">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Casos Recentes
            </h4>
            {recentClients.length === 0 ? (
              <p className="text-[13px] text-muted-foreground italic font-serif">
                Nenhum caso ativo ainda.
              </p>
            ) : (
              <div className="space-y-2 text-[13px]">
                {recentClients.map((c) => (
                  <Link
                    key={c.id}
                    to="/app/clientes/$clientId"
                    params={{ clientId: c.id }}
                    className="flex justify-between items-center py-1 rounded-md px-1 -mx-1 hover:bg-forest/5 transition-colors"
                  >
                    <span className="font-semibold text-primary truncate">
                      {c.preferred_name || c.full_name}
                    </span>
                    <Badge className="bg-forest/5 text-forest border-forest/10 text-[10px] shrink-0">
                      Ativo
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
