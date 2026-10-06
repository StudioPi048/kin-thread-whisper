import { createFileRoute, Link } from "@tanstack/react-router";
import { DocumentHeader } from "@/components/ui/document-header";
import { ArrowRight } from "lucide-react";
export const Route = createFileRoute("/_authenticated/app/guia")({ component: GuiaClinicoPage });
const chapters = [
  {
    id: "comecar",
    title: "Comece pelo cliente",
    text: "Crie um cadastro em Clientes e reúna os dados de identificação e o consentimento. O dossiê organiza a árvore familiar, a anamnese, os acontecimentos e as sessões da mesma pessoa.",
    to: "/app/clientes",
    action: "Abrir clientes",
  },
  {
    id: "mapa",
    title: "Construa a história familiar",
    text: "No genossociograma, adicione pessoas e registre os vínculos entre elas. Selecione uma pessoa para consultar sua ficha ou dê dois cliques para editar. A planilha é uma alternativa para revisar o cadastro do grupo familiar.",
    to: "/app/genossociogramas",
    action: "Explorar genossociogramas",
  },
  {
    id: "tempo",
    title: "Situe os acontecimentos no tempo",
    text: "A linha do tempo reúne acontecimentos registrados no caso. Datas e descrições devem manter fidelidade ao relato e às fontes disponíveis. Revise as informações incompletas com a pessoa atendida.",
    to: "/app/linha-do-tempo",
    action: "Abrir linha do tempo",
  },
  {
    id: "sessao",
    title: "Mantenha a continuidade dos atendimentos",
    text: "Use a Agenda para localizar atendimentos e abrir o dossiê correspondente. Na aba Sessões, consulte os registros e documente o acompanhamento. As anotações pertencem ao contexto de cada cliente.",
    to: "/app/agenda",
    action: "Consultar agenda",
  },
  {
    id: "acervo",
    title: "Consulte suas referências",
    text: "A Biblioteca reúne materiais e referências para estudo. Use a busca e os filtros para encontrar o conteúdo e mantenha a distinção entre material de consulta e informação registrada no caso.",
    to: "/app/biblioteca",
    action: "Abrir biblioteca",
  },
  {
    id: "ia",
    title: "Reconheça os limites da IA clínica",
    text: "A tela IA clínica está em modo demonstração, com respostas simuladas. Ela não realiza uma análise individual do cliente. Hipóteses e padrões precisam de revisão profissional e não representam diagnósticos.",
    to: "/app/ia-clinica",
    action: "Ver demonstração",
  },
] as const;
function GuiaClinicoPage() {
  return (
    <div className="pb-16">
      <DocumentHeader
        breadcrumb="Guia"
        title="Um lugar para cada parte da história."
        subtitle="Conheça o fluxo de trabalho do GENEALIZ e encontre o que precisa durante o atendimento."
      />
      <div className="container-liz grid gap-10 lg:grid-cols-[200px_minmax(0,760px)]">
        <nav aria-label="Neste guia" className="space-y-1 lg:sticky lg:top-6 self-start">
          {chapters.map((c) => (
            <a
              key={c.id}
              href={`#${c.id}`}
              className="block rounded-md px-3 py-3 text-sm text-muted-foreground hover:bg-secondary"
            >
              {c.title}
            </a>
          ))}
        </nav>
        <div>
          {chapters.map((c) => (
            <section id={c.id} key={c.id} className="scroll-mt-8 border-b border-border pb-9 mb-9">
              <h2 className="font-serif text-3xl font-semibold">{c.title}</h2>
              <p className="mt-4 text-sm leading-7 text-ink-soft max-w-[70ch]">{c.text}</p>
              <Link to={c.to} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">
                {c.action}
                <ArrowRight size={16} />
              </Link>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
