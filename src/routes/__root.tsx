import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { GenealogicalMark } from "@/components/ui/narrative-connector";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-material-bronze">Instituto Liz</p>
        <h1 className="mt-6 font-serif text-7xl text-primary">404</h1>
        <h2 className="mt-4 font-serif text-2xl text-foreground">
          Esta página não consta no arquivo
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço que você procura não existe ou foi movido.
        </p>
        <div className="mt-6 flex justify-center">
          <GenealogicalMark size={28} opacity={0.25} />
        </div>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-material-bronze">Instituto Liz</p>
        <h1 className="mt-6 font-serif text-3xl text-foreground">Esta página não carregou</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O erro foi do nosso lado, não do seu. Tente novamente — se persistir, volte ao início.
        </p>
        <div className="mt-6 flex justify-center">
          <GenealogicalMark size={28} opacity={0.25} />
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Instituto Liz — Plataforma de Psicogenealogia" },
      {
        name: "description",
        content:
          "O segundo cérebro do psicogenealogista. Dossiê clínico, genossociograma vivo, detecção de padrões transgeracionais e copiloto de IA para profissionais.",
      },
      { name: "author", content: "Instituto Liz" },
      { property: "og:title", content: "Instituto Liz — Plataforma de Psicogenealogia" },
      {
        property: "og:description",
        content:
          "Infraestrutura digital para psicogenealogistas: genossociograma, padrões transgeracionais, prontuário por voz.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Instituto Liz — Plataforma de Psicogenealogia" },
      {
        name: "description",
        content:
          "O segundo cérebro do psicogenealogista. Dossiê clínico, genossociograma vivo, detecção de padrões transgeracionais e copiloto de IA para profissionais.",
      },
      {
        property: "og:description",
        content:
          "O segundo cérebro do psicogenealogista. Dossiê clínico, genossociograma vivo, detecção de padrões transgeracionais e copiloto de IA para profissionais.",
      },
      {
        name: "twitter:description",
        content:
          "O segundo cérebro do psicogenealogista. Dossiê clínico, genossociograma vivo, detecção de padrões transgeracionais e copiloto de IA para profissionais.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5748bc5e-8a61-4e67-9e19-f17bac3a0120/id-preview-14615d19--0bbf5716-9319-44ef-94e7-0852e32026e1.lovable.app-1782999354814.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5748bc5e-8a61-4e67-9e19-f17bac3a0120/id-preview-14615d19--0bbf5716-9319-44ef-94e7-0852e32026e1.lovable.app-1782999354814.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
