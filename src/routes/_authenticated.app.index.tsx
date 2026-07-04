import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, GitBranch, Library, Users, Calendar, TreePine, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/app/")({
  component: AppHome,
});

function AppHome() {
  const { user } = Route.useRouteContext();

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", "active"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id").eq("status", "active");
      return data ?? [];
    },
  });

  const firstName = profile?.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "terapeuta";

  const stats = [
    { label: "Clientes ativos", value: clients.length, icon: Users, color: "lavender" },
    { label: "Sessões este mês", value: "—", icon: Calendar, color: "gold" },
    { label: "Árvores construídas", value: "—", icon: TreePine, color: "lavender" },
    { label: "Padrões detectados", value: "—", icon: Sparkles, color: "gold" },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="border-b-2 border-border bg-cream px-6 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          Instituto Liz / Início
        </p>
      </div>

      <div className="container-liz py-12">
        {/* Saudação editorial */}
        <div className="mb-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-lavender">
            Bem-vinda de volta
          </p>
          <h1 className="mt-2 font-serif text-5xl font-bold text-primary">
            Bom dia, <em className="italic text-lavender">{firstName}</em>.
          </h1>
          <div className="my-5 h-[3px] w-14 bg-gold" />
          <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Seu consultório digital. Comece cadastrando um cliente ou acesse a árvore de um caso
            ativo.
          </p>
        </div>

        {/* Stats em grid */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-14">
          {stats.map((s) => (
            <div
              key={s.label}
              className={
                "glass-card rounded-[1rem] p-6 flex flex-col gap-3 hover-lift " +
                (s.color === "lavender" ? "accent-bar-lavender" : "accent-bar-gold")
              }
            >
              <div
                className={
                  "flex h-10 w-10 items-center justify-center rounded-md " +
                  (s.color === "lavender" ? "bg-lavender-soft" : "bg-gold-soft")
                }
              >
                <s.icon
                  className={"size-5 " + (s.color === "lavender" ? "text-lavender" : "text-gold")}
                />
              </div>
              <div>
                <p className="font-serif text-5xl font-bold text-primary leading-none">{s.value}</p>
                <p className="mt-1.5 text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {s.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Atalhos de módulos */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
            Acesso rápido
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <ModuleCard
            to="/app/clientes"
            icon={Users}
            title="Clientes"
            body="Dossiê completo, mídia e histórico clínico por cliente."
            color="lavender"
          />
          <ModuleCard
            to="/app/clientes"
            icon={GitBranch}
            title="Genossociograma"
            body="Construa a árvore viva do seu caso. Detecção automática de padrões."
            color="gold"
          />
          <ModuleCard
            to="/app/biblioteca"
            icon={Library}
            title="Biblioteca"
            body="Schützenberger, Jodorowsky, Hellinger — organizados por tema."
            color="lavender"
          />
        </div>
      </div>
    </div>
  );
}

function ModuleCard({
  to,
  icon: Icon,
  title,
  body,
  color,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  color: "lavender" | "gold";
}) {
  return (
    <Link
      to={to}
      className={
        "group flex flex-col glass-card rounded-[1rem] p-6 hover-lift " +
        (color === "lavender"
          ? "border-l-[5px] border-l-transparent hover:border-l-lavender"
          : "border-l-[5px] border-l-transparent hover:border-l-gold")
      }
    >
      <div
        className={
          "flex h-10 w-10 items-center justify-center rounded-md mb-5 " +
          (color === "lavender" ? "bg-lavender-soft" : "bg-gold-soft")
        }
      >
        <Icon className={"size-5 " + (color === "lavender" ? "text-lavender" : "text-gold")} />
      </div>
      <h3 className="font-serif text-2xl font-bold text-primary">{title}</h3>
      <p className="mt-2 flex-1 text-[14px] leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.08em] text-primary/60 transition-colors group-hover:text-lavender">
        Abrir <ArrowRight className="size-4" />
      </div>
    </Link>
  );
}
