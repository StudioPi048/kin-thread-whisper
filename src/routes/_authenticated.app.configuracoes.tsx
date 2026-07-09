import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

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
    <div className="container-liz py-12">
      <p className="text-xs uppercase tracking-[0.3em] text-gold">Perfil</p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Configurações</h1>

      <div className="mt-10 max-w-2xl space-y-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-serif text-2xl text-primary">Sua conta</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Nome" value={profile?.full_name ?? "—"} />
            <Row label="E-mail" value={profile?.email ?? user.email ?? "—"} />
            <Row label="Formação" value={profile?.formation ?? "—"} />
            <Row label="Cidade" value={profile?.city ?? "—"} />
            <Row label="Papel" value={roles?.map((r) => r.role).join(", ") || "professional"} />
          </dl>
          <p className="mt-6 text-xs text-muted-foreground">
            A edição de perfil chega na Etapa 2, junto do cadastro completo de clientes.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 pb-2 last:border-none">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
