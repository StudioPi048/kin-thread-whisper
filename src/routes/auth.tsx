import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { GenealizWordmark } from "@/components/genealiz-wordmark";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup", "recover", "reset"]).optional(),
  redirect: z.string().optional(),
});

/** Erros comuns do Supabase traduzidos com instrução de próximo passo. */
function friendlyAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  const m = raw.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "E-mail ou senha incorretos. Confira os dados e tente de novo.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return 'Este e-mail já tem conta. Entre com a senha ou use "Esqueci minha senha".';
  if (m.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar — o link está na sua caixa de entrada.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas seguidas. Aguarde um instante e tente de novo.";
  if (m.includes("password should be")) return "A senha precisa ter pelo menos 8 caracteres.";
  return raw || "Não foi possível autenticar. Tente de novo.";
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    // Quem chega do link de redefinição tem sessão temporária — deixa passar.
    if (search.mode === "reset") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: search.redirect ?? "/app" });
  },
  component: AuthPage,
});

function AuthPage() {
  const { mode: initialMode, redirect: redirectTo } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "recover" | "reset">(
    initialMode ?? "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoverSent, setRecoverSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => setMode(initialMode ?? "signin"), [initialMode]);
  const keepErrorRef = useRef(false);
  useEffect(() => {
    if (keepErrorRef.current) {
      keepErrorRef.current = false;
      return;
    }
    setFormError(null);
    setNotice(null);
  }, [mode]);

  // Link de e-mail expirado/inválido chega com erro no hash da URL.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const code =
      hash.get("error_code") ?? new URLSearchParams(window.location.search).get("error_code");
    if (code) {
      setFormError(
        code === "otp_expired"
          ? "Este link expirou ou já foi usado. Peça um novo link abaixo."
          : "O link não é válido. Peça um novo link abaixo.",
      );
      keepErrorRef.current = true;
      setMode("recover");
      return;
    }
    if (initialMode === "reset") {
      void supabase.auth.getSession().then(({ data }) => {
        if (!data.session) {
          keepErrorRef.current = true;
          setMode("recover");
          setFormError(
            "Não há uma sessão de redefinição ativa. O link pode ter expirado — peça um novo.",
          );
        }
      });
    }
  }, [initialMode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    try {
      if (mode === "recover") {
        const parsedEmail = z.string().trim().email("E-mail inválido").parse(email);
        const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail, {
          redirectTo: `${window.location.origin}/auth?mode=reset`,
        });
        if (error) throw error;
        setRecoverSent(true);
        return;
      }
      if (mode === "reset") {
        const parsedPassword = z.string().min(8, "Mínimo de 8 caracteres").max(72).parse(password);
        const { error } = await supabase.auth.updateUser({ password: parsedPassword });
        if (error) throw error;
        toast.success("Senha atualizada.");
        navigate({ to: "/app" });
        return;
      }
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
        const { data: su, error } = await supabase.auth.signUp({
          email: parsed.email,
          password: parsed.password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { full_name: parsed.fullName },
          },
        });
        if (error) throw error;
        if (!su.session) {
          // Confirmação por e-mail ativa: não há sessão até confirmar.
          setNotice(
            "Conta criada. Se a confirmação por e-mail estiver ativa, abra o link enviado para entrar. Não chegou? Confira o spam ou tente entrar depois.",
          );
          return;
        }
        toast.success("Conta criada.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.email,
          password: parsed.password,
        });
        if (error) throw error;
        toast.success("Bem-vinda ao GENEALIZ.");
      }
      navigate({ to: redirectTo ?? "/app" });
    } catch (err) {
      const message = err instanceof z.ZodError ? err.errors[0]?.message : friendlyAuthError(err);
      setFormError(message ?? "Não foi possível concluir. Tente de novo.");
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
      setFormError(
        `${err instanceof Error ? err.message : "Falha no login com Google"}. Tente de novo ou entre com e-mail.`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-[1fr_1fr]">
      <aside className="atlas-auth-aside">
        <Link to="/" aria-label="GENEALIZ — Início">
          <GenealizWordmark />
        </Link>
        <div>
          <h2 className="font-serif text-5xl leading-tight font-medium">
            Cada pessoa faz parte
            <br />
            de uma história maior.
          </h2>
          <p className="mt-5 text-sm leading-7 text-slate-300 max-w-md">
            Seu espaço de trabalho para organizar relações familiares e acompanhar cada atendimento.
          </p>
          <img
            className="gv-auth-image"
            src="/assets/genealiz/archive-hero.jpg"
            alt="Fotografias de um arquivo familiar ilustrativo"
          />
        </div>
        <p className="text-xs text-slate-300">GENEALIZ · Psicogenealogia</p>
      </aside>

      {/* ── PAINEL DIREITO — Formulário ──────────────────── */}
      <main className="flex items-center justify-center bg-background p-6 md:p-14">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-10 block md:hidden">
            <GenealizWordmark />
          </Link>
          {/* Header */}
          <div className="mb-8">
            <h1 className="mt-3 font-serif text-4xl font-bold text-primary">
              {mode === "signin"
                ? "Entrar"
                : mode === "signup"
                  ? "Criar conta"
                  : mode === "recover"
                    ? "Recuperar senha"
                    : "Nova senha"}
            </h1>
            <p className="mt-2 text-[15px] text-muted-foreground">
              {mode === "signin"
                ? "Bem-vinda de volta. Seus casos aguardam."
                : mode === "signup"
                  ? "Acesso restrito a psicogenealogistas formados ou em formação."
                  : mode === "recover"
                    ? "Informe seu e-mail e enviaremos um link para redefinir a senha."
                    : "Defina a nova senha da sua conta."}
            </p>
          </div>

          {formError && (
            <div
              role="alert"
              className="mb-5 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-[15px] text-destructive"
            >
              {formError}
            </div>
          )}
          {notice && (
            <div
              role="status"
              className="mb-5 rounded-md border border-border bg-secondary p-3 text-[15px] text-foreground"
            >
              {notice}
            </div>
          )}
          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-[15px] font-bold">
                  Nome completo
                </Label>
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

            {mode !== "reset" && (
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[15px] font-bold">
                  E-mail profissional
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  required
                />
              </div>
            )}

            {mode !== "recover" && (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="password" className="text-[15px] font-bold">
                    {mode === "reset" ? "Nova senha" : "Senha"}
                  </Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("recover");
                        setRecoverSent(false);
                      }}
                      className="text-[12px] font-semibold text-forest underline-offset-4 hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signin" ? "Sua senha" : "Mínimo 8 caracteres"}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  minLength={8}
                  required
                />
              </div>
            )}

            {mode === "recover" && recoverSent && (
              <p
                role="status"
                className="rounded-lg border border-clinical-positive/25 bg-clinical-positive/8 px-4 py-3 text-[13px] leading-relaxed text-clinical-positive"
              >
                Se este e-mail tiver conta, o link de redefinição chega em instantes. Confira também
                a caixa de spam.
              </p>
            )}

            <Button
              type="submit"
              className="w-full mt-2"
              size="lg"
              variant="default"
              disabled={loading}
            >
              {loading
                ? "Aguarde..."
                : mode === "signin"
                  ? "Entrar na plataforma"
                  : mode === "signup"
                    ? "Criar minha conta"
                    : mode === "recover"
                      ? "Enviar link de redefinição"
                      : "Salvar nova senha"}
            </Button>
          </form>

          {(mode === "signin" || mode === "signup") && (
            <>
              {/* Divisor */}
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  ou
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Google */}
              <Button
                type="button"
                variant="outline"
                className="w-full normal-case tracking-normal font-semibold text-[14px]"
                size="lg"
                onClick={handleGoogle}
                disabled={loading}
              >
                <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continuar com Google
              </Button>
            </>
          )}

          {/* Toggle */}
          <p className="mt-8 text-center text-[15px] text-muted-foreground">
            {mode === "recover" || mode === "reset" ? (
              <>
                Lembrou a senha?{" "}
                <button
                  type="button"
                  className="font-bold text-forest hover:text-forest transition-colors underline-offset-4 hover:underline"
                  onClick={() => setMode("signin")}
                >
                  Entrar
                </button>
              </>
            ) : mode === "signin" ? (
              <>
                Não tem conta?{" "}
                <button
                  type="button"
                  className="font-bold text-forest hover:text-forest transition-colors underline-offset-4 hover:underline"
                  onClick={() => setMode("signup")}
                >
                  Criar conta
                </button>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <button
                  type="button"
                  className="font-bold text-forest hover:text-forest transition-colors underline-offset-4 hover:underline"
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
