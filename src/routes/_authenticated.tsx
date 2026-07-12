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
  { to: "/app",                   label: "Mesa Clínica",      shortLabel: "Mesa",    icon: Home,      exact: true },
  { to: "/app/clientes",          label: "Clientes",          shortLabel: "Clientes", icon: Users },
  { to: "/app/agenda",            label: "Agenda",            shortLabel: "Agenda",   icon: Calendar },
  { to: "/app/genossociogramas",  label: "Genossociogramas",  shortLabel: "Árvores",  icon: TreePine },
  { to: "/app/linha-do-tempo",    label: "Linhas de Herança", shortLabel: "Tempo",    icon: History },
  { to: "/app/biblioteca",        label: "Biblioteca",        shortLabel: "Livros",   icon: Library },
  { to: "/app/ia-clinica",        label: "Segundo Cérebro",   shortLabel: "IA",       icon: Sparkles },
  { to: "/app/guia",              label: "Manual Clínico",    shortLabel: "Manual",   icon: BookOpen },
  { to: "/app/configuracoes",     label: "Configurações",     shortLabel: "Ajustes",  icon: Settings },
] as const;

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

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
    <div
      className="flex min-h-screen"
      style={{ background: "var(--archive)", fontFamily: "var(--font-sans)" }}
    >
      {/* ═══════════════════════════════════════════════════
          SIDEBAR — 220px premium, Arc Browser-inspired
          ═══════════════════════════════════════════════════ */}
      <aside
        style={{
          width: isCollapsed ? "68px" : "210px",
          minWidth: isCollapsed ? "68px" : "210px",
          background: "var(--forest)",
          transition: "width 0.28s cubic-bezier(0.16,1,0.3,1), min-width 0.28s cubic-bezier(0.16,1,0.3,1)",
          boxShadow: "6px 0 24px rgba(12,24,18,0.35), 1px 0 0 rgba(255,255,255,0.04)",
          position: "relative",
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          flexShrink: 0,
        }}
        className="flex"
      >
        {/* Gradiente sutil no topo */}
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
            background: "linear-gradient(170deg, rgba(255,255,255,0.04) 0%, transparent 45%)",
          }}
        />

        {/* ── Logo ─────────────────────────────── */}
        <div
          style={{
            position: "relative", zIndex: 10,
            padding: isCollapsed ? "20px 0" : "20px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed ? "center" : "space-between",
            minHeight: "72px",
          }}
        >
          {!isCollapsed && (
            <Link to="/app" style={{ display: "flex", alignItems: "center", overflow: "hidden" }}>
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
            style={{
              width: "24px", height: "24px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              color: "rgba(242,238,230,0.5)",
              transition: "all 0.2s ease",
              flexShrink: 0,
              ...(isCollapsed ? { position: "absolute", bottom: "-12px", right: "-12px", zIndex: 20 } : {}),
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(212,168,67,0.9)";
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(212,168,67,0.12)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(212,168,67,0.2)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(242,238,230,0.5)";
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)";
            }}
          >
            {isCollapsed
              ? <ChevronRight style={{ width: "13px", height: "13px" }} strokeWidth={2} />
              : <ChevronLeft  style={{ width: "13px", height: "13px" }} strokeWidth={2} />
            }
          </button>
        </div>

        {/* ── Busca Rápida ─────────────────────── */}
        {!isCollapsed && (
          <div style={{ position: "relative", zIndex: 10, padding: "16px 16px 8px" }}>
            <button
              onClick={() => setIsSearchOpen(true)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
                padding: "8px 12px",
                cursor: "pointer",
                color: "rgba(242,238,230,0.4)",
                fontSize: "12px",
                fontFamily: "var(--font-sans)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)";
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(242,238,230,0.65)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(242,238,230,0.4)";
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <Search style={{ width: "12px", height: "12px" }} strokeWidth={1.5} />
                <span>Busca rápida...</span>
              </span>
              <kbd style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "4px",
                padding: "1px 5px",
                fontSize: "9px",
                fontFamily: "monospace",
                letterSpacing: "0.05em",
              }}>⌘K</kbd>
            </button>
          </div>
        )}

        {/* ── Ícone de busca (collapsed) ─────── */}
        {isCollapsed && (
          <div style={{ padding: "12px 0 4px", display: "flex", justifyContent: "center", zIndex: 10, position: "relative" }}>
            <button
              onClick={() => setIsSearchOpen(true)}
              title="Busca rápida (⌘K)"
              style={{
                width: "36px", height: "36px", borderRadius: "8px",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "rgba(242,238,230,0.4)", cursor: "pointer",
                background: "transparent", border: "none",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(242,238,230,0.8)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(242,238,230,0.4)"; }}
            >
              <Search style={{ width: "16px", height: "16px" }} strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* ── Eyebrow label ────────────────────── */}
        {!isCollapsed && (
          <div style={{ padding: "4px 20px 6px", position: "relative", zIndex: 10 }}>
            <span style={{
              fontSize: "9px", fontWeight: 800, letterSpacing: "0.18em",
              textTransform: "uppercase", color: "rgba(242,238,230,0.22)",
              fontFamily: "var(--font-sans)",
            }}>
              Navegação
            </span>
          </div>
        )}

        {/* ── Navegação ─────────────────────────── */}
        <nav
          style={{
            flex: 1, overflowY: "auto", overflowX: "hidden",
            padding: isCollapsed ? "4px 10px" : "4px 10px",
            display: "flex", flexDirection: "column", gap: "1px",
            position: "relative", zIndex: 10,
          }}
        >
          {nav.map((item) => {
            const active =
              "exact" in item && item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
            const isHovered = hoveredItem === item.to;

            return (
              <Link
                key={item.to}
                to={item.to as "/app"}
                title={isCollapsed ? item.label : undefined}
                onMouseEnter={() => setHoveredItem(item.to)}
                onMouseLeave={() => setHoveredItem(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: isCollapsed ? "10px 0" : "9px 12px",
                  borderRadius: "8px",
                  justifyContent: isCollapsed ? "center" : "flex-start",
                  textDecoration: "none",
                  position: "relative",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13.5px",
                  fontWeight: active ? 600 : 500,
                  letterSpacing: "0.005em",
                  transition: "all 0.18s cubic-bezier(0.16,1,0.3,1)",
                  background: active
                    ? "rgba(212,168,67,0.14)"
                    : isHovered
                      ? "rgba(255,255,255,0.06)"
                      : "transparent",
                  color: active
                    ? "rgba(212,168,67,0.95)"
                    : isHovered
                      ? "rgba(242,238,230,0.88)"
                      : "rgba(242,238,230,0.55)",
                }}
              >
                {/* Barra lateral de ativo */}
                {active && (
                  <span style={{
                    position: "absolute",
                    left: 0, top: "6px", bottom: "6px",
                    width: "2.5px",
                    background: "var(--gold)",
                    borderRadius: "0 2px 2px 0",
                    boxShadow: "0 0 8px rgba(212,168,67,0.5)",
                  }} />
                )}
                {/* Ícone com microanimação */}
                <item.icon
                  style={{
                    width: "17px", height: "17px",
                    flexShrink: 0,
                    transition: "transform 0.22s cubic-bezier(0.16,1,0.3,1), opacity 0.18s ease",
                    transform: isHovered && !active ? "rotate(3deg) scale(1.1)" : "rotate(0deg) scale(1)",
                    opacity: active ? 1 : isHovered ? 0.9 : 0.55,
                    color: active ? "var(--gold)" : "inherit",
                  }}
                  strokeWidth={active ? 1.75 : 1.5}
                />
                {/* Label */}
                {!isCollapsed && (
                  <span style={{
                    transition: "transform 0.22s cubic-bezier(0.16,1,0.3,1)",
                    transform: isHovered && !active ? "translateX(1px)" : "translateX(0)",
                  }}>
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── Usuário ──────────────────────────── */}
        <div
          style={{
            position: "relative", zIndex: 10,
            borderTop: "1px solid rgba(255,255,255,0.07)",
            padding: isCollapsed ? "12px 8px" : "12px 14px",
          }}
        >
          <div style={{
            display: "flex", alignItems: "center",
            gap: isCollapsed ? 0 : "10px",
            justifyContent: isCollapsed ? "center" : "flex-start",
            borderRadius: "8px",
            padding: "6px",
            background: "rgba(255,255,255,0.04)",
          }}>
            {/* Avatar */}
            <div style={{
              width: "30px", height: "30px", flexShrink: 0,
              borderRadius: "8px",
              background: "var(--forest-mid)",
              border: "1px solid rgba(212,168,67,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "11px", fontWeight: 700, color: "var(--gold-soft)",
              fontFamily: "var(--font-sans)",
            }}>
              {initials || "?"}
            </div>
            {!isCollapsed && (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: "12px", fontWeight: 600,
                    color: "rgba(242,238,230,0.88)",
                    fontFamily: "var(--font-sans)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    margin: 0,
                  }}>
                    {displayName || user.email}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  title="Sair da plataforma"
                  style={{
                    width: "28px", height: "28px", flexShrink: 0,
                    borderRadius: "6px", border: "none",
                    background: "transparent", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "rgba(242,238,230,0.3)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#F87171"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.1)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(242,238,230,0.3)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <LogOut style={{ width: "13px", height: "13px" }} strokeWidth={1.75} />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════
          ÁREA DE CONTEÚDO (sem header fixo!)
          ═══════════════════════════════════════════════════ */}
      <div
        style={{
          flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
          background: "var(--archive)", overflow: "hidden", position: "relative",
        }}
      >
        <main style={{ flex: 1, overflowY: "auto" }}>
          <Outlet />
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════
          COMMAND PALETTE (Busca Global)
          ═══════════════════════════════════════════════════ */}
      {isSearchOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 999,
            background: "rgba(10,14,10,0.65)",
            backdropFilter: "blur(8px)",
            display: "flex", justifyContent: "center",
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
              width: "100%", maxWidth: "520px",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow:
                "0 4px 16px rgba(18,41,31,0.08), 0 24px 64px rgba(18,41,31,0.18), 0 0 0 1px rgba(18,41,31,0.06)",
              animation: "loadReveal 0.2s ease both",
              display: "flex", flexDirection: "column",
              maxHeight: "440px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <Search style={{
                position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)",
                width: "16px", height: "16px", color: "var(--warm-gray)",
              }} strokeWidth={1.5} />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Busque clientes, sessões, padrões..."
                style={{
                  width: "100%", height: "52px",
                  paddingLeft: "44px", paddingRight: "16px",
                  background: "transparent",
                  border: "none", borderBottom: "1px solid rgba(229,224,215,0.8)",
                  fontSize: "15px", fontFamily: "var(--font-sans)",
                  color: "var(--ink)",
                  outline: "none",
                }}
              />
            </div>

            {/* Results */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
              {searchResults.length === 0 ? (
                <div style={{
                  padding: "32px", textAlign: "center",
                  fontSize: "14px", color: "var(--warm-gray)",
                  fontFamily: "var(--font-serif)", fontStyle: "italic",
                }}>
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
                      display: "flex", flexDirection: "column",
                      padding: "10px 12px", borderRadius: "10px",
                      textDecoration: "none",
                      transition: "background 0.15s ease",
                      cursor: "pointer",
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = "var(--forest-mist)"}
                    onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = "transparent"}
                  >
                    <span style={{
                      fontFamily: "var(--font-serif)", fontWeight: 700,
                      fontSize: "15px", color: "var(--ink)",
                    }}>
                      {c.preferred_name || c.full_name}
                    </span>
                    {c.presenting_complaint && (
                      <span style={{
                        fontSize: "12px", color: "var(--warm-gray)",
                        fontFamily: "var(--font-sans)", marginTop: "2px",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {c.presenting_complaint}
                      </span>
                    )}
                    {c.tags && c.tags.length > 0 && (
                      <div style={{ display: "flex", gap: "6px", marginTop: "5px" }}>
                        {c.tags.slice(0, 4).map((t) => (
                          <span key={t} style={{
                            fontSize: "9px", fontWeight: 700,
                            letterSpacing: "0.08em", textTransform: "uppercase",
                            background: "var(--forest-mist)", color: "var(--forest-soft)",
                            padding: "2px 7px", borderRadius: "4px",
                            fontFamily: "var(--font-sans)",
                          }}>
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
            <div style={{
              flexShrink: 0,
              borderTop: "1px solid rgba(229,224,215,0.7)",
              padding: "8px 16px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "var(--archive-old)",
            }}>
              <span style={{ fontSize: "11px", color: "var(--warm-gray)", fontFamily: "var(--font-sans)" }}>
                Clique para abrir dossiê
              </span>
              <kbd style={{
                background: "var(--archive-doc)",
                border: "1px solid rgba(229,224,215,0.9)",
                borderRadius: "5px", padding: "2px 8px",
                fontSize: "10px", fontFamily: "monospace",
                color: "var(--warm-gray)",
              }}>
                Esc
              </kbd>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
