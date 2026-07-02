import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { LizLogo, LizLogoLockup } from "@/components/liz-logo";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  beforeLoad: async ({ search }) => {
    // Optional client hydration guard: if we're SSR'd, skip
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: search.redirect ?? "/app" });
    }
  },
  component: AuthPage,
});

function AuthPage() {
  const { mode: initialMode, redirect: redirectTo } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => setMode(initialMode ?? "signin"), [initialMode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const parsed = z
        .object({
          email: z.string().trim().email("E-mail inválido").max(255),
          password: z.string().min(8, "Mínimo de 8 caracteres").max(72),
          fullName:
            mode === "signup"
              ? z.string().trim().min(2, "Informe seu nome completo").max(120)
              : z.string().optional(),
        })
        .parse({ email, password, fullName });

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.email,
          password: parsed.password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { full_name: parsed.fullName },
          },
        });
        if (error) throw error;
        toast.success("Conta criada. Redirecionando...");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.email,
          password: parsed.password,
        });
        if (error) throw error;
        toast.success("Bem-vinda ao Instituto Liz.");
      }
      navigate({ to: redirectTo ?? "/app" });
    } catch (err) {
      const message =
        err instanceof z.ZodError
          ? err.errors[0]?.message
          : err instanceof Error
            ? err.message
            : "Erro ao autenticar";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: redirectTo ?? "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no login com Google");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      {/* Left: manifesto */}
      <aside className="hidden bg-sidebar text-sidebar-foreground md:flex md:flex-col md:justify-between md:p-12">
        <Link to="/" className="flex items-center gap-3">
          <LizLogoLockup variant="light" />
        </Link>
        <div className="max-w-md">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Beta fechado</p>
          <h1 className="mt-6 font-serif text-4xl leading-tight">
            "O que não pode ser dito, não pode ser esquecido — apenas repetido."
          </h1>
          <p className="mt-6 text-sm text-sidebar-foreground/70">
            — inspirado em Françoise Dolto
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">
          Dados clínicos protegidos por criptografia. LGPD e sigilo profissional.
        </p>
      </aside>

      {/* Right: form */}
      <main className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-8">
            <Link to="/" className="text-sm text-muted-foreground">
              ← Voltar
            </Link>
          </div>
          <h2 className="font-serif text-3xl text-primary">
            {mode === "signin" ? "Entrar na plataforma" : "Solicitar acesso beta"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Bem-vinda de volta. Seus casos aguardam."
              : "Acesso restrito a psicogenealogistas em formação ou formados."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Como você assina profissionalmente"
                  autoComplete="name"
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail profissional</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={8}
                required
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            size="lg"
            onClick={handleGoogle}
            disabled={loading}
          >
            Continuar com Google
          </Button>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                Não tem conta ainda?{" "}
                <button
                  type="button"
                  className="text-primary underline underline-offset-4"
                  onClick={() => setMode("signup")}
                >
                  Solicitar acesso
                </button>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <button
                  type="button"
                  className="text-primary underline underline-offset-4"
                  onClick={() => setMode("signin")}
                >
                  Entrar
                </button>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
