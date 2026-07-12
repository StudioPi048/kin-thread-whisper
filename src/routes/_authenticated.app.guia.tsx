import { createFileRoute } from "@tanstack/react-router";
import { DocumentHeader } from "@/components/ui/document-header";
import { GenealogyDivider } from "@/components/ui/narrative-connector";

export const Route = createFileRoute("/_authenticated/app/guia")({
  component: GuiaClinicoPage,
});

function GuiaClinicoPage() {
  return (
    <div className="min-h-screen bg-transparent pb-20 font-serif text-ink selection:bg-gold-soft">
      {/* Header Contextual */}
      <DocumentHeader
        breadcrumb="Instituto Liz / Manual Clínico"
        title="Guia de Operação Clínica"
        subtitle="Princípios, gramática visual e diretrizes para extrair o máximo do seu novo ambiente de trabalho."
      />

      <main className="container-liz max-w-3xl py-12 space-y-20">
        {/* Introdução */}
        <section className="space-y-6">
          <p className="text-xl md:text-2xl font-serif text-ink/80 leading-relaxed font-medium">
            A GeneaLiz não foi concebida para ser um software ou um painel administrativo. Ela foi
            desenhada para ser a sua <em>Mesa Clínica</em>. Aqui, a interface se esconde para que o
            seu raciocínio possa aparecer.
          </p>
        </section>

        {/* Capítulo 1: A Mesa Clínica */}
        <section className="space-y-8">
          <div>
            <h2 className="text-[11px] uppercase font-sans tracking-widest text-ink/40 font-bold mb-4 border-b border-ink/10 pb-4">
              Capítulo I — A Mesa Clínica
            </h2>
            <h3 className="text-3xl font-bold font-serif text-ink mb-6">
              Uma folha de papel inteligente
            </h3>
            <div className="space-y-5 text-[17px] leading-relaxed text-ink/85 font-serif">
              <p>
                Ao abrir a plataforma, você não encontrará um dashboard apinhado de gráficos, metas
                ou estatísticas vazias. A página inicial representa a sua mesa de trabalho na manhã
                de um atendimento.
              </p>
              <p>
                A regra de ouro da Mesa Clínica é a <strong>Sobriedade</strong>. Se não há uma
                prioridade absoluta para hoje — como um paciente em data de Síndrome de Aniversário
                ou uma hipótese de Lealdade Invisível prestes a se confirmar —, a mesa permanecerá
                limpa, aguardando suas anotações.
              </p>
              <blockquote className="border-l-2 border-forest/30 pl-5 my-8 italic text-ink/60">
                "Nenhuma informação deve disputar a sua atenção sem uma justificativa clínica
                profunda."
              </blockquote>
            </div>
          </div>
        </section>

        {/* Capítulo 2: O Protagonista */}
        <section className="space-y-8">
          <div>
            <h2 className="text-[11px] uppercase font-sans tracking-widest text-ink/40 font-bold mb-4 border-b border-ink/10 pb-4">
              Capítulo II — O Protagonista
            </h2>
            <h3 className="text-3xl font-bold font-serif text-ink mb-6">
              A centralidade do Paciente
            </h3>
            <div className="space-y-5 text-[17px] leading-relaxed text-ink/85 font-serif">
              <p>
                Na GeneaLiz, os módulos (como Agenda, Genossociogramas ou Finanças) existem para
                servir ao paciente, e não o oposto.
              </p>
              <p>
                Todo dado coletado orbita ao redor do <strong>Dossiê do Cliente</strong>. Quando
                você desenha uma árvore genealógica, anexa um documento ou grava um prontuário em
                voz, tudo converge para o mesmo eixo narrativo.
              </p>
            </div>
          </div>
        </section>

        {/* Capítulo 3: O Segundo Cérebro */}
        <section className="space-y-8">
          <div>
            <h2 className="text-[11px] uppercase font-sans tracking-widest text-ink/40 font-bold mb-4 border-b border-ink/10 pb-4">
              Capítulo III — O Segundo Cérebro
            </h2>
            <h3 className="text-3xl font-bold font-serif text-ink mb-6">
              Hipotetizar, nunca diagnosticar
            </h3>
            <div className="space-y-5 text-[17px] leading-relaxed text-ink/85 font-serif">
              <p>
                A Inteligência Artificial dentro da plataforma atua sob o{" "}
                <strong>Princípio da Não-Substituição</strong>. Ela jamais fará diagnósticos ou
                conclusões deterministas sobre a história de um sistema familiar.
              </p>
              <p>
                O papel do <em>Segundo Cérebro</em> é ler a vastidão de datas, nomes e laços que
                você inseriu e sussurrar perguntas como um supervisor clínico veterano:{" "}
                <em>
                  "Você notou que este paciente se casou na exata idade em que seu avô perdeu a
                  fazenda?"
                </em>
              </p>
              <p>
                As intervenções da IA passam por estágios (Investigada → Corroborada → Contestada) e
                requerem a sua validação humana para amadurecerem dentro do dossiê.
              </p>
            </div>
          </div>
        </section>

        {/* Capítulo 4: A Gramática Visual */}
        <section className="space-y-8">
          <div>
            <h2 className="text-[11px] uppercase font-sans tracking-widest text-ink/40 font-bold mb-4 border-b border-ink/10 pb-4">
              Capítulo IV — A Gramática Visual
            </h2>
            <h3 className="text-3xl font-bold font-serif text-ink mb-6">O Silêncio Clínico</h3>
            <div className="space-y-5 text-[17px] leading-relaxed text-ink/85 font-serif">
              <p>A interface da plataforma obedece à intensidade das informações coletadas.</p>
              <ul className="list-none space-y-4 my-6">
                <li className="flex gap-4 items-start">
                  <span className="w-6 h-6 rounded-full bg-forest-soft text-forest text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <p>
                    <strong>Nível Básico:</strong> Relatos normais de vida cotidiana. Apresentam
                    tipografia leve e estruturada.
                  </p>
                </li>
                <li className="flex gap-4 items-start">
                  <span className="w-6 h-6 rounded-full bg-forest text-white text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <p>
                    <strong>Nível de Tensão:</strong> Repetições transgeracionais. Os componentes
                    ganham peso visual (negrito ou itálico) mas mantêm a ordem.
                  </p>
                </li>
                <li className="flex gap-4 items-start">
                  <span className="w-6 h-6 rounded-full bg-clinical-critical text-white text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <p>
                    <strong>Nível de Colapso (Trauma/Segredo):</strong> Onde o relato quebra, a
                    interface também quebra. O alinhamento textual desce, as fontes se tornam
                    assimétricas e apagadas, simbolizando o "não dito".
                  </p>
                </li>
              </ul>
              <p>
                Desta forma, ao abrir um documento, você <em>sente</em> onde estão as feridas
                sistêmicas antes mesmo de ler o texto completo.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Fechamento editorial */}
      <div className="container-liz pt-16 pb-8">
        <GenealogyDivider opacity={0.2} />
      </div>
    </div>
  );
}
