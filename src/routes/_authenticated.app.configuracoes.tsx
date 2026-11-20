import { createFileRoute, Link } from "@tanstack/react-router";
import { AccountPreferences, DataExport } from "@/components/account/account-sections";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PROFILE_FIELDS, profileQuery } from "@/lib/profile";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { DocumentHeader } from "@/components/ui/document-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/app/configuracoes")({
  head: () => ({
    meta: [
      { title: "Sua conta — GENEALIZ" },
      { name: "description", content: "Perfil, preferências, exportação de dados e ajuda." },
      { property: "og:title", content: "Sua conta — GENEALIZ" },
      { property: "og:description", content: "Perfil, preferências, exportação de dados e ajuda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfigPage,
});

function ConfigPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();

  const { data: profile, isLoading, isError, refetch } = useQuery(profileQuery(user.id));

  const { data: roles } = useQuery({
    queryKey: ["roles", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return data ?? [];
    },
  });

  type EditableField = "full_name" | "formation" | "city" | "bio";
  const [edits, setEdits] = useState<Partial<Record<EditableField, string>>>({});
  const valueOf = (field: EditableField) => edits[field] ?? profile?.[field] ?? "";
  const edit = (field: EditableField, value: string) => {
    setEdits((current) => {
      const next = { ...current };
      if (!mutation.isPending && value === (profile?.[field] ?? "")) delete next[field];
      else next[field] = value;
      return next;
    });
  };

  const mutation = useMutation({
    mutationFn: async (snapshot: typeof edits) => {
      const patch: Partial<Record<EditableField, string | null>> = {};
      for (const field of Object.keys(snapshot) as EditableField[]) {
        patch[field] = snapshot[field]?.trim() || null;
      }
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user.id)
        .select(PROFILE_FIELDS)
        .maybeSingle();
      if (error || !data) throw new Error("O servidor não confirmou a alteração.");
      return data;
    },
    onSuccess: (data, snapshot) => {
      queryClient.setQueryData(profileQuery(user.id).queryKey, data);
      setEdits((current) => {
        const next = { ...current };
        for (const field of Object.keys(snapshot) as EditableField[]) {
          if (next[field] === snapshot[field]) delete next[field];
        }
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: profileQuery(user.id).queryKey });
      toast.success("Perfil atualizado.");
    },
    onError: () => toast.error("As alterações do perfil continuam nesta página. Tente novamente."),
  });

  const unavailable = isLoading || isError || !profile;
  const dirty = Object.keys(edits).length > 0;

  return (
    <div className="min-h-screen bg-surface-archive">
      <DocumentHeader
        breadcrumb="Configurações"
        title="Sua conta"
        subtitle="Dados profissionais registrados na plataforma."
      />

      <div className="container-liz pb-16">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!unavailable && dirty && !mutation.isPending) mutation.mutate(edits);
          }}
          className="max-w-2xl space-y-6"
        >
          <div className="rounded-[14px] border border-material-border bg-surface-document p-6 shadow-surface sm:p-8">
            <h2 className="m-0 font-serif text-2xl text-ink">Perfil profissional</h2>

            {isError && (
              <div
                className="mt-3 flex flex-wrap items-center gap-2 text-sm text-destructive"
                role="alert"
              >
                Não foi possível carregar o perfil.
                <Button
                  className="min-h-11"
                  type="button"
                  variant="outline"
                  onClick={() => void refetch()}
                >
                  Tentar novamente
                </Button>
              </div>
            )}
            <div className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Nome</Label>
                <Input
                  id="full_name"
                  value={valueOf("full_name")}
                  onChange={(e) => edit("full_name", e.target.value)}
                  disabled={unavailable}
                  placeholder="Seu nome completo"
                />
              </div>

              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-material-border/60 pb-3 text-sm">
                <span className="text-warm-gray">E-mail</span>
                <span className="text-ink">{profile?.email ?? user.email ?? "—"}</span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="formation">Formação</Label>
                <Input
                  id="formation"
                  value={valueOf("formation")}
                  onChange={(e) => edit("formation", e.target.value)}
                  disabled={unavailable}
                  placeholder="Ex: Psicóloga clínica, CRP 00/00000"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={valueOf("city")}
                  onChange={(e) => edit("city", e.target.value)}
                  disabled={unavailable}
                  placeholder="Cidade onde atende"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={valueOf("bio")}
                  onChange={(e) => edit("bio", e.target.value)}
                  disabled={unavailable}
                  placeholder="Uma breve apresentação profissional"
                  className="min-h-[100px]"
                />
              </div>

              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-material-border/60 pt-3 text-sm">
                <span className="text-warm-gray">Papel</span>
                <span className="text-ink">
                  {roles
                    ?.map((r) => (r.role === "admin" ? "Administração" : "Profissional"))
                    .join(", ") || "—"}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button type="submit" disabled={unavailable || !dirty || mutation.isPending}>
                {mutation.isPending ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          </div>
        </form>
        <div className="mt-6 max-w-2xl space-y-6">
          <AccountPreferences userId={user.id} />
          <DataExport userId={user.id} />
          <section
            className="rounded-[14px] border border-material-border bg-surface-document p-6 shadow-surface sm:p-8"
            aria-labelledby="help-h"
          >
            <h2 id="help-h" className="m-0 font-serif text-2xl text-ink">
              Ajuda
            </h2>
            <ul className="mt-4 space-y-2 text-[15px]">
              <li>
                <Link
                  to="/app/guia"
                  className="inline-flex min-h-11 items-center font-semibold text-forest underline-offset-4 hover:underline"
                >
                  Guia de tarefas: cadastrar, vincular, salvar, importar e conduzir sessões
                </Link>
              </li>
              <li>
                Senha esquecida: na tela de entrada use “Esqueci minha senha”. O envio do e-mail
                depende da configuração de e-mail da plataforma.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
