import { profileQuery } from "@/lib/profile";
import { MotionConfig } from "framer-motion";
import { usePreferences, useApplyPreferences } from "@/components/account/use-preferences";
import { readClientListPreferences, readPref, readVisits } from "@/lib/recent-activity";
import { foldSearch, readClientNamePage } from "@/lib/client-index";
import { workspaceDestination } from "@/lib/auth-destination";
import { verifiedWorkspaceUser, withAuthCheckTimeout } from "@/lib/workspace-auth";
import { UnsavedProvider } from "@/components/unsaved/unsaved-guard";
import { CurrentCaseStrip } from "@/components/archive/current-case-strip";
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
  ClipboardList,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  MoreHorizontal,
} from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { GenealizWordmark } from "@/components/genealiz-wordmark";
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import "@/components/archive/workspace-shell.css";
import "@/components/archive/workspace-pages.css";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const user = await withAuthCheckTimeout(verifiedWorkspaceUser);
    if (!user) {
      throw redirect({
        to: "/auth",
        replace: true,
        search: { redirect: workspaceDestination(location.href), reauth: true },
      });
    }
    return { user };
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
  {
    to: "/app/ia-clinica",
    label: "Evidências e hipóteses",
    shortLabel: "Evidências",
    icon: ClipboardList,
  },
  { to: "/app/guia", label: "Guia", shortLabel: "Guia", icon: BookOpen },
  { to: "/app/configuracoes", label: "Configurações", shortLabel: "Ajustes", icon: Settings },
] as const;

/** Itens fixos da navegação inferior (mobile). Os demais abrem na gaveta "Mais". */
const mobilePrimary = nav.slice(0, 4);
const mobileSecondary = nav.slice(4);
const desktopGroups = [
  { label: "Consultório", entries: [nav[0], nav[1], nav[2]] },
  { label: "Pesquisa familiar", entries: [nav[3], nav[4], nav[6]] },
  { label: "Acervo e método", entries: [nav[5], nav[7]] },
] as const;

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
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const searchReturnFocus = useRef<HTMLElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [searchPage, setSearchPage] = useState(0);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const prefsQ = usePreferences(user.id);
  useApplyPreferences(prefsQ.data);

  useEffect(() => {
    readClientListPreferences(user.id);
  }, [user.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !e.repeat) {
        e.preventDefault();
        if (!isSearchOpen && document.activeElement instanceof HTMLElement) {
          searchReturnFocus.current = document.activeElement;
        }
        setIsSearchOpen(!isSearchOpen);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen]);

  // Fecha a gaveta "Mais" ao trocar de rota
  useEffect(() => {
    setIsMoreOpen(false);
  }, [location.pathname]);

  const { data: profile } = useQuery(profileQuery(user.id));

  useEffect(() => {
    if (!isSearchOpen) {
      setSearchQuery("");
      setActiveSearch("");
      setSearchPage(0);
      return;
    }
    const timer = window.setTimeout(() => {
      setActiveSearch(searchQuery.trim());
      setSearchPage(0);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [isSearchOpen, searchQuery]);

  const isSearchReady = activeSearch === searchQuery.trim();
  const clientSearch = useQuery({
    queryKey: ["all-clients-search", user.id, activeSearch, searchPage],
    queryFn: () => readClientNamePage(user.id, activeSearch, searchPage * 12, 12),
    enabled: isSearchOpen && isSearchReady,
    retry: false,
    gcTime: 0,
  });
  const searchResults = isSearchReady ? (clientSearch.data?.clients ?? []) : [];
  const pages = useMemo(
    () => nav.filter((item) => foldSearch(item.label).includes(foldSearch(searchQuery))),
    [searchQuery],
  );

  async function handleSignOut() {
    await qc.cancelQueries();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Não foi possível sair. Tente novamente.");
      return;
    }
    qc.clear();
    navigate({ to: "/auth", replace: true });
  }

  const displayName = profile?.full_name ?? user.email ?? "";
  const searchShortcut =
    typeof navigator !== "undefined" && /mac/i.test(navigator.userAgent) ? "⌘ K" : "Ctrl K";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="workspace-shell" data-collapsed={isCollapsed || undefined}>
      <a href="#conteudo" className="atlas-skip">
        Pular para o conteúdo
      </a>
      <aside className="workspace-sidebar">
        <div className="workspace-brand-row">
          <Link to="/app" aria-label="GENEALIZ — Mesa de trabalho">
            <GenealizWordmark tone="dark" variant={isCollapsed ? "symbol" : "horizontal"} />
          </Link>
          <button
            type="button"
            className="workspace-icon"
            onClick={() => setIsCollapsed((collapsed) => !collapsed)}
            aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
            aria-expanded={!isCollapsed}
            aria-controls="workspace-primary-navigation"
          >
            {isCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        <nav
          id="workspace-primary-navigation"
          className="workspace-nav"
          aria-label="Navegação principal"
        >
          {desktopGroups.map(({ label, entries }) => (
            <div key={label} className="workspace-nav-group" role="group" aria-label={label}>
              {!isCollapsed && (
                <p className="workspace-nav-label" aria-hidden>
                  {label}
                </p>
              )}
              {entries.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: true }}
                  title={isCollapsed ? item.label : undefined}
                  aria-label={item.label}
                  aria-current={isNavActive(item, location.pathname) ? "page" : undefined}
                  className="workspace-nav-link"
                >
                  <item.icon size={18} strokeWidth={1.7} aria-hidden />
                  {!isCollapsed && (
                    <span>{item.to === "/app/ia-clinica" ? item.shortLabel : item.label}</span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="workspace-sidebar-footer">
          <Link
            to="/app/configuracoes"
            className="workspace-nav-link"
            aria-current={isNavActive(nav[8], location.pathname) ? "page" : undefined}
            aria-label="Configurações"
            title={isCollapsed ? "Configurações" : undefined}
          >
            <Settings size={18} strokeWidth={1.7} aria-hidden />
            {!isCollapsed && <span>Configurações</span>}
          </Link>
          <button
            type="button"
            className="workspace-nav-link"
            onClick={handleSignOut}
            aria-label="Sair da plataforma"
            title={isCollapsed ? "Sair da plataforma" : undefined}
          >
            <LogOut size={18} strokeWidth={1.7} aria-hidden />
            {!isCollapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-topbar">
          <Link to="/app" className="workspace-mobile-brand" aria-label="GENEALIZ — Início">
            <GenealizWordmark />
          </Link>
          <button
            ref={searchTriggerRef}
            className="workspace-search"
            type="button"
            onClick={() => {
              searchReturnFocus.current = searchTriggerRef.current;
              setIsSearchOpen(true);
            }}
            aria-label="Buscar clientes ou páginas"
            aria-keyshortcuts="Meta+K Control+K"
          >
            <Search size={18} aria-hidden />
            <span>Buscar clientes ou páginas</span>
            <kbd aria-hidden>{searchShortcut}</kbd>
          </button>
          <CurrentCaseStrip userId={user.id} pathname={location.pathname} />
          <Link
            to="/app/configuracoes"
            className="workspace-account"
            aria-label="Abrir configurações da conta"
          >
            <span className="workspace-avatar" aria-hidden>
              {initials || "?"}
            </span>
            <span className="workspace-account-name">{displayName}</span>
          </Link>
        </header>
        <main id="conteudo" className="workspace-content">
          <MotionConfig reducedMotion={prefsQ.data?.reduceMotion ? "always" : "user"}>
            <UnsavedProvider>
              <Outlet />
            </UnsavedProvider>
          </MotionConfig>
        </main>
      </div>
      <nav className="workspace-mobile-nav" aria-label="Navegação no celular">
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
        <button type="button" onClick={() => setIsMoreOpen(true)} aria-expanded={isMoreOpen}>
          <MoreHorizontal size={20} />
          <span>Mais</span>
        </button>
      </nav>
      <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
        <SheetContent side="bottom" className="workspace-more">
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
      <CommandDialog
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        shouldFilter={false}
        contentClassName="workspace-command"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = searchReturnFocus.current;
          (target?.isConnected && target !== document.body
            ? target
            : searchTriggerRef.current
          )?.focus();
        }}
      >
        <CommandInput
          value={searchQuery}
          onValueChange={setSearchQuery}
          maxLength={96}
          aria-label="Buscar clientes ou páginas"
          placeholder="Buscar clientes ou páginas…"
        />
        <CommandList>
          {isSearchOpen &&
            isSearchReady &&
            clientSearch.isSuccess &&
            !clientSearch.isFetching &&
            !searchResults.length &&
            !pages.length && (
              <p role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhum cliente ou página encontrado.
              </p>
            )}
          {isSearchOpen &&
            (!isSearchReady || clientSearch.isPending || clientSearch.isFetching) && (
              <p role="status" className="px-3 py-2 text-sm text-muted-foreground">
                Buscando clientes…
              </p>
            )}
          {isSearchOpen && isSearchReady && clientSearch.isError && !clientSearch.isFetching && (
            <>
              <p role="alert" className="px-3 py-2 text-sm text-destructive">
                Não foi possível buscar os clientes.
              </p>
              <CommandItem value="retry" onSelect={() => void clientSearch.refetch()}>
                Tentar novamente
              </CommandItem>
            </>
          )}
          {searchResults.length > 0 && (
            <CommandGroup heading="Dossiês">
              {searchResults.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  onSelect={() => {
                    setIsSearchOpen(false);
                    const last = readVisits(user.id).find((v) => v.clientId === c.id);
                    const person =
                      last?.tab === "genogram"
                        ? readPref<{ personId?: string }>(user.id, `map-focus:${c.id}`, {}).personId
                        : undefined;
                    navigate({
                      to: "/app/clientes/$clientId",
                      params: { clientId: c.id },
                      search: last
                        ? { tab: last.tab as "overview", ...(person ? { person } : {}) }
                        : {},
                    });
                  }}
                  className="flex flex-col items-start gap-0.5 px-3 py-2.5"
                >
                  <span className="font-semibold text-ink">{c.preferred_name || c.full_name}</span>
                  {c.preferred_name && c.preferred_name !== c.full_name && (
                    <span className="text-sm text-muted-foreground">{c.full_name}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {pages.length > 0 && (
            <CommandGroup heading="Páginas">
              {pages.map((page) => (
                <CommandItem
                  key={page.to}
                  value={`page:${page.to}`}
                  onSelect={() => {
                    setIsSearchOpen(false);
                    navigate({ to: page.to });
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 text-[15px]"
                >
                  <page.icon className="size-4" aria-hidden />
                  {page.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {isSearchReady && (searchPage > 0 || clientSearch.data?.hasMore) && (
            <CommandGroup
              heading={
                clientSearch.data ? `${clientSearch.data.total} dossiês` : "Páginas de dossiês"
              }
            >
              {searchPage > 0 && (
                <CommandItem
                  value="clients:previous"
                  onSelect={() => setSearchPage(searchPage - 1)}
                >
                  Dossiês anteriores
                </CommandItem>
              )}
              {clientSearch.data?.hasMore && (
                <CommandItem value="clients:next" onSelect={() => setSearchPage(searchPage + 1)}>
                  Próximos dossiês
                </CommandItem>
              )}
            </CommandGroup>
          )}
        </CommandList>
        <div className="workspace-command-footer">
          <span>
            <kbd>Enter</kbd> para abrir
          </span>
          <span>
            <kbd>Esc</kbd> para fechar
          </span>
        </div>
      </CommandDialog>
    </div>
  );
}
