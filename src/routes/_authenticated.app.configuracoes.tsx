import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { DocumentHeader } from "@/components/ui/document-header";

export const Route = createFileRoute("/_authenticated/app/configuracoes")({
  component: ConfigPage,
});

function ConfigPage() {
  const { user } = Route.useRouteContext();
  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, formation, city, bio")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
  });
  const { data: roles } = useQuery({
    queryKey: ["roles", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-surface-archive">
      <DocumentHeader
        breadcrumb="Configurações"
        title="Sua conta"
        subtitle="Dados profissionais registrados na plataforma."
      />

      <div className="container-liz pb-16">
        <div className="max-w-2xl space-y-6">
          <div className="rounded-[14px] border border-material-border bg-surface-document p-6 shadow-surface sm:p-8">
            <h2 className="m-0 font-serif text-2xl text-ink">Perfil profissional</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <Row label="Nome" value={profile?.full_name ?? "—"} />
              <Row label="E-mail" value={profile?.email ?? user.email ?? "—"} />
              <Row label="Formação" value={profile?.formation ?? "—"} />
              <Row label="Cidade" value={profile?.city ?? "—"} />
              <Row label="Papel" value={roles?.map((r) => r.role).join(", ") || "professional"} />
            </dl>
            <p className="mt-6 mb-0 text-xs text-muted-foreground">
              A edição de perfil chega na Etapa 2, junto do cadastro completo de clientes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-material-border/60 pb-2 last:border-none">
      <dt className="text-warm-gray">{label}</dt>
      <dd className="m-0 text-right text-ink">{value}</dd>
    </div>
  );
}
