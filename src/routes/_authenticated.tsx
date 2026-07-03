import { createFileRoute, Link, Outlet, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Home,
  LogOut,
  Users,
  Library,
  Settings,
  GitBranch,
  Mic,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LizLogoLockup, LizLogo } from "@/components/liz-logo";

// Integration-managed auth gate. ssr:false because Supabase session lives in localStorage.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

const nav: Array<{ to: string; label: string; icon: typeof Home; exact?: boolean }> = [
  { to: "/app",           label: "Início",         icon: Home,      exact: true },
  { to: "/app/clientes",  label: "Clientes",        icon: Users },
  { to: "/app/biblioteca",label: "Biblioteca",      icon: Library },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings },
];

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
    await queryClient.cancelQueries();
    queryClient.clear();
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
      {/* ── SIDEBAR ─────────────────────────────────────── */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">

        {/* Logo */}
        <Link
          to="/app"
          className="flex items-center gap-3 border-b border-sidebar-border px-6 py-6"
        >
          <LizLogoLockup variant="light" />
        </Link>

        {/* Nav items */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {nav.map((item) => {
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to as "/app"}
                className={
                  "group flex items-center gap-4 rounded-xl px-4 py-3.5 text-[15px] font-medium transition-all duration-150 " +
                  (active
                    ? "bg-gold text-[oklch(0.15_0.02_240)] shadow-sm"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground")
                }
              >
                <item.icon
                  className={
                    "size-5 shrink-0 transition-colors " +
                    (active ? "text-[oklch(0.15_0.02_240)]" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground")
                  }
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Separador com label */}
        <div className="px-4 pb-2">
          <p className="px-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/40">
            Ferramentas
          </p>
          <div className="mt-2 space-y-1">
            <button
              disabled
              className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-[14px] text-sidebar-foreground/40 cursor-not-allowed"
            >
              <Mic className="size-5" />
              Prontuário por voz
              <span className="ml-auto rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold uppercase tracking-wide">Em breve</span>
            </button>
            <button
              disabled
              className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-[14px] text-sidebar-foreground/40 cursor-not-allowed"
            >
              <GitBranch className="size-5" />
              Motor de padrões
              <span className="ml-auto rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold uppercase tracking-wide">Em breve</span>
            </button>
          </div>
        </div>

        {/* User section */}
        <div className="border-t border-sidebar-border p-4 mt-2">
          <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent p-3">
            {/* Avatar */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-[13px] font-bold text-[oklch(0.15_0.02_240)]">
              {initials || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-sidebar-foreground">
                {displayName}
              </p>
              <p className="truncate text-[12px] text-sidebar-foreground/55">
                {user.email}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="shrink-0 rounded-lg p-2 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-border hover:text-sidebar-foreground"
              title="Sair da plataforma"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── CONTEÚDO PRINCIPAL ──────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:hidden">
          <Link to="/app" className="flex items-center gap-2">
            <LizLogo size={28} />
            <span className="font-serif text-xl text-primary">Instituto Liz</span>
          </Link>
          <Button onClick={handleSignOut} variant="ghost" size="icon-sm">
            <LogOut className="size-5" />
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
