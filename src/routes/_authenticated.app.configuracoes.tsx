import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { DocumentHeader } from "@/components/ui/document-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/app/configuracoes")({
  component: ConfigPage,
});

function ConfigPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
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

  const [fullName, setFullName] = useState("");
  const [formation, setFormation] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setFormation(profile.formation ?? "");
    setCity(profile.city ?? "");
    setBio(profile.bio ?? "");
  }, [profile]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          formation: formation.trim() || null,
          city: city.trim() || null,
          bio: bio.trim() || null,
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado.");
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar."),
  });

  const dirty =
    !isLoading &&
    (fullName !== (profile?.full_name ?? "") ||
      formation !== (profile?.formation ?? "") ||
      city !== (profile?.city ?? "") ||
      bio !== (profile?.bio ?? ""));

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
            mutation.mutate();
          }}
          className="max-w-2xl space-y-6"
        >
          <div className="rounded-[14px] border border-material-border bg-surface-document p-6 shadow-surface sm:p-8">
            <h2 className="m-0 font-serif text-2xl text-ink">Perfil profissional</h2>

            <div className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Nome</Label>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isLoading}
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
                  value={formation}
                  onChange={(e) => setFormation(e.target.value)}
                  disabled={isLoading}
                  placeholder="Ex: Psicóloga clínica, CRP 00/00000"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={isLoading}
                  placeholder="Cidade onde atende"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={isLoading}
                  placeholder="Uma breve apresentação profissional"
                  className="min-h-[100px]"
                />
              </div>

              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-material-border/60 pt-3 text-sm">
                <span className="text-warm-gray">Papel</span>
                <span className="text-ink">
                  {roles?.map((r) => r.role).join(", ") || "professional"}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button type="submit" disabled={!dirty || mutation.isPending}>
                {mutation.isPending ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
