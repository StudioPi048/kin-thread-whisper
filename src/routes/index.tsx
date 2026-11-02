import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CalendarDays,
  BookOpen,
  Network,
  FolderOpen,
} from "lucide-react";
import { GenealizWordmark } from "@/components/genealiz-wordmark";
import { GenogramDemo } from "@/components/landing/genogram-demo";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GENEALIZ — espaço de trabalho em psicogenealogia" },
      {
        name: "description",
        content: "Genossociograma, anamnese, linha do tempo e sessões de cada caso em um só lugar.",
      },
      { property: "og:title", content: "GENEALIZ — espaço de trabalho em psicogenealogia" },
      {
        property: "og:description",
        content: "Genossociograma com cliente no topo, anamnese, linha do tempo e sessões.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});
function Index() {
  return (
    <div className="gv-public">
      <header className="gv-public-nav">
        <Link to="/" aria-label="GENEALIZ — início">
          <GenealizWordmark />
        </Link>
        <nav aria-label="Navegação pública">
          <a href="#plataforma">A plataforma</a>
          <a href="#pratica">Na sua prática</a>
          <Link to="/auth">
            Entrar <ArrowUpRight size={16} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="gv-hero">
          <img
            src="/assets/genealiz/archive-hero.jpg"
            alt="Mãos organizam fotografias de diferentes gerações em um arquivo familiar; composição ilustrativa."
            fetchPriority="high"
            className="gv-hero-image"
          />
          <div className="gv-hero-copy">
            <span className="gv-category">Psicogenealogia · espaço de trabalho</span>
            <h1>
              Toda história
              <br />
              começa <em>antes.</em>
            </h1>
            <p>
              Conecte histórias familiares. Organize seus atendimentos. Tenha espaço para escutar.
            </p>
            <Link to="/auth" search={{ mode: "signup" }} className="gv-button gv-button-gold">
              Criar meu espaço <ArrowRight size={18} />
            </Link>
            <a href="#plataforma" className="gv-hero-secondary">
              Explore a plataforma <span>↓</span>
            </a>
          </div>
          <div className="gv-hero-foot">
            <span>Da memória familiar ao acompanhamento.</span>
            <span>GENEALIZ / Arquivo vivo</span>
          </div>
        </section>
        <section className="gv-intro" id="plataforma">
          <div>
            <span className="gv-category">Um lugar para reunir os fios</span>
            <h2>
              A história é complexa.
              <br />
              Seu espaço de trabalho
              <br />
              pode ser <em>claro.</em>
            </h2>
          </div>
          <div>
            <p>
              Uma data anotada. Um vínculo que ganha contexto. Uma conversa que precisa ser
              retomada. Na GENEALIZ, essas informações encontram seu lugar.
            </p>
            <p>
              Um ambiente pensado para psicogenealogistas acompanharem pessoas, relações e
              acontecimentos ao longo das sessões.
            </p>
            <div className="gv-text-links">
              <Link to="/auth">
                Abrir minha conta <ArrowUpRight size={17} />
              </Link>
              <a href="#pratica">
                Veja como se organiza <ArrowRight size={17} />
              </a>
            </div>
          </div>
        </section>
        <section className="gv-product-story" id="pratica">
          <div className="gv-story-heading">
            <h2>
              Do primeiro registro
              <br />à próxima conversa.
            </h2>
            <p>
              Ferramentas que acompanham o seu trabalho,
              <br />
              com cada informação no seu contexto.
            </p>
          </div>
          <div className="gv-feature-primary">
            <div className="gv-feature-copy">
              <Network size={26} />
              <h3>
                Uma família.
                <br />
                Muitas histórias conectadas.
              </h3>
              <p>
                Construa o genossociograma, consulte a ficha de cada pessoa e alterne para a
                planilha quando precisar registrar mais informações.
              </p>
              <ul>
                <li>
                  <Check size={16} />
                  Cliente no topo, ancestralidade abaixo
                </li>
                <li>
                  <Check size={16} />
                  Pessoas e uniões no mesmo mapa
                </li>
                <li>
                  <Check size={16} />
                  Nome, datas e observações por integrante
                </li>
              </ul>
              <Link to="/auth">
                Explorar os genossociogramas <ArrowUpRight size={18} />
              </Link>
            </div>
            <GenogramDemo />
          </div>
          <div className="gv-feature-pair">
            <article>
              <CalendarDays size={24} />
              <h3>O atendimento tem continuidade.</h3>
              <p>
                Agenda, anamnese e registros de sessão acessíveis a partir do dossiê. Retome o
                acompanhamento com o contexto por perto.
              </p>
              <Link to="/auth">
                Organizar atendimentos <ArrowRight size={18} />
              </Link>
            </article>
            <article className="gv-library-feature">
              <img
                src="/assets/genealiz/archive-library.jpg"
                alt="Livros e uma fotografia familiar sobre papel, composição ilustrativa."
                loading="lazy"
              />
              <div>
                <BookOpen size={24} />
                <h3>Conhecimento à mão.</h3>
                <p>
                  Consulte conceitos, autores e referências na biblioteca enquanto desenvolve sua
                  prática.
                </p>
                <Link to="/auth">
                  Conhecer a biblioteca <ArrowRight size={18} />
                </Link>
              </div>
            </article>
          </div>
        </section>
        <section className="gv-closing">
          <FolderOpen size={32} />
          <h2>
            Mais presença na escuta.
            <br />
            <em>Mais clareza nos registros.</em>
          </h2>
          <p>
            Prepare o seu espaço de trabalho em psicogenealogia. O cadastro é por e-mail ou Google.
          </p>
          <Link to="/auth" search={{ mode: "signup" }} className="gv-button gv-button-gold">
            Criar minha conta <ArrowRight size={18} />
          </Link>
        </section>
      </main>
      <footer className="gv-footer">
        <GenealizWordmark />
        <p>Histórias, relações e continuidade.</p>
        <Link to="/auth">
          Acessar a plataforma <ArrowUpRight size={16} />
        </Link>
      </footer>
    </div>
  );
}
