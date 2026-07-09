import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Send, Brain, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArchiveCard, ArchiveCardContent, ArchiveCardHeader, ArchiveCardTitle } from "@/components/archive/archive-card";
import { SectionTitle } from "@/components/archive/section-title";
import { ClinicalPanel, ClinicalPanelContent, ClinicalPanelHeader, ClinicalPanelTitle } from "@/components/archive/clinical-panel";
import { StatusBadge } from "@/components/archive/status-badge";

export const Route = createFileRoute("/_authenticated/app/ia-clinica")({
  component: IaClinicaPage,
});

function Tape({ rotate = "0deg", w = "64px", top = "-10px", left = "50%" }: { rotate?: string; w?: string; top?: string; left?: string; }) {
  return (
    <div
      className="absolute z-20 shadow-sm"
      style={{
        top,
        left,
        transform: `translateX(-50%) rotate(${rotate})`,
        width: w,
        height: "22px",
        background: "rgba(210,190,155,0.75)",
      }}
    />
  );
}

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

    // Simulate AI response
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
    <div className="min-h-screen text-foreground pb-24">
      
      {/* ═══════════════════════════════════════════════════
          CABEÇALHO
      ════════════════════════════════════════════════════ */}
      <header className="pt-24 pb-12 border-b border-border/50">
        <SectionTitle
          eyebrow="Instituto Liz"
          title="Cérebro Clínico (IA)"
          subtitle="Seu assistente especializado em psicogenealogia e análise transgeracional."
          action={
            <div className="flex items-center gap-3 bg-muted px-4 py-2 rounded-full border border-border shadow-inner">
               <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gold">
                  <Sparkles className="size-4" /> Inteligência Ativa
               </span>
            </div>
          }
        />
      </header>

      {/* ═══════════════════════════════════════════════════
          ÁREA PRINCIPAL
      ════════════════════════════════════════════════════ */}
      <div className="container-archive py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Chat (Bloco de Anotações) */}
          <div className="lg:col-span-8 flex flex-col h-[70vh]">
            <ArchiveCard variant="paper" elevation="md" className="flex-1 flex flex-col relative overflow-hidden h-full rounded-xl">
              <Tape rotate="-1deg" w="80px" top="-5px" left="50%" />
              
              <ArchiveCardHeader className="bg-background/40 backdrop-blur-sm z-10 pt-8 pb-4">
                 <div className="flex items-center gap-3">
                   <Brain className="size-6 text-gold" />
                   <ArchiveCardTitle className="text-2xl font-serif">Anotações da Sessão</ArchiveCardTitle>
                 </div>
              </ArchiveCardHeader>

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto space-y-8 p-8 relative z-10 custom-scrollbar pb-32">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.sender === "user" ? (
                      <div className="bg-background text-foreground border border-border/50 p-6 shadow-sm max-w-[85%] relative rounded-br-none rounded-2xl">
                         <p className="font-serif text-lg leading-relaxed">{msg.text}</p>
                         <span className="absolute bottom-2 right-4 text-xs font-sans font-bold uppercase tracking-widest text-muted-foreground/50">Você</span>
                      </div>
                    ) : (
                      <div className="bg-amber-50/50 dark:bg-amber-900/10 border-l-4 border-gold p-6 shadow-sm max-w-[85%] relative rounded-r-2xl">
                         <ShieldCheck className="absolute -left-3.5 -top-3.5 size-7 text-gold bg-archive p-1 rounded-full shadow-sm" />
                         <span className="block font-sans text-xs font-bold uppercase tracking-widest text-gold mb-3 flex items-center gap-2">
                           Copiloto Clínico
                         </span>
                         <p className="font-serif italic text-lg text-foreground leading-relaxed">"{msg.text}"</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Chat input */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-archive-doc via-archive-doc to-transparent z-20">
                <div className="flex gap-3 bg-background border border-border shadow-lifted rounded p-2 focus-within:ring-2 focus-within:ring-gold transition-shadow">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Pergunte à IA Clínica (ex: 'Quais padrões investigar?')..."
                    className="flex-1 h-12 font-serif text-lg bg-transparent border-none focus-visible:ring-0 shadow-none"
                  />
                  <Button
                    onClick={handleSend}
                    className="h-12 w-12 bg-primary text-primary-foreground hover:opacity-90 p-0 flex items-center justify-center shrink-0 rounded cursor-pointer"
                  >
                    <Send className="size-5" />
                  </Button>
                </div>
              </div>
            </ArchiveCard>
          </div>

          {/* Sidebar right (Context details) */}
          <div className="lg:col-span-4 space-y-8">
            <ClinicalPanel accent="forest">
              <ClinicalPanelHeader>
                <div className="flex items-center gap-3">
                  <Brain className="size-5 text-forest" />
                  <ClinicalPanelTitle>Diretrizes de Análise</ClinicalPanelTitle>
                </div>
              </ClinicalPanelHeader>
              <ClinicalPanelContent className="space-y-4">
                <div className="font-serif text-lg text-foreground/80 leading-relaxed">
                  <p className="mb-4">
                    <strong className="text-foreground">Hipótese Sistêmica:</strong> A IA sugere caminhos transgeracionais que o terapeuta deve validar na relação clínica.
                  </p>
                  <p>
                    <strong className="text-foreground">Foco:</strong> Cruza ocupações, perdas, causas de morte, idades e coincidências de datas relevantes.
                  </p>
                </div>
              </ClinicalPanelContent>
            </ClinicalPanel>

            <ClinicalPanel>
              <ClinicalPanelHeader>
                <ClinicalPanelTitle>Contexto Ativo</ClinicalPanelTitle>
              </ClinicalPanelHeader>
              <ClinicalPanelContent>
                 <div className="space-y-4 font-serif text-lg">
                   <div className="flex justify-between items-center py-3 border-b border-border/50">
                     <span className="font-bold text-foreground">Paciente Exemplo A</span>
                     <StatusBadge status="positive" variant="soft">Ativo</StatusBadge>
                   </div>
                   <div className="flex justify-between items-center py-3 border-b border-border/50">
                     <span className="font-bold text-muted-foreground">Paciente Exemplo B</span>
                     <StatusBadge status="neutral" variant="outline">Em Revisão</StatusBadge>
                   </div>
                 </div>
              </ClinicalPanelContent>
            </ClinicalPanel>
          </div>

        </div>
      </div>
    </div>
  );
}
