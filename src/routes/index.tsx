import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Network, CalendarDays, BookOpen, Users } from "lucide-react";
import { GenealizWordmark } from "@/components/genealiz-wordmark";
import { FamilyAtlasDiagram } from "@/components/family-atlas-diagram";
export const Route = createFileRoute("/")({ component: HomePage });
function HomePage() {
  return (
    <div className="atlas-landing">
      <header className="atlas-public-nav">
        <Link to="/" aria-label="GENEALIZ — Início">
          <GenealizWordmark />
        </Link>
        <nav aria-label="Navegação pública">
          <a href="#plataforma">A plataforma</a>
          <a href="#fluxo">Como funciona</a>
          <Link to="/auth" className="cta-outline">
            Entrar <ArrowRight size={15} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="atlas-hero">
          <div className="atlas-hero-copy">
            <h1>
              Histórias se encontram.
              <br />
              <em>
                Você acompanha
                <br />
                as relações.
              </em>
            </h1>
            <p>
              Um espaço de trabalho para psicogenealogistas: clientes, genossociogramas e
              atendimentos organizados em torno de cada história familiar.
            </p>
            <div className="flex flex-wrap gap-3 mt-9">
              <Link to="/auth" search={{ mode: "signup" }} className="cta-gold">
                Começar meu acompanhamento <ArrowRight size={17} />
              </Link>
              <a href="#plataforma" className="cta-outline">
                Conhecer a plataforma
              </a>
            </div>
          </div>
          <div className="atlas-hero-map">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Genossociograma familiar</span>
              <Network size={18} />
            </div>
            <FamilyAtlasDiagram />
          </div>
        </section>
        <section id="plataforma" className="atlas-public-section">
          <div className="atlas-public-intro">
            <h2>
              O contexto familiar
              <br />
              sempre por perto.
            </h2>
            <p>
              Da preparação da sessão à consulta de referências, cada área tem um lugar claro no seu
              trabalho.
            </p>
          </div>
          <div className="atlas-capabilities">
            {[
              {
                Icon: Network,
                title: "Pessoas e vínculos",
                text: "Registre pessoas, organize relações e consulte os dados de cada integrante no genossociograma.",
              },
              {
                Icon: Users,
                title: "Um dossiê para cada cliente",
                text: "Reúna identificação, anamnese, acontecimentos e registros de sessão no mesmo contexto.",
              },
              {
                Icon: CalendarDays,
                title: "Continuidade dos atendimentos",
                text: "Consulte sua agenda e retome o acompanhamento a partir do dossiê correspondente.",
              },
              {
                Icon: BookOpen,
                title: "Referências para consultar",
                text: "Explore materiais da biblioteca e encontre apoio para organizar seus estudos.",
              },
            ].map((c) => (
              <article key={c.title}>
                <c.Icon size={23} strokeWidth={1.4} />
                <div>
                  <h3>{c.title}</h3>
                  <p>{c.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section id="fluxo" className="atlas-public-section atlas-public-flow">
          <h2>
            Da primeira conversa
            <br />
            ao próximo encontro.
          </h2>
          <ol>
            <li>
              <span>1</span>
              <div>
                <h3>Abra o dossiê</h3>
                <p>Comece pelo cadastro e pelo contexto trazido pelo cliente.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <h3>Organize pessoas e acontecimentos</h3>
                <p>Construa o mapa familiar e registre as informações ao longo do tempo.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <h3>Retome o acompanhamento</h3>
                <p>Consulte as sessões e mantenha a continuidade do trabalho.</p>
              </div>
            </li>
          </ol>
        </section>
        <section className="atlas-public-close">
          <h2>
            Uma história.
            <br />
            Muitas conexões para compreender.
          </h2>
          <Link to="/auth" className="cta-gold">
            Entrar no GENEALIZ <ArrowRight size={17} />
          </Link>
        </section>
      </main>
      <footer className="atlas-public-footer">
        <GenealizWordmark />
        <p>Uma plataforma voltada para psicogenealogistas.</p>
        <Link to="/auth">Acessar minha conta</Link>
      </footer>
    </div>
  );
}
