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
  Calendar,
  TreePine,
  History,
  Sparkles,
  Search,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  MoreHorizontal,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";

import { supabase } from "@/integrations/supabase/client";
import { LizLogoLockup, LizLogo } from "@/components/liz-logo";
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

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
  { to: "/app", label: "Mesa Clínica", shortLabel: "Mesa", icon: Home, exact: true },
  { to: "/app/clientes", label: "Clientes", shortLabel: "Clientes", icon: Users },
  { to: "/app/agenda", label: "Agenda", shortLabel: "Agenda", icon: Calendar },
  { to: "/app/genossociogramas", label: "Genossociogramas", shortLabel: "Árvores", icon: TreePine },
  { to: "/app/linha-do-tempo", label: "Linhas de Herança", shortLabel: "Tempo", icon: History },
  { to: "/app/biblioteca", label: "Biblioteca", shortLabel: "Livros", icon: Library },
  { to: "/app/ia-clinica", label: "Segundo Cérebro", shortLabel: "IA", icon: Sparkles },
  { to: "/app/guia", label: "Manual Clínico", shortLabel: "Manual", icon: BookOpen },
  { to: "/app/configuracoes", label: "Configurações", shortLabel: "Ajustes", icon: Settings },
] as const;

/** Itens fixos da navegação inferior (mobile). Os demais abrem na gaveta "Mais". */
const mobilePrimary = nav.slice(0, 4);
const mobileSecondary = nav.slice(4);

function isNavActive(item: (typeof nav)[number], pathname: string) {
  return "exact" in item && item.exact ? pathname === item.to : pathname.startsWith(item.to);
}

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMoreOpen, setIsMoreOpen] = useState(false);

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

  // Fecha a gaveta "Mais" ao trocar de rota
  useEffect(() => {
    setIsMoreOpen(false);
  }, [location.pathname]);

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
    <div className="flex min-h-screen font-sans">
      {/* Link de pulo para leitores de tela / teclado */}
      <a
        href="#conteudo"
        className="sr-only z-[1000] rounded-md bg-forest px-4 py-2 text-sm font-semibold text-cream focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>

      {/* ═══════════════════════════════════════════════════
          SIDEBAR — desktop (≥lg), 220px premium
          ═══════════════════════════════════════════════════ */}
      <aside
        className={`relative z-40 hidden shrink-0 flex-col overflow-hidden bg-gradient-to-b from-forest via-forest to-[#0D1F15] shadow-[7px_0_28px_-6px_rgba(12,24,18,0.5),1px_0_0_rgba(201,162,75,0.18)] transition-[width,min-width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:flex ${
          isCollapsed ? "w-[68px] min-w-[68px]" : "w-[210px] min-w-[210px]"
        }`}
      >
        {/* Brilho de lombada no topo + filete dourado na borda direita */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(170deg,rgba(255,255,255,0.05)_0%,transparent_42%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-0 w-px bg-gradient-to-b from-transparent via-gold/25 to-transparent"
        />

        {/* ── Logo ─────────────────────────────── */}
        <div
          className={`relative z-10 flex min-h-[72px] items-center border-b border-white/[0.07] ${
            isCollapsed ? "justify-center px-0 py-5" : "justify-between px-5 py-5"
          }`}
        >
          {!isCollapsed && (
            <Link to="/app" className="flex items-center overflow-hidden">
              <LizLogoLockup variant="light" />
            </Link>
          )}
          {isCollapsed && (
            <Link to="/app">
              <LizLogo size={28} />
            </Link>
          )}
          {/* Collapse toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
            className={`flex size-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-cream/50 transition-colors duration-200 hover:border-gold/20 hover:bg-gold/12 hover:text-gold/90 ${
              isCollapsed ? "absolute -right-3 -bottom-3 z-20" : ""
            }`}
          >
            {isCollapsed ? (
              <ChevronRight className="size-[13px]" strokeWidth={2} />
            ) : (
              <ChevronLeft className="size-[13px]" strokeWidth={2} />
            )}
          </button>
        </div>

        {/* ── Busca Rápida ─────────────────────── */}
        {!isCollapsed && (
          <div className="relative z-10 px-4 pt-4 pb-2">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex w-full items-center justify-between rounded-lg border border-white/[0.08] bg-white/5 px-3 py-2 text-xs text-cream/40 transition-colors duration-200 hover:bg-white/[0.08] hover:text-cream/65"
            >
              <span className="flex items-center gap-[7px]">
                <Search className="size-3" strokeWidth={1.5} />
                <span>Busca rápida...</span>
              </span>
              <kbd className="rounded border border-white/10 bg-white/[0.08] px-[5px] py-px font-mono text-[9px] tracking-[0.05em]">
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        {/* ── Ícone de busca (collapsed) ─────── */}
        {isCollapsed && (
          <div className="relative z-10 flex justify-center px-0 pt-3 pb-1">
            <button
              onClick={() => setIsSearchOpen(true)}
              title="Busca rápida (⌘K)"
              aria-label="Busca rápida (⌘K)"
              className="flex size-9 items-center justify-center rounded-lg bg-transparent text-cream/40 transition-colors duration-200 hover:bg-white/[0.08] hover:text-cream/80"
            >
              <Search className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* ── Eyebrow label ────────────────────── */}
        {!isCollapsed && (
          <div className="relative z-10 px-5 pt-1 pb-1.5">
            <span className="text-[9px] font-extrabold tracking-[0.18em] text-cream/22 uppercase">
              Navegação
            </span>
          </div>
        )}

        {/* ── Navegação ─────────────────────────── */}
        <nav className="relative z-10 flex flex-1 flex-col gap-px overflow-x-hidden overflow-y-auto px-2.5 py-1">
          {nav.map((item) => {
            const active = isNavActive(item, location.pathname);

            return (
              <Link
                key={item.to}
                to={item.to as "/app"}
                title={isCollapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className={`group relative flex items-center gap-2.5 rounded-lg text-[13.5px] tracking-[0.005em] no-underline transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isCollapsed ? "justify-center py-2.5" : "justify-start px-3 py-2.5"
                } ${
                  active
                    ? "bg-gold/14 font-semibold text-gold/95"
                    : "font-medium text-cream/55 hover:bg-white/[0.06] hover:text-cream/88"
                }`}
              >
                {/* Barra lateral de ativo */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-y-1.5 left-0 w-[2.5px] rounded-r-[2px] bg-gold shadow-[0_0_8px_rgba(212,168,67,0.5)]"
                  />
                )}
                {/* Ícone com microanimação */}
                <item.icon
                  className={`size-[17px] shrink-0 transition-[transform,opacity] duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    active
                      ? "text-gold opacity-100"
                      : "opacity-55 group-hover:rotate-3 group-hover:scale-110 group-hover:opacity-90"
                  }`}
                  strokeWidth={active ? 1.75 : 1.5}
                />
                {/* Label */}
                {!isCollapsed && (
                  <span
                    className={`transition-transform duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      active ? "" : "group-hover:translate-x-px"
                    }`}
                  >
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── Usuário ──────────────────────────── */}
        <div
          className={`relative z-10 border-t border-white/[0.07] ${
            isCollapsed ? "px-2 py-3" : "px-3.5 py-3"
          }`}
        >
          <div
            className={`flex items-center rounded-lg bg-white/[0.04] p-1.5 ${
              isCollapsed ? "justify-center gap-0" : "justify-start gap-2.5"
            }`}
          >
            {/* Avatar */}
            <div className="flex size-[30px] shrink-0 items-center justify-center rounded-lg border border-gold/30 bg-forest-mid text-[11px] font-bold text-gold-soft">
              {initials || "?"}
            </div>
            {!isCollapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="m-0 overflow-hidden text-xs font-semibold text-ellipsis whitespace-nowrap text-cream/88">
                    {displayName || user.email}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  title="Sair da plataforma"
                  aria-label="Sair da plataforma"
                  className="flex size-7 shrink-0 items-center justify-center rounded-md border-none bg-transparent text-cream/30 transition-colors duration-200 hover:bg-red-400/10 hover:text-red-400"
                >
                  <LogOut className="size-[13px]" strokeWidth={1.75} />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════
          ÁREA DE CONTEÚDO
          ═══════════════════════════════════════════════════ */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* ── Barra superior mobile (<lg) ─────────────────── */}
        <header className="sticky top-0 z-40 flex min-h-[56px] items-center justify-between gap-3 border-b border-white/[0.07] bg-gradient-to-r from-forest to-forest-mid px-4 shadow-[0_4px_18px_-6px_rgba(12,24,18,0.45)] lg:hidden">
          <Link to="/app" className="flex items-center" aria-label="Mesa Clínica">
            <LizLogoLockup variant="light" />
          </Link>
          <button
            onClick={() => setIsSearchOpen(true)}
            aria-label="Busca rápida"
            className="flex size-10 items-center justify-center rounded-lg text-cream/60 transition-colors duration-200 hover:bg-white/[0.08] hover:text-cream/90"
          >
            <Search className="size-[18px]" strokeWidth={1.5} />
          </button>
        </header>

        <main
          id="conteudo"
          className="flex-1 overflow-y-auto pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-0"
        >
          <Outlet />
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════
          NAVEGAÇÃO INFERIOR — mobile (<lg)
          ═══════════════════════════════════════════════════ */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-gradient-to-t from-[#0D1F15] to-forest pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_-8px_rgba(12,24,18,0.55)] lg:hidden"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {mobilePrimary.map((item) => {
            const active = isNavActive(item, location.pathname);
            return (
              <Link
                key={item.to}
                to={item.to as "/app"}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-w-[64px] flex-col items-center gap-1 px-2 pt-2.5 pb-2 text-[10px] font-semibold tracking-[0.02em] no-underline transition-colors duration-200 ${
                  active ? "text-gold" : "text-cream/50 hover:text-cream/80"
                }`}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute top-0 h-[2px] w-8 rounded-b-full bg-gold shadow-[0_0_8px_rgba(212,168,67,0.5)]"
                  />
                )}
                <item.icon className="size-[19px]" strokeWidth={active ? 1.9 : 1.5} />
                <span>{item.shortLabel}</span>
              </Link>
            );
          })}
          {/* Gaveta "Mais" */}
          <button
            onClick={() => setIsMoreOpen(true)}
            aria-label="Mais seções"
            aria-expanded={isMoreOpen}
            className={`relative flex min-w-[64px] flex-col items-center gap-1 px-2 pt-2.5 pb-2 text-[10px] font-semibold tracking-[0.02em] transition-colors duration-200 ${
              mobileSecondary.some((i) => isNavActive(i, location.pathname))
                ? "text-gold"
                : "text-cream/50 hover:text-cream/80"
            }`}
          >
            <MoreHorizontal className="size-[19px]" strokeWidth={1.5} />
            <span>Mais</span>
          </button>
        </div>
      </nav>

      {/* ── Gaveta "Mais" (mobile) ──────────────────────── */}
      <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-white/[0.08] bg-gradient-to-b from-forest-mid to-forest px-3 pb-[calc(16px+env(safe-area-inset-bottom))] text-cream"
        >
          <SheetTitle className="px-2 pt-1 pb-2 text-left font-serif text-lg font-semibold text-cream/90">
            Mais seções
          </SheetTitle>
          <div className="flex flex-col gap-px">
            {mobileSecondary.map((item) => {
              const active = isNavActive(item, location.pathname);
              return (
                <Link
                  key={item.to}
                  to={item.to as "/app"}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm no-underline transition-colors duration-150 ${
                    active
                      ? "bg-gold/14 font-semibold text-gold/95"
                      : "font-medium text-cream/70 hover:bg-white/[0.06] hover:text-cream/95"
                  }`}
                >
                  <item.icon className="size-[18px]" strokeWidth={1.5} />
                  {item.label}
                </Link>
              );
            })}
            <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border-t border-white/[0.08] px-3 pt-3 pb-1">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex size-[30px] shrink-0 items-center justify-center rounded-lg border border-gold/30 bg-forest-mid text-[11px] font-bold text-gold-soft">
                  {initials || "?"}
                </div>
                <p className="m-0 truncate text-xs font-semibold text-cream/85">
                  {displayName || user.email}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-cream/45 transition-colors duration-200 hover:bg-red-400/10 hover:text-red-400"
              >
                <LogOut className="size-[13px]" strokeWidth={1.75} />
                Sair
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════
          COMMAND PALETTE (Busca Global) — cmdk, navegável por teclado
          ═══════════════════════════════════════════════════ */}
      <CommandDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} shouldFilter={false}>
        <CommandInput
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Buscar clientes ativos..."
        />
        <CommandList>
          <CommandEmpty>
            <span className="font-serif text-sm text-warm-gray italic">
              Nenhum cliente encontrado.
            </span>
          </CommandEmpty>
          {searchResults.map((c) => (
            <CommandItem
              key={c.id}
              value={c.id}
              onSelect={() => {
                setIsSearchOpen(false);
                navigate({ to: "/app/clientes/$clientId", params: { clientId: c.id } });
              }}
              className="flex flex-col items-start gap-0.5 px-3 py-2.5"
            >
              <span className="font-serif text-[15px] font-bold text-ink">
                {c.preferred_name || c.full_name}
              </span>
              {c.presenting_complaint && (
                <span className="line-clamp-1 text-xs text-warm-gray">
                  {c.presenting_complaint}
                </span>
              )}
              {c.tags && c.tags.length > 0 && (
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {c.tags.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="rounded bg-forest-mist px-1.5 py-px text-[9px] font-bold tracking-[0.08em] text-forest-soft uppercase"
                    >
                      {t}
                    </span>
                  ))}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandList>
        <div className="flex items-center justify-between border-t border-border bg-secondary px-4 py-2">
          <span className="text-[11px] text-warm-gray">Clique ou Enter para abrir o dossiê</span>
          <kbd className="rounded-[5px] border border-border bg-card px-2 py-0.5 font-mono text-[10px] text-warm-gray">
            Esc
          </kbd>
        </div>
      </CommandDialog>
    </div>
  );
}
