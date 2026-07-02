import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, GitBranch, Library, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/")({
  component: AppHome,
});

function AppHome() {
  const { user } = Route.useRouteContext();
  const firstName = (user.email ?? "").split("@")[0];

  return (
    <div className="container-liz py-12">
      <p className="text-xs uppercase tracking-[0.3em] text-gold">Bem-vinda</p>
      <h1 className="mt-3 font-serif text-4xl text-primary md:text-5xl">
        Olá, <em className="italic">{firstName}</em>.
      </h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        Seu consultório digital. Comece cadastrando um cliente ou explore a biblioteca sistêmica.
      </p>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        <Card
          to="/app/clientes"
          icon={Users}
          title="Clientes"
          body="Dossiê completo, mídia e histórico clínico por cliente."
        />
        <Card
          to="/app/clientes"
          icon={GitBranch}
          title="Genossociograma"
          body="Construa a árvore viva do seu caso. Detecção automática de padrões."
        />
        <Card
          to="/app/biblioteca"
          icon={Library}
          title="Biblioteca"
          body="Schützenberger, Jodorowsky, Hellinger — organizados por tema."
        />
      </div>

      <div className="mt-16 rounded-lg border border-border bg-card p-8">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Roadmap beta</p>
        <h2 className="mt-2 font-serif text-2xl text-primary">Próximas entregas</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li>· Dossiê multi-dimensional do cliente (nesta semana)</li>
          <li>· Genossociograma interativo com React Flow</li>
          <li>· Prontuário por voz com transcrição automática</li>
          <li>· Motor de padrões transgeracionais v1</li>
        </ul>
      </div>
    </div>
  );
}

function Card({
  to,
  icon: Icon,
  title,
  body,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-lg border border-border bg-card p-6 transition-colors hover:border-gold"
    >
      <Icon className="size-6 text-primary" />
      <h3 className="mt-6 font-serif text-2xl text-primary">{title}</h3>
      <p className="mt-2 flex-1 text-sm text-muted-foreground">{body}</p>
      <div className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary transition-transform group-hover:translate-x-0.5">
        Abrir <ArrowRight className="size-4" />
      </div>
    </Link>
  );
}
