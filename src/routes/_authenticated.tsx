import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, LogOut, Users, Library, Settings, GitBranch, Mic } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { LizLogoLockup } from "@/components/liz-logo";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

const nav = [
  { to: "/app", label: "Início", icon: Home, exact: true },
  { to: "/app/clientes", label: "Clientes", icon: Users },
  { to: "/app/biblioteca", label: "Biblioteca", icon: Library },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings },
] as const;

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const location = useLocation();

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const displayName = profile?.full_name ?? user.email ?? "";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── SIDEBAR ────────────────────────────────────── */}
      <aside className="hidden w-72 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        {/* Logo — borda inferior dourada */}
        <Link to="/app" className="flex items-center gap-3 border-b-2 border-gold/30 px-6 py-6">
          <LizLogoLockup variant="light" />
        </Link>

        {/* Label de seção */}
        <div className="px-6 pt-6 pb-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-sidebar-foreground/30">
            Menu Principal
          </p>
        </div>

        {/* Navegação — barra vertical dourada no item ativo */}
        <nav className="flex-1 px-4 space-y-0.5">
          {nav.map((item) => {
            const active = ("exact" in item && item.exact)
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to as "/app"}
                className={
                  "group relative flex items-center gap-4 px-4 py-4 text-[15px] font-semibold transition-all duration-150 " +
                  (active
                    ? "text-sidebar-foreground bg-sidebar-accent before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r-full before:bg-gold"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50")
                }
              >
                <item.icon
                  className={
                    "size-5 shrink-0 transition-colors " +
                    (active
                      ? "text-gold"
                      : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground/80")
                  }
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Separador */}
        <div className="mx-4 my-2 h-px bg-sidebar-border" />

        {/* Ferramentas em desenvolvimento */}
        <div className="px-4 pb-3">
          <p className="px-4 pb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-sidebar-foreground/28">
            Em desenvolvimento
          </p>
          {[
            { icon: Mic, label: "Prontuário por voz" },
            { icon: GitBranch, label: "Motor de padrões" },
          ].map((t) => (
            <div
              key={t.label}
              className="flex items-center gap-4 px-4 py-3.5 text-[14px] text-sidebar-foreground/28 cursor-not-allowed"
            >
              <t.icon className="size-5 shrink-0" />
              <span>{t.label}</span>
              <span className="ml-auto rounded border border-gold/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold/60">
                breve
              </span>
            </div>
          ))}
        </div>

        {/* Usuário */}
        <div className="border-t-2 border-sidebar-border p-4">
          <div className="flex items-center gap-3 rounded-md bg-sidebar-accent/60 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-lavender text-[12px] font-bold text-white">
              {initials || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-sidebar-foreground">
                {displayName}
              </p>
              <p className="truncate text-[11px] text-sidebar-foreground/45">{user.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="shrink-0 rounded p-1.5 text-sidebar-foreground/40 transition-colors hover:bg-sidebar-border hover:text-sidebar-foreground"
              title="Sair da plataforma"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── CONTEÚDO ───────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex h-16 items-center justify-between border-b-2 border-border bg-sidebar px-4 md:hidden">
          <Link to="/app" className="flex items-center gap-2">
            <LizLogoLockup variant="light" />
          </Link>
          <button
            onClick={handleSignOut}
            className="rounded p-2 text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <LogOut className="size-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
