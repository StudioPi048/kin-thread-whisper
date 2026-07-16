import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderOpen, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DocumentHeader } from "@/components/ui/document-header";
import { GenealogyDivider } from "@/components/ui/narrative-connector";

export const Route = createFileRoute("/_authenticated/app/")({
  component: AppHome,
});

function AppHome() {
  const { user } = Route.useRouteContext();

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const firstName =
    profile?.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "Pesquisadora";

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent pb-20 font-serif text-ink selection:bg-gold-soft">
      {/* Selo de cera — assinatura da mesa clínica (arte real "arquivo vivo") */}
      <img
        src="/assets/objects/wax_seal_tree.jpg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute top-4 right-6 hidden w-[168px] rotate-[-7deg] mix-blend-darken lg:block xl:right-20"
      />

      {/* Header Contextual (Mesa Clínica) */}
      <DocumentHeader
        breadcrumb="Mesa Clínica"
        title={`Bom dia, ${firstName}.`}
        subtitle="Sua mesa clínica está limpa e organizada para o dia de hoje."
      />

      <main className="container-liz max-w-4xl py-12 space-y-16">
        {/* Prioridade Clínica (Empty State Editorial) */}
        <section>
          <h2 className="text-[11px] uppercase font-sans tracking-widest text-ink/40 font-bold mb-6">
            Prioridade Clínica
          </h2>
          <div className="py-4 border-b border-ink/10">
            <p className="text-xl md:text-2xl font-serif text-ink/40 italic">
              Nenhuma prioridade clínica urgente registrada para hoje.
            </p>
          </div>
          <div className="mt-8">
            <Link to="/app/clientes">
              <Button
                variant="ghost"
                className="text-forest hover:bg-forest/5 font-sans font-medium px-0 group"
              >
                Acessar arquivo de clientes
                <ArrowRight className="size-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Segundo Cérebro (Empty State Editorial) */}
        <section>
          <h2 className="text-[11px] uppercase font-sans tracking-widest text-ink/40 font-bold mb-6">
            Segundo Cérebro & Hipóteses
          </h2>
          <div className="py-4 border-b border-ink/10">
            <p className="text-lg font-serif text-ink/40 italic">
              Nenhuma hipótese transgeracional em fase de investigação no momento.
            </p>
          </div>
        </section>

        {/* Pendências (Empty State Editorial) */}
        <section>
          <h2 className="text-[11px] uppercase font-sans tracking-widest text-ink/40 font-bold mb-6">
            Pendências Clínicas
          </h2>
          <div className="py-4 border-b border-ink/10">
            <p className="text-lg font-serif text-ink/40 italic">
              Seus prontuários e anotações estão em dia.
            </p>
          </div>
        </section>
      </main>

      {/* Fechamento editorial */}
      <div className="container-liz pt-16 pb-8">
        <GenealogyDivider opacity={0.2} />
      </div>
    </div>
  );
}
