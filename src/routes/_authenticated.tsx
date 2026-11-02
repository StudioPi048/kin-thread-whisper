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
  Network,
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
import { GenealizWordmark } from "@/components/genealiz-wordmark";
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
  { to: "/app", label: "Mesa de trabalho", shortLabel: "Mesa", icon: Home, exact: true },
  { to: "/app/clientes", label: "Clientes", shortLabel: "Clientes", icon: Users },
  { to: "/app/agenda", label: "Agenda", shortLabel: "Agenda", icon: Calendar },
  { to: "/app/genossociogramas", label: "Genossociogramas", shortLabel: "Mapas", icon: Network },
  { to: "/app/linha-do-tempo", label: "Linha do tempo", shortLabel: "Tempo", icon: History },
  { to: "/app/biblioteca", label: "Biblioteca", shortLabel: "Livros", icon: Library },
  { to: "/app/ia-clinica", label: "Evidências e hipóteses", shortLabel: "IA", icon: Sparkles },
  { to: "/app/guia", label: "Guia", shortLabel: "Guia", icon: BookOpen },
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
    <div className={`atlas-app ${isCollapsed ? "atlas-app--collapsed" : ""}`}>
      <a href="#conteudo" className="atlas-skip">
        Pular para o conteúdo
      </a>
      <aside className="atlas-sidebar">
        <div className="atlas-brand-row">
          <Link to="/app" aria-label="GENEALIZ — Mesa de trabalho">
            {isCollapsed ? <span className="font-serif text-3xl">G</span> : <GenealizWordmark />}
          </Link>
          <button
            className="atlas-icon-button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        <nav className="atlas-nav" aria-label="Navegação principal">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to as "/app"}
              activeOptions={{ exact: true }}
              title={isCollapsed ? item.label : undefined}
              aria-label={item.label}
              aria-current={isNavActive(item, location.pathname) ? "page" : undefined}
            >
              <item.icon size={19} strokeWidth={1.6} />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>
        <div className="atlas-sidebar-footer">
          {!isCollapsed && <span className="text-xs">Uma história. Muitas relações.</span>}
          <button
            className="atlas-icon-button"
            onClick={handleSignOut}
            aria-label="Sair da plataforma"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="atlas-body">
        <header className="atlas-topbar">
          <Link to="/app" className="lg:hidden" aria-label="GENEALIZ — Início">
            <GenealizWordmark />
          </Link>
          <button
            className="atlas-search"
            onClick={() => setIsSearchOpen(true)}
            aria-label="Buscar clientes"
          >
            <Search size={18} />
            <span>Buscar clientes...</span>
            <kbd>⌘ K</kbd>
          </button>
          <Link
            to="/app/configuracoes"
            className="atlas-account"
            aria-label="Abrir configurações da conta"
          >
            <span className="atlas-avatar">{initials || "?"}</span>
            <span className="hidden sm:block truncate max-w-40">{displayName}</span>
          </Link>
        </header>
        <main id="conteudo" className="atlas-content">
          <Outlet />
        </main>
      </div>
      <nav className="atlas-mobile-nav" aria-label="Navegação no celular">
        {mobilePrimary.map((item) => (
          <Link
            key={item.to}
            to={item.to as "/app"}
            activeOptions={{ exact: true }}
            aria-current={isNavActive(item, location.pathname) ? "page" : undefined}
          >
            <item.icon size={20} />
            <span>{item.shortLabel}</span>
          </Link>
        ))}
        <button onClick={() => setIsMoreOpen(true)} aria-expanded={isMoreOpen}>
          <MoreHorizontal size={20} />
          <span>Mais</span>
        </button>
      </nav>
      <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
        <SheetContent side="bottom" className="atlas-more">
          <SheetTitle>Mais seções</SheetTitle>
          <nav className="grid gap-1 py-4">
            {mobileSecondary.map((item) => (
              <Link
                key={item.to}
                to={item.to as "/app"}
                activeOptions={{ exact: true }}
                className="flex items-center gap-3 rounded-md px-3 py-3 hover:bg-secondary"
              >
                <item.icon size={19} />
                {item.label}
              </Link>
            ))}
          </nav>
          <button className="flex items-center gap-3 p-3" onClick={handleSignOut}>
            <LogOut size={18} />
            Sair da plataforma
          </button>
        </SheetContent>
      </Sheet>
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
