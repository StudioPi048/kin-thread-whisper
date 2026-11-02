import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { DocumentHeader } from "@/components/ui/document-header";

export const Route = createFileRoute("/_authenticated/app/guia")({
  head: () => ({
    meta: [
      { title: "Guia de tarefas — GENEALIZ" },
      {
        name: "description",
        content: "Passo a passo para cadastrar, vincular, salvar, importar e conduzir sessões.",
      },
      { property: "og:title", content: "Guia de tarefas — GENEALIZ" },
      {
        property: "og:description",
        content: "Como realizar cada tarefa do atendimento na GENEALIZ.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuiaPage,
});

type Task = {
  id: string;
  title: string;
  steps: string[];
  note?: string;
  to:
    | "/app/clientes"
    | "/app/genossociogramas"
    | "/app/agenda"
    | "/app/ia-clinica"
    | "/app/biblioteca";
  action: string;
};

const TASKS: Task[] = [
  {
    id: "cadastrar",
    title: "Cadastrar um caso",
    steps: [
      "Em Clientes, use “Novo cliente” e preencha nome e consentimento.",
      "O cliente entra no mapa como pessoa de referência (geração 0).",
      "Abra o dossiê: as abas Visão geral, Genossociograma, Planilha, Anamnese, Linha do tempo e Sessões pertencem a esse caso.",
    ],
    to: "/app/clientes",
    action: "Abrir clientes",
  },
  {
    id: "vincular",
    title: "Adicionar familiares e vincular pais",
    steps: [
      "No Genossociograma, “Adicionar pessoa” e informe o parentesco (Irmã(o), Pai, Mãe, Avô paterno…).",
      "Na ficha da pessoa, “Definir pai ou mãe” liga explicitamente a pessoa aos genitores já cadastrados. Esse vínculo vale mais que o parentesco digitado.",
      "Meios-irmãos: vincule cada um ao pai/mãe correto; o mapa cria uniões separadas.",
      "Quem não tem genitor informado continua visível com aviso — o sistema não inventa pais.",
    ],
    note: "Orientação fixa do mapa: cliente e irmãos SEMPRE no topo; pais logo abaixo; avós abaixo dos pais; cada geração anterior desce mais um nível.",
    to: "/app/genossociogramas",
    action: "Abrir genossociogramas",
  },
  {
    id: "salvar",
    title: "Salvar e recuperar o layout do mapa",
    steps: [
      "Arraste pessoas para ajustar. O layout é salvo automaticamente após 2 s; “Salvar layout” força o envio.",
      "Desfazer/Refazer valem só para posições — remover pessoas não é desfeito.",
      "Se a conexão cair, um rascunho de posições fica neste navegador e é oferecido ao voltar (Recuperar/Descartar).",
      "“Recalcular” pede confirmação, porque substitui as posições salvas.",
    ],
    to: "/app/genossociogramas",
    action: "Ir ao mapa",
  },
  {
    id: "importar",
    title: "Importar a planilha do clã",
    steps: [
      "Na aba Planilha, “Importar” aceita CSV ou XLSX.",
      "Confira a prévia: mapeamento de colunas, erros por linha e possíveis duplicidades.",
      "Escolha se substitui os familiares atuais ou apenas acrescenta. O cliente nunca é apagado.",
      "A gravação é tudo-ou-nada: se falhar, a planilha anterior permanece intacta.",
    ],
    to: "/app/clientes",
    action: "Escolher um caso",
  },
  {
    id: "sessao",
    title: "Conduzir e registrar uma sessão",
    steps: [
      "Na Agenda, abra o atendimento e use “Abrir caso”; voltar mantém a data.",
      "Na aba Sessões, escreva em “Notas da sessão” e salve. As notas são independentes do áudio.",
      "Se gravar áudio, o texto gerado é provisório: só conta como revisado depois de “Li e revisei este texto”.",
      "Ajuste o estado clínico (Agendada → Em atendimento → Registro pendente → Concluída).",
    ],
    to: "/app/agenda",
    action: "Abrir agenda",
  },
  {
    id: "hipoteses",
    title: "Revisar hipóteses com base em evidências",
    steps: [
      "Em Evidências e hipóteses, escolha o caso e marque as evidências que deseja considerar.",
      "Cada hipótese mostra fontes, limites e perguntas — sem diagnóstico nem confiança numérica.",
      "Registre a revisão (faz sentido / contestada / faltam dados). O histórico é salvo por caso e avisa quando a evidência mudou.",
    ],
    to: "/app/ia-clinica",
    action: "Abrir evidências",
  },
  {
    id: "consultar",
    title: "Consultar a biblioteca durante o caso",
    steps: [
      "No dossiê, o botão “Biblioteca” abre a consulta sem sair do caso.",
      "Busque por conceito, autor ou termo; cada verbete mostra a fonte cadastrada.",
      "Conteúdos marcados “ilustrativo” são exemplos, não citações.",
    ],
    to: "/app/biblioteca",
    action: "Abrir biblioteca",
  },
];

function GuiaPage() {
  return (
    <div className="pb-16">
      <DocumentHeader
        breadcrumb="Guia"
        title="Guia de tarefas"
        subtitle="O que fazer, passo a passo, em cada etapa do atendimento."
      />
      <div className="container-liz grid gap-10 lg:grid-cols-[220px_minmax(0,760px)]">
        <nav aria-label="Tarefas" className="space-y-1 self-start lg:sticky lg:top-6">
          {TASKS.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className="flex min-h-11 items-center rounded-md px-3 text-[15px] text-foreground hover:bg-secondary"
            >
              {t.title}
            </a>
          ))}
        </nav>
        <div>
          {TASKS.map((t) => (
            <section id={t.id} key={t.id} className="mb-9 scroll-mt-8 border-b border-border pb-9">
              <h2 className="font-serif text-3xl font-semibold">{t.title}</h2>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-[16px] leading-7 text-foreground">
                {t.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              {t.note && (
                <p className="mt-4 rounded-md border border-forest/30 bg-forest/5 p-3 text-[15px] font-semibold">
                  {t.note}
                </p>
              )}
              <Link
                to={t.to}
                className="mt-5 inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-forest"
              >
                {t.action} <ArrowRight size={16} aria-hidden />
              </Link>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
