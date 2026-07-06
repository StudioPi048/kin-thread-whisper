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
  Calendar,
  TreePine,
  History,
  Sparkles,
  Search,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";

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
  { to: "/app/agenda", label: "Agenda", icon: Calendar },
  { to: "/app/genossociogramas", label: "Genossociogramas", icon: TreePine },
  { to: "/app/linha-do-tempo", label: "Linha do tempo", icon: History },
  { to: "/app/biblioteca", label: "Biblioteca", icon: Library },
  { to: "/app/ia-clinica", label: "IA Clínica", icon: Sparkles },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings },
] as const;

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Keydown listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  const { data: searchClients = [] } = useQuery({
    queryKey: ["all-clients-search"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, preferred_name, presenting_complaint, tags")
        .eq("status", "active");
      return data ?? [];
    },
    enabled: isSearchOpen,
  });

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return searchClients;
    const q = searchQuery.toLowerCase().trim();
    return searchClients.filter((c) => {
      const haystack = [
        c.full_name,
        c.preferred_name,
        c.presenting_complaint,
        (c.tags ?? []).join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [searchClients, searchQuery]);

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
        className={`hidden shrink-0 flex-col bg-plum text-white transition-all duration-300 md:flex ${isCollapsed ? "w-[72px]" : "w-72"}`}
      >
        {/* Logo — borda inferior dourada */}
        <div className="flex items-center justify-between border-b-2 border-gold/30 px-4 py-6 h-[90px] shrink-0">
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
            className="shrink-0 rounded p-1.5 text-white/50 hover:bg-white/10 hover:text-gold transition-colors"
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="size-5" />
            ) : (
              <PanelLeftClose className="size-5" />
            )}
          </button>
        </div>

        {/* Busca Rápida */}
        <div className={`px-6 pt-6 pb-2 ${isCollapsed ? "opacity-0 hidden" : "opacity-100"}`}>
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/40 mb-3">
            Menu Principal
          </p>
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center justify-between w-full rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors px-3 py-2 text-[13px] text-white/50 font-medium cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Search className="size-4" />
              <span>Busca rápida...</span>
            </span>
            <kbd className="hidden sm:inline-block rounded bg-white/10 border border-white/10 px-1.5 py-0.5 text-[10px] font-mono">
              ⌘K
            </kbd>
          </button>
        </div>

        {isCollapsed && (
          <div className="pt-6 flex justify-center">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors mb-2 cursor-pointer"
              title="Busca rápida (⌘K)"
            >
              <Search className="size-5" />
            </button>
          </div>
        )}

        {/* Navegação — barra vertical dourada no item ativo */}
        <nav className="flex-1 px-4 space-y-0.5 overflow-y-auto">
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
                  `group relative flex items-center gap-4 py-3.5 text-[14px] font-semibold transition-all duration-150 overflow-hidden rounded-md mx-2 ${isCollapsed ? "px-0 justify-center" : "px-4"} ` +
                  (active
                    ? "text-white bg-white/10 before:absolute before:-left-2 before:top-2 before:bottom-2 before:w-1 before:rounded-r-full before:bg-gold"
                    : "text-white/60 hover:text-white hover:bg-white/5")
                }
              >
                <item.icon
                  className={
                    "size-5 shrink-0 transition-colors " +
                    (active ? "text-gold" : "text-white/45 group-hover:text-white/80")
                  }
                />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Usuário */}
        <div className="border-t-2 border-sidebar-border p-4 shrink-0">
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

      {/* ── COMMAND PALETTE SEARCH MODAL ── */}
      {isSearchOpen && (
        <div
          className="fixed inset-0 z-[999] bg-slate-900/60 backdrop-blur-sm flex justify-center pt-24 px-4"
          onClick={() => setIsSearchOpen(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-border w-full max-w-lg h-fit max-h-[450px] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input search */}
            <div className="relative shrink-0">
              <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Busque clientes por nome, sintoma, trauma, profissão, tag..."
                className="w-full h-12 pl-11 pr-4 bg-transparent border-b border-border text-[14px] text-primary focus:outline-none focus:ring-0 placeholder:text-muted-foreground/60"
              />
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[100px] max-h-[300px]">
              {searchResults.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-muted-foreground font-serif">
                  Nenhum cliente correspondente encontrado.
                </div>
              ) : (
                searchResults.map((c) => (
                  <Link
                    key={c.id}
                    to="/app/clientes/$clientId"
                    params={{ clientId: c.id }}
                    onClick={() => setIsSearchOpen(false)}
                    className="flex flex-col p-3.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer text-left"
                  >
                    <span className="font-serif font-bold text-primary text-[15px]">
                      {c.preferred_name || c.full_name}
                    </span>
                    {c.presenting_complaint && (
                      <span className="text-[12px] text-muted-foreground truncate font-serif mt-0.5">
                        {c.presenting_complaint}
                      </span>
                    )}
                    {c.tags && c.tags.length > 0 && (
                      <div className="flex gap-1.5 mt-1.5">
                        {c.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-muted-foreground px-1.5 py-0.5 rounded"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                ))
              )}
            </div>

            {/* Footer tips */}
            <div className="shrink-0 border-t border-border px-4 py-2.5 flex items-center justify-between text-[11px] text-muted-foreground bg-slate-50">
              <span>Navegue com o mouse e clique para abrir dossiê</span>
              <kbd className="rounded bg-white border border-border px-1.5 py-0.5 font-mono text-[9px]">
                Esc para fechar
              </kbd>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
