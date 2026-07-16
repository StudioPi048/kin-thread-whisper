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

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") setIsSearchOpen(false);
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
    <div className="flex min-h-screen font-sans">
      {/* ═══════════════════════════════════════════════════
          SIDEBAR — 220px premium, Arc Browser-inspired
          ═══════════════════════════════════════════════════ */}
      <aside
        className={`relative z-40 flex shrink-0 flex-col overflow-hidden bg-forest shadow-[6px_0_24px_rgba(12,24,18,0.35),1px_0_0_rgba(255,255,255,0.04)] transition-[width,min-width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isCollapsed ? "w-[68px] min-w-[68px]" : "w-[210px] min-w-[210px]"
        }`}
      >
        {/* Gradiente sutil no topo */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(170deg,rgba(255,255,255,0.04)_0%,transparent_45%)]"
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
            className={`flex size-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-cream/50 transition-colors duration-200 hover:border-gold/20 hover:bg-gold/12 hover:text-gold/90 ${
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
            const active =
              "exact" in item && item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);

            return (
              <Link
                key={item.to}
                to={item.to as "/app"}
                title={isCollapsed ? item.label : undefined}
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
          ÁREA DE CONTEÚDO (sem header fixo!)
          ═══════════════════════════════════════════════════ */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════
          COMMAND PALETTE (Busca Global)
          ═══════════════════════════════════════════════════ */}
      {isSearchOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            background: "rgba(10,14,10,0.65)",
            backdropFilter: "blur(8px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            paddingTop: "20vh",
            padding: "20vh 16px 16px",
          }}
          onClick={() => setIsSearchOpen(false)}
        >
          <div
            style={{
              background: "var(--ivory)",
              border: "1px solid rgba(229,224,215,0.9)",
              width: "100%",
              maxWidth: "520px",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow:
                "0 4px 16px rgba(18,41,31,0.08), 0 24px 64px rgba(18,41,31,0.18), 0 0 0 1px rgba(18,41,31,0.06)",
              animation: "loadReveal 0.2s ease both",
              display: "flex",
              flexDirection: "column",
              maxHeight: "440px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <Search
                style={{
                  position: "absolute",
                  left: "16px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "16px",
                  height: "16px",
                  color: "var(--warm-gray)",
                }}
                strokeWidth={1.5}
              />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Busque clientes, sessões, padrões..."
                style={{
                  width: "100%",
                  height: "52px",
                  paddingLeft: "44px",
                  paddingRight: "16px",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid rgba(229,224,215,0.8)",
                  fontSize: "15px",
                  fontFamily: "var(--font-sans)",
                  color: "var(--ink)",
                  outline: "none",
                }}
              />
            </div>

            {/* Results */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
              {searchResults.length === 0 ? (
                <div
                  style={{
                    padding: "32px",
                    textAlign: "center",
                    fontSize: "14px",
                    color: "var(--warm-gray)",
                    fontFamily: "var(--font-serif)",
                    fontStyle: "italic",
                  }}
                >
                  Nenhum cliente encontrado.
                </div>
              ) : (
                searchResults.map((c) => (
                  <Link
                    key={c.id}
                    to="/app/clientes/$clientId"
                    params={{ clientId: c.id }}
                    onClick={() => setIsSearchOpen(false)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      textDecoration: "none",
                      transition: "background 0.15s ease",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLAnchorElement).style.background =
                        "var(--forest-mist)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLAnchorElement).style.background = "transparent")
                    }
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontWeight: 700,
                        fontSize: "15px",
                        color: "var(--ink)",
                      }}
                    >
                      {c.preferred_name || c.full_name}
                    </span>
                    {c.presenting_complaint && (
                      <span
                        style={{
                          fontSize: "12px",
                          color: "var(--warm-gray)",
                          fontFamily: "var(--font-sans)",
                          marginTop: "2px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c.presenting_complaint}
                      </span>
                    )}
                    {c.tags && c.tags.length > 0 && (
                      <div style={{ display: "flex", gap: "6px", marginTop: "5px" }}>
                        {c.tags.slice(0, 4).map((t) => (
                          <span
                            key={t}
                            style={{
                              fontSize: "9px",
                              fontWeight: 700,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              background: "var(--forest-mist)",
                              color: "var(--forest-soft)",
                              padding: "2px 7px",
                              borderRadius: "4px",
                              fontFamily: "var(--font-sans)",
                            }}
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

            {/* Footer */}
            <div
              style={{
                flexShrink: 0,
                borderTop: "1px solid rgba(229,224,215,0.7)",
                padding: "8px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--archive-old)",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--warm-gray)",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Clique para abrir dossiê
              </span>
              <kbd
                style={{
                  background: "var(--archive-doc)",
                  border: "1px solid rgba(229,224,215,0.9)",
                  borderRadius: "5px",
                  padding: "2px 8px",
                  fontSize: "10px",
                  fontFamily: "monospace",
                  color: "var(--warm-gray)",
                }}
              >
                Esc
              </kbd>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
