import { CatchBoundary, createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ComponentType, MouseEvent } from "react";
import { GenealizWordmark } from "@/components/genealiz-wordmark";
import "@/landing.css";

const pageTitle = "Genealiz — Genossociogramas para a psicogenealogia";
const pageDescription =
  "Monte a árvore familiar, acompanhe acontecimentos e registre cada atendimento em um só dossiê. Experimente o Genealiz com uma família fictícia.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const [Demo, setDemo] = useState<ComponentType | null>(null);
  const [demoState, setDemoState] = useState<"idle" | "loading" | "error">("idle");
  const demoHeading = useRef<HTMLHeadingElement>(null);
  const demoLoading = useRef(false);
  const demoLoaded = useRef(false);

  useEffect(() => {
    function openFromHash() {
      if (window.location.hash === "#caso-ficticio") void loadDemo();
    }

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  async function loadDemo() {
    if (demoLoaded.current || demoLoading.current) return;

    demoLoading.current = true;
    setDemoState("loading");
    try {
      const module = await import("@/components/demo/consultante-demo");
      demoLoaded.current = true;
      setDemo(() => module.default);
      setDemoState("idle");
    } catch {
      setDemoState("error");
    } finally {
      demoLoading.current = false;
    }
  }

  function openDemo() {
    demoHeading.current?.focus({ preventScroll: true });
    void loadDemo();
  }

  function followDemoLink(event: MouseEvent<HTMLAnchorElement>) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    openDemo();
  }

  return (
    <div className="genealiz-public">
      <a href="#conteudo-publico" className="atlas-skip">
        Pular para o conteúdo
      </a>
      <header className="public-masthead">
        <div className="public-wrap">
          <Link to="/" className="public-brand" aria-label="Genealiz — início">
            <GenealizWordmark />
          </Link>
          <nav aria-label="Navegação pública">
            <a href="#pratica" className="public-nav-detail">
              Como funciona
            </a>
            <a href="#caso-ficticio" className="public-nav-detail" onClick={followDemoLink}>
              Demonstração
            </a>
            <Link to="/auth" className="public-signin">
              Entrar <ArrowUpRight size={17} aria-hidden />
            </Link>
          </nav>
        </div>
      </header>

      <main id="conteudo-publico">
        <section className="public-intro public-wrap" aria-labelledby="public-title">
          <div className="public-intro-copy">
            <h1 id="public-title">
              <span>Genossociogramas</span> <span>para a prática em</span> <em>psicogenealogia.</em>
            </h1>
            <p>
              Monte a árvore familiar, acompanhe acontecimentos e registre cada atendimento em um só
              dossiê.
            </p>
            <div className="public-actions">
              <a className="public-button" href="#caso-ficticio" onClick={followDemoLink}>
                Explorar caso fictício <ArrowDown size={17} aria-hidden />
              </a>
              <Link to="/auth" search={{ mode: "signup" }} className="public-text-link">
                Criar conta <ArrowUpRight size={16} aria-hidden />
              </Link>
            </div>
          </div>
          <figure className="public-intro-photo">
            <img
              src="/assets/genealiz/archive-hero.webp"
              srcSet="/assets/genealiz/archive-hero-768.webp 768w, /assets/genealiz/archive-hero.webp 1536w"
              sizes="(max-width: 760px) 100vw, (max-width: 1450px) 53vw, 720px"
              width={1536}
              height={1024}
              alt="Mãos organizam fotografias de três gerações em um álbum."
              fetchPriority="high"
            />
            <figcaption>
              <span>Toda história começa antes.</span>
              <span>Composição ilustrativa</span>
            </figcaption>
          </figure>
        </section>

        <section id="caso-ficticio" className="public-case" aria-labelledby="public-case-title">
          <div className="public-wrap">
            <div className="public-section-heading">
              <h2 ref={demoHeading} tabIndex={-1} id="public-case-title">
                Uma família, duas uniões.
              </h2>
              <p>
                Experimente com uma família fictícia. Localize Sofia e confira os filhos de cada
                união de Mariana. Revise uma filiação, desfaça e observe a mesma árvore em 2D e 3D.
              </p>
            </div>
            {Demo ? (
              <CatchBoundary
                getResetKey={() => "consultante-demo"}
                errorComponent={({ reset }) => (
                  <div className="public-case-launch">
                    <p role="alert">
                      Houve um erro no exercício. Você pode reiniciar o caso fictício.
                    </p>
                    <button type="button" className="public-button" onClick={reset}>
                      Reiniciar exercício <ArrowRight size={17} aria-hidden />
                    </button>
                  </div>
                )}
              >
                <Demo />
              </CatchBoundary>
            ) : (
              <div className="public-case-launch">
                {demoState === "error" && (
                  <p role="alert">O exercício não carregou. Tente abrir novamente.</p>
                )}
                {demoState === "loading" && <p role="status">Carregando o caso fictício…</p>}
                <button
                  type="button"
                  className="public-button"
                  onClick={openDemo}
                  disabled={demoState === "loading"}
                >
                  {demoState === "error" ? "Tentar novamente" : "Abrir exercício"}
                  <ArrowRight size={17} aria-hidden />
                </button>
                <span>Sem cadastro. Alterações salvas só enquanto o exercício está aberto.</span>
              </div>
            )}
          </div>
        </section>

        <section
          id="pratica"
          className="public-practice public-wrap"
          aria-labelledby="public-practice-title"
        >
          <h2 id="public-practice-title">Da primeira sessão ao retorno.</h2>
          <ol className="public-practice-list">
            <li>
              <h3>Monte o mapa da família.</h3>
              <p>
                Registre pessoas e vínculos pela planilha ou no mapa. A árvore parte do consultante
                e dos irmãos de sangue, com as gerações ancestrais abaixo.
              </p>
            </li>
            <li>
              <h3>Registre o atendimento.</h3>
              <p>
                Reúna a anamnese, os acontecimentos e as notas de sessão no mesmo dossiê. Consulte a
                linha do tempo ao lado dos registros.
              </p>
            </li>
            <li>
              <h3>Volte à origem da informação.</h3>
              <p>
                Abra a ficha de um familiar, confira a fonte de um acontecimento e retome o que
                ficou para revisar na próxima sessão.
              </p>
            </li>
          </ol>
        </section>

        <section id="plataforma" className="public-method" aria-labelledby="public-method-title">
          <div className="public-wrap">
            <img
              src="/assets/genealiz/manual-edicao-portuguesa.webp"
              width={560}
              height={848}
              alt="Capa do Manual de Psicogenealogia, de Letícia Kuchockowolec Baccin."
              loading="lazy"
              decoding="async"
            />
            <div>
              <h2 id="public-method-title">Um espaço de trabalho do Instituto Liz.</h2>
              <p>
                A convenção do genossociograma tem como referência o Manual da Psicogenealogia, de
                Letícia K. Baccin. Na plataforma, o mapa, a ficha e a linha do tempo ficam ligados
                para acompanhar cada caso.
              </p>
              <Link to="/auth" search={{ mode: "signup" }} className="public-text-link">
                Criar conta <ArrowUpRight size={17} aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="public-footer">
        <div className="public-wrap">
          <Link to="/" className="public-brand" aria-label="Genealiz — início">
            <GenealizWordmark />
          </Link>
          <p>Instituto Liz</p>
          <nav aria-label="Acesso e conta">
            <a href="#caso-ficticio" onClick={followDemoLink}>
              Demonstração
            </a>
            <Link to="/auth" search={{ redirect: "/app/guia" }}>
              Guia no aplicativo
            </Link>
            <Link to="/auth">Entrar</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
