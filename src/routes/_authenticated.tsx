import { createFileRoute, Link, Outlet, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, LogOut, Users, Library, Settings, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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

const nav = [
  { to: "/app", label: "Início", icon: Home, exact: true },
  { to: "/app/clientes", label: "Clientes", icon: Users },
  { to: "/app/biblioteca", label: "Biblioteca", icon: Library },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings },
] as const;

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
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <Link to="/app" className="flex items-center gap-3 border-b border-sidebar-border px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-primary font-serif text-lg">
            L
          </div>
          <div className="leading-tight">
            <p className="font-serif text-lg">Instituto Liz</p>
            <p className="text-[10px] uppercase tracking-[0.25em] text-sidebar-foreground/60">
              Psicogenealogia
            </p>
          </div>
        </Link>
        <nav className="flex-1 space-y-1 px-3 py-6">
          {nav.map((item) => {
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors " +
                  (active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground")
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-medium">
              {initials || "?"}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm">{displayName}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{user.email}</p>
            </div>
          </div>
          <Button
            onClick={handleSignOut}
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="size-4" />
            Sair
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-parchment/60 px-6 backdrop-blur md:hidden">
          <Link to="/app" className="font-serif text-lg text-primary">
            Instituto Liz
          </Link>
          <Button onClick={handleSignOut} variant="ghost" size="sm">
            <LogOut className="size-4" />
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// Small icon export re-use to silence unused-import warnings if any
export const _ = Sparkles;
