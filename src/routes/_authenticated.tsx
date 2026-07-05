import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Home,
  LogOut,
  Users,
  Library,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { LizLogoLockup, LizLogo } from "@/components/liz-logo";

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
  const [isCollapsed, setIsCollapsed] = useState(false);

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
      <aside
        className={`hidden shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 md:flex ${isCollapsed ? "w-[72px]" : "w-72"}`}
      >
        {/* Logo — borda inferior dourada */}
        <div className="flex items-center justify-between border-b-2 border-gold/30 px-4 py-6 h-[90px]">
          <Link
            to="/app"
            className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? "opacity-0 w-0 hidden" : "opacity-100"}`}
          >
            <LizLogoLockup variant="light" />
          </Link>
          {isCollapsed && (
            <Link to="/app" className="mx-auto">
              <LizLogo size={32} />
            </Link>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="shrink-0 rounded p-1.5 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-gold transition-colors"
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="size-5" />
            ) : (
              <PanelLeftClose className="size-5" />
            )}
          </button>
        </div>

        {/* Label de seção */}
        <div className={`px-6 pt-6 pb-2 ${isCollapsed ? "opacity-0 hidden" : "opacity-100"}`}>
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-sidebar-foreground/30">
            Menu Principal
          </p>
        </div>

        {/* Espaçamento extra quando colapsado para compensar a label escondida */}
        {isCollapsed && <div className="pt-6" />}

        {/* Navegação — barra vertical dourada no item ativo */}
        <nav className="flex-1 px-4 space-y-0.5">
          {nav.map((item) => {
            const active =
              "exact" in item && item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to as "/app"}
                title={isCollapsed ? item.label : undefined}
                className={
                  `group relative flex items-center gap-4 py-4 text-[15px] font-semibold transition-all duration-150 overflow-hidden ${isCollapsed ? "px-0 justify-center" : "px-4"} ` +
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
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Usuário */}
        <div className="border-t-2 border-sidebar-border p-4">
          <div
            className={`flex items-center gap-3 rounded-md bg-sidebar-accent/60 ${isCollapsed ? "justify-center p-2" : "p-3"}`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-lavender text-[12px] font-bold text-white">
              {initials || "?"}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-sidebar-foreground">
                  {displayName}
                </p>
                <p className="truncate text-[11px] text-sidebar-foreground/45">{user.email}</p>
              </div>
            )}
            <button
              onClick={handleSignOut}
              className={`shrink-0 rounded p-1.5 text-sidebar-foreground/40 transition-colors hover:bg-sidebar-border hover:text-sidebar-foreground ${isCollapsed && "hidden"}`}
              title="Sair da plataforma"
            >
              <LogOut className="size-4" />
            </button>
          </div>
          {isCollapsed && (
            <button
              onClick={handleSignOut}
              className="w-full mt-2 flex justify-center rounded p-2 text-sidebar-foreground/40 transition-colors hover:bg-sidebar-border hover:text-red-400"
              title="Sair da plataforma"
            >
              <LogOut className="size-4" />
            </button>
          )}
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

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0 relative z-0">
          <Outlet />
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-sidebar border-t border-sidebar-border flex items-center justify-around z-50 px-2 safe-area-pb">
          {nav.map((item) => {
            const active =
              "exact" in item && item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to as "/app"}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                  active ? "text-gold" : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="size-5" />
                <span className="text-[10px] font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
