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
              Monte genossociogramas, organize a agenda e registre as sessões de cada cliente no
              mesmo dossiê.
            </p>
            <Link to="/auth" search={{ mode: "signup" }} className="gv-button gv-button-gold">
              Criar meu espaço <ArrowRight size={18} />
            </Link>
            <a href="#caso-ficticio" className="gv-hero-secondary">
              Ver exemplo fictício <span aria-hidden="true">↓</span>
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
              <Link to="/auth" search={{ mode: "signup" }}>
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
              <a href="#caso-ficticio">
                Ver o mapa do caso fictício <ArrowRight size={18} />
              </a>
            </div>
            <figure className="gv-family-photo">
              <img
                src="/assets/genealiz/archive-hero.jpg"
                alt="Detalhe ilustrativo de mãos reunindo fotografias de diferentes gerações de uma família."
                loading="lazy"
                width={1536}
                height={1024}
              />
              <figcaption>Memórias, pessoas e vínculos. Composição ilustrativa.</figcaption>
            </figure>
          </div>
          <figure
            id="caso-ficticio"
            className="mx-0 my-8 scroll-mt-4 overflow-hidden rounded-lg border border-border bg-card md:my-12"
          >
            <img
              src="/assets/genealiz/editor-demo.webp"
              alt="Editor do genossociograma com três casais em faixas ancestrais e a ficha da tia Teresa aberta."
              width={1150}
              height={666}
              loading="lazy"
              decoding="async"
              className="block h-auto w-full"
            />
            <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-sm text-ink-soft">
              Captura do editor com uma família fictícia.
              <a
                href="/assets/genealiz/editor-demo.webp"
                className="inline-flex min-h-11 items-center gap-2 font-semibold text-forest underline underline-offset-4"
                target="_blank"
                rel="noopener"
              >
                Abrir imagem em tamanho completo <ArrowUpRight size={16} aria-hidden />
              </a>
            </figcaption>
          </figure>
          <div className="gv-feature-pair">
            <article>
              <CalendarDays size={24} />
              <h3>O atendimento tem continuidade.</h3>
              <p>
                Agenda, anamnese e registros de sessão acessíveis a partir do dossiê. Retome o
                acompanhamento com o contexto por perto.
              </p>
              <Link to="/auth" search={{ redirect: "/app/agenda" }}>
                Entrar para acessar a Agenda <ArrowRight size={18} />
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
                <Link to="/auth" search={{ redirect: "/app/biblioteca" }}>
                  Entrar para acessar a Biblioteca <ArrowRight size={18} />
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
