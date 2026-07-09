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
      <p className="font-sans text-[16px] font-bold uppercase tracking-[0.3em] text-[#D4AF37]">
        Perfil
      </p>
      <h1 className="mt-3 font-serif text-[42px] font-bold text-white">Configurações</h1>

      <div className="mt-10 max-w-2xl space-y-6">
        <div className="bg-[#151A15] border border-white/10 p-8 shadow-xl">
          <h2 className="font-serif text-[28px] font-bold text-white">Sua conta</h2>
          <dl className="mt-8 space-y-4">
            <Row label="Nome" value={profile?.full_name ?? "—"} />
            <Row label="E-mail" value={profile?.email ?? user.email ?? "—"} />
            <Row label="Formação" value={profile?.formation ?? "—"} />
            <Row label="Cidade" value={profile?.city ?? "—"} />
            <Row label="Papel" value={roles?.map((r) => r.role).join(", ") || "professional"} />
          </dl>
          <div className="mt-8 bg-white/5 border border-white/10 p-4">
            <p className="font-sans text-[16px] font-bold text-[#D4AF37] uppercase tracking-widest mb-1">
              Aviso
            </p>
            <p className="font-serif text-[16px] text-white/70 italic">
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
    <div className="flex justify-between gap-4 border-b border-white/10 pb-3 last:border-none">
      <dt className="font-sans text-[16px] font-bold uppercase tracking-widest text-white/50">{label}</dt>
      <dd className="font-serif text-[16px] text-white">{value}</dd>
    </div>
  );
}
