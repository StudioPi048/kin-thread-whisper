import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Send, Bot, User, Brain, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/ia-clinica")({
  component: IaClinicaPage,
});

function IaClinicaPage() {
  const [input, setInput] = useState("");
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
      if (lower.includes("pietro") || lower.includes("baccin")) {
        aiText =
          "No caso de Pietro Vinicius Baccin, detectamos uma síndrome de aniversário em relação à data de casamento da mãe e o falecimento do avô materno. Além disso, há repetição de queixas de abandono. Seria produtivo perguntar a ele como se sente em datas festivas da família.";
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
      {/* Breadcrumb */}
      <div className="border-b-2 border-border bg-cream px-6 py-3 shrink-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          Instituto Liz / IA Clínica
        </p>
      </div>

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
                      ? "bg-lavender-soft border-lavender/30 text-lavender"
                      : "bg-plum/5 border-plum/10 text-plum"
                  }`}
                >
                  {msg.sender === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
                </div>
                <div
                  className={`p-4 rounded-2xl shadow-sm text-[14px] leading-relaxed font-serif ${
                    msg.sender === "user"
                      ? "bg-lavender text-white rounded-tr-none"
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
              placeholder="Pergunte à IA Clínica (ex: 'Quais os padrões do Pietro?' ou 'O que é Síndrome de Aniversário?')..."
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
            <Brain className="size-5 text-plum" />
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
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between items-center py-1">
                <span className="font-semibold text-primary">Pietro Vinicius Baccin</span>
                <Badge className="bg-plum/5 text-plum border-plum/10 text-[10px]">Ativo</Badge>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="font-semibold text-primary">Leticia Baccin</span>
                <Badge className="bg-slate-100 text-muted-foreground text-[10px]">Ativo</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
