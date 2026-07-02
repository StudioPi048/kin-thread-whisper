import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

type Person = Tables<"genogram_persons">;
type Props = { clientId: string };

const RELATIONSHIP_TEMPLATE = [
  "Consulente",
  "Irmã(o)",
  "Irmã(o)",
  "Irmã(o)",
  "Pai",
  "Tio(a) paterno(a)",
  "Tio(a) paterno(a)",
  "Tio(a) paterno(a)",
  "Avô paterno",
  "Irmã(o) do avô paterno",
  "Irmã(o) do avô paterno",
  "Bisavô paterno (pai do avô)",
  "Irmã(o) do bisavô paterno",
  "Bisavó paterna (mãe do avô)",
  "Irmã(o) da bisavó paterna",
  "Avó paterna",
  "Irmã(o) da avó paterna",
  "Irmã(o) da avó paterna",
  "Bisavô paterno (pai da avó)",
  "Irmã(o) do bisavô paterno",
  "Bisavó paterna (mãe da avó)",
  "Irmã(o) da bisavó paterna",
  "Mãe",
  "Tio(a) materno(a)",
  "Tio(a) materno(a)",
  "Tio(a) materno(a)",
  "Avô materno",
  "Irmã(o) do avô materno",
  "Irmã(o) do avô materno",
  "Bisavô materno (pai do avô)",
  "Irmã(o) do bisavô materno",
  "Bisavó materna (mãe do avô)",
  "Irmã(o) da bisavó materna",
  "Avó materna",
  "Irmã(o) da avó materna",
  "Irmã(o) da avó materna",
  "Bisavô materno (pai da avó)",
  "Irmã(o) do bisavô materno",
  "Bisavó materna (mãe da avó)",
  "Irmã(o) da bisavó materna",
] as const;

const RELATIONSHIP_OPTIONS = Array.from(new Set(RELATIONSHIP_TEMPLATE));

export function ClanSpreadsheet({ clientId }: Props) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Partial<Person>>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const { data: persons, isLoading } = useQuery({
    queryKey: ["genogram-persons", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("genogram_persons")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const savePerson = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<"genogram_persons"> }) => {
      const { error } = await supabase.from("genogram_persons").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["genogram-persons", clientId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const addPerson = useMutation({
    mutationFn: async (relationship?: string) => {
      const gender = inferGenderFromRelationship(relationship);
      const { data, error } = await supabase
        .from("genogram_persons")
        .insert({
          client_id: clientId,
          full_name: "",
          gender: gender ?? "unknown",
          relationship_to_proband: relationship ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["genogram-persons", clientId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao adicionar"),
  });

  const removePerson = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("genogram_persons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["genogram-persons", clientId] }),
  });

  const scheduleSave = (id: string, patch: TablesUpdate<"genogram_persons">) => {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
    if (timers.current[id]) clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => {
      savePerson.mutate({ id, patch });
    }, 900);
  };

  useEffect(() => {
    const t = timers.current;
    return () => {
      Object.values(t).forEach(clearTimeout);
    };
  }, []);

  const rows = useMemo(() => (persons ?? []).map((p) => ({ ...p, ...(drafts[p.id] ?? {}) })), [persons, drafts]);

  const scaffoldTemplate = async () => {
    if (rows.length > 0) {
      const ok = confirm(
        `Já existem ${rows.length} pessoas cadastradas. Adicionar as ${RELATIONSHIP_TEMPLATE.length} linhas do modelo mesmo assim?`,
      );
      if (!ok) return;
    }
    for (const rel of RELATIONSHIP_TEMPLATE) {
      await addPerson.mutateAsync(rel);
    }
    toast.success("Modelo aplicado. Complete os nomes e datas.");
  };

  const exportCsv = () => {
    const header = [
      "NOME",
      "PARENTESCO",
      "Data Nascimento",
      "Tempo gestacional",
      "Data Morte",
      "ENFERMIDADES",
      "PROFISSÕES",
      "VÍCIOS",
      "Temperamento",
      "Ordem",
      "Observações",
    ];
    const lines = [header.join(";")];
    for (const r of rows) {
      lines.push(
        [
          r.full_name ?? "",
          r.relationship_to_proband ?? "",
          r.birth_date ?? "",
          r.gestational_weeks ?? "",
          r.death_date ?? "",
          (r.health_conditions ?? []).join(", "),
          r.occupation ?? "",
          r.vices ?? "",
          r.temperament ?? "",
          r.birth_order ?? "",
          (r.notes ?? "").replace(/;/g, ","),
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";"),
      );
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planilha-cla-${clientId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Carregando planilha…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-gold">
            Planilha do clã · 4 gerações
          </p>
          <h2 className="mt-1 font-serif text-2xl text-primary">Atlas familiar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Uma linha por pessoa. Cada registro alimenta o genograma e o motor de padrões.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="size-3.5" /> Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={scaffoldTemplate}>
            <Plus className="size-3.5" /> Aplicar modelo (4 gerações)
          </Button>
          <Button size="sm" onClick={() => addPerson.mutate(undefined)}>
            <Plus className="size-3.5" /> Nova pessoa
          </Button>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 p-12 text-center">
          <p className="font-serif text-xl text-primary">Planilha vazia</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Aplique o modelo com as 40 linhas de parentesco padrão (consulente até bisavós dos dois lados)
            e complete os dados de cada pessoa.
          </p>
          <Button className="mt-6" onClick={scaffoldTemplate}>
            <Plus className="size-3.5" /> Aplicar modelo
          </Button>
        </div>
      ) : (
        <>
          <datalist id="relationship-suggestions">
            {RELATIONSHIP_OPTIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>

          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[1500px] border-collapse text-sm">
              <thead className="bg-lilac-soft/60 text-[10px] uppercase tracking-[0.18em] text-primary">
                <tr>
                  <Th w="w-8">#</Th>
                  <Th w="min-w-[180px]">Nome</Th>
                  <Th w="min-w-[180px]">Parentesco</Th>
                  <Th w="w-32">Nascimento</Th>
                  <Th w="w-24">Gestação</Th>
                  <Th w="w-32">Morte</Th>
                  <Th w="min-w-[160px]">Enfermidades</Th>
                  <Th w="min-w-[140px]">Profissão</Th>
                  <Th w="min-w-[120px]">Vícios</Th>
                  <Th w="min-w-[120px]">Temperamento</Th>
                  <Th w="w-16">Ordem</Th>
                  <Th w="min-w-[240px]">Observações</Th>
                  <Th w="w-8"></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-t border-border/60 hover:bg-lilac-soft/20">
                    <td className="px-2 text-center text-xs text-muted-foreground">{i + 1}</td>
                    <Td>
                      <CellInput
                        value={r.full_name ?? ""}
                        onChange={(v) => scheduleSave(r.id, { full_name: v })}
                      />
                    </Td>
                    <Td>
                      <CellInput
                        list="relationship-suggestions"
                        value={r.relationship_to_proband ?? ""}
                        onChange={(v) => scheduleSave(r.id, { relationship_to_proband: v })}
                      />
                    </Td>
                    <Td>
                      <CellInput
                        type="date"
                        value={r.birth_date ?? ""}
                        onChange={(v) => scheduleSave(r.id, { birth_date: v || null })}
                      />
                    </Td>
                    <Td>
                      <CellInput
                        value={r.gestational_weeks ?? ""}
                        onChange={(v) => scheduleSave(r.id, { gestational_weeks: v || null })}
                        placeholder="ex. 40s"
                      />
                    </Td>
                    <Td>
                      <CellInput
                        type="date"
                        value={r.death_date ?? ""}
                        onChange={(v) =>
                          scheduleSave(r.id, { death_date: v || null, is_deceased: !!v })
                        }
                      />
                    </Td>
                    <Td>
                      <CellInput
                        value={(r.health_conditions ?? []).join(", ")}
                        onChange={(v) =>
                          scheduleSave(r.id, {
                            health_conditions: v
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="separe por vírgula"
                      />
                    </Td>
                    <Td>
                      <CellInput
                        value={r.occupation ?? ""}
                        onChange={(v) => scheduleSave(r.id, { occupation: v })}
                      />
                    </Td>
                    <Td>
                      <CellInput value={r.vices ?? ""} onChange={(v) => scheduleSave(r.id, { vices: v })} />
                    </Td>
                    <Td>
                      <CellInput
                        value={r.temperament ?? ""}
                        onChange={(v) => scheduleSave(r.id, { temperament: v })}
                      />
                    </Td>
                    <Td>
                      <CellInput
                        type="number"
                        value={r.birth_order?.toString() ?? ""}
                        onChange={(v) =>
                          scheduleSave(r.id, { birth_order: v === "" ? null : Number(v) })
                        }
                      />
                    </Td>
                    <Td>
                      <CellInput
                        value={r.notes ?? ""}
                        onChange={(v) => scheduleSave(r.id, { notes: v })}
                      />
                    </Td>
                    <td className="px-1">
                      <button
                        onClick={() => {
                          if (confirm(`Remover ${r.full_name || "pessoa sem nome"}?`))
                            removePerson.mutate(r.id);
                        }}
                        className="rounded p-1 text-destructive/60 transition hover:bg-destructive/10 hover:text-destructive"
                        title="Remover"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Salvamento automático após 0,9 s sem digitar. Dados aparecem no Genograma e alimentam o
            motor de padrões.
          </p>
        </>
      )}
    </div>
  );
}

function inferGenderFromRelationship(rel?: string): "male" | "female" | undefined {
  if (!rel) return undefined;
  const r = rel.toLowerCase();
  if (/\b(pai|avô|bisavô|tio\b|irmão)\b/.test(r)) return "male";
  if (/\b(mãe|avó|bisavó|tia\b|irmã)\b/.test(r)) return "female";
  return undefined;
}

function Th({ children, w }: { children?: React.ReactNode; w?: string }) {
  return <th className={`px-2 py-2 text-left font-medium ${w ?? ""}`}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-1 py-1">{children}</td>;
}

function CellInput(props: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  list?: string;
}) {
  return (
    <input
      type={props.type ?? "text"}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      list={props.list}
      className="w-full rounded-sm border-0 bg-transparent px-2 py-1.5 text-sm text-foreground outline-none ring-1 ring-transparent transition focus:bg-background focus:ring-primary/40"
    />
  );
}
