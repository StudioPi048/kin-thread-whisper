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
      {/* Breadcrumb */}
      <div className="border-b border-white/10 bg-[#151A15] px-6 py-4 shrink-0 shadow-sm">
        <p className="font-sans text-[16px] font-bold uppercase tracking-[0.25em] text-[#D4AF37]">
          Instituto Liz / IA Clínica
        </p>
      </div>

      {/* Main chat layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-[#1B211A] p-6 gap-6 overflow-hidden h-full relative">
          {/* Paper grain for chat background */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.2] mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.1) 0.5px, transparent 1px)",
              backgroundSize: "4px 4px",
            }}
          />

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto space-y-6 pr-4 relative z-10 custom-scrollbar">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-4 max-w-[85%] ${msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                <div
                  className={`size-10 rounded-none shrink-0 flex items-center justify-center border ${
                    msg.sender === "user"
                      ? "bg-[#D4AF37]/10 border-[#D4AF37]/50 text-[#D4AF37]"
                      : "bg-[#151A15] border-white/20 text-[#D4AF37]"
                  }`}
                >
                  {msg.sender === "user" ? <User className="size-5" /> : <Bot className="size-5" />}
                </div>
                <div
                  className={`p-5 shadow-lg text-[16px] leading-relaxed font-serif ${
                    msg.sender === "user"
                      ? "bg-[#151A15] text-[#FAFAF8] border border-[#D4AF37]/20"
                      : "bg-[#151A15] text-[#1B211A] border border-black/20"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Chat input */}
          <div className="shrink-0 flex gap-3 pt-4 relative z-10 bg-transparent">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Pergunte à IA Clínica (ex: 'Quais padrões investigar?')..."
              className="flex-1 h-14 font-serif text-[16px] bg-[#151A15] text-white border-white/20 placeholder:text-white/40 rounded-none focus-visible:ring-[#D4AF37]"
            />
            <Button
              onClick={handleSend}
              className="h-14 w-14 rounded-none bg-[#D4AF37] text-[#1B211A] hover:bg-[#D4AF37]/80 p-0 flex items-center justify-center shrink-0"
            >
              <Send className="size-5 fill-current" />
            </Button>
          </div>
        </div>

        {/* Sidebar right (Context details) */}
        <div className="w-[340px] border-l border-white/10 bg-[#151A15] p-8 hidden lg:block space-y-8 overflow-y-auto">
          <div className="flex items-center gap-3 pb-5 border-b border-white/10">
            <Brain className="size-6 text-[#D4AF37]" />
            <h3 className="font-serif text-xl font-bold text-white">Cérebro Clínico</h3>
          </div>

          <div className="space-y-4">
            <h4 className="font-sans text-[16px] font-bold uppercase tracking-widest text-[#D4AF37]">
              Diretrizes de Análise
            </h4>
            <div className="p-5 bg-white/5 border border-white/10 space-y-3 font-serif text-[16px] text-white/70 leading-relaxed shadow-inner">
              <p>
                <strong className="text-white">Hipótese:</strong> A IA sugere caminhos transgeracionais que o terapeuta deve validar na relação clínica.
              </p>
              <p>
                <strong className="text-white">Foco Sistêmico:</strong> Cruza ocupações, perdas, causas de morte, idades e coincidências de datas.
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-5 border-t border-white/10">
            <h4 className="font-sans text-[16px] font-bold uppercase tracking-widest text-[#D4AF37]">
              Casos Recentes
            </h4>
            <div className="space-y-3 font-serif text-[16px]">
              <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                <span className="font-semibold text-white/90">Paciente Exemplo A</span>
                <span className="font-sans text-[9px] font-bold uppercase tracking-widest text-[#1B211A] bg-[#D4AF37] px-2 py-0.5 rounded-sm">Ativo</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                <span className="font-semibold text-white/50">Paciente Exemplo B</span>
                <span className="font-sans text-[9px] font-bold uppercase tracking-widest text-white/50 bg-white/10 px-2 py-0.5 rounded-sm">Ativo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
