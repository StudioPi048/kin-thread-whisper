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
import { workspaceDestination } from "../lib/auth-destination";
import { supabase } from "@/integrations/supabase/client";
import { GenealizWordmark } from "@/components/genealiz-wordmark";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <GenealizWordmark />
        <h1 className="mt-6 font-serif text-7xl text-primary">404</h1>
        <h2 className="mt-4 font-serif text-2xl text-foreground">
          Esta página não consta no arquivo
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço que você procura não existe ou foi movido.
        </p>
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
        <GenealizWordmark />
        <h1 className="mt-6 font-serif text-3xl text-foreground">Esta página não carregou</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tente carregar de novo. Se o problema continuar, volte ao início.
        </p>
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
      { title: "GENEALIZ — Psicogenealogia" },
      {
        name: "description",
        content:
          "Clientes, relações familiares e atendimentos em um espaço de trabalho para psicogenealogistas.",
      },
      { property: "og:title", content: "GENEALIZ — Psicogenealogia" },
      {
        property: "og:description",
        content: "Organize pessoas, vínculos e registros de acompanhamento.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png", sizes: "64x64" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
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
    let userId: string | null | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let clearQueries = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user.id ?? null;
      if (event === "INITIAL_SESSION" || event === "PASSWORD_RECOVERY") {
        if (userId === undefined) userId = nextUserId;
        return;
      }
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (event !== "USER_UPDATED" && userId === nextUserId) return;
      clearQueries ||= event === "SIGNED_OUT" || (userId != null && userId !== nextUserId);
      userId = nextUserId;

      // Leave the auth callback before running loaders or queries that read auth again.
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (clearQueries) {
          queryClient.clear();
          clearQueries = false;
        }
        const location = router.state.resolvedLocation ?? router.state.location;
        if (!workspaceDestination(location.href)) return;
        void router.invalidate();
        if (userId) void queryClient.invalidateQueries();
      }, 0);
    });
    return () => {
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
