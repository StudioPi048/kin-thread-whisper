import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Download, Table2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

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
    <div className="space-y-6 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold mb-1">
            Planilha do Clã
          </p>
          <h2 className="font-serif text-3xl font-bold text-primary">Atlas Familiar</h2>
          <p className="mt-2 text-[14px] text-muted-foreground max-w-xl leading-relaxed">
            Mapeie o sistema familiar de forma ágil em lista. Cada linha digitada aqui atualiza o Genograma e alimenta o motor de padrões clínicos.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0} className="font-bold">
            <Download className="size-4 mr-2" /> Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={scaffoldTemplate} className="font-bold">
            <Table2 className="size-4 mr-2" /> Aplicar modelo (4 gerações)
          </Button>
          <Button size="sm" onClick={() => addPerson.mutate(undefined)} variant="lavender">
            <Plus className="size-4 mr-2" /> Nova pessoa
          </Button>
        </div>
      </header>

      {rows.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-sm border border-dashed border-border bg-lavender-soft/40 p-16 text-center"
        >
          <Table2 className="mx-auto size-10 text-lavender opacity-60" />
          <p className="mt-4 font-serif text-2xl font-bold text-primary">Planilha Vazia</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-muted-foreground leading-relaxed">
            Aplique o modelo com as 40 linhas de parentesco padrão (consulente até bisavós dos dois lados)
            e digite as informações rapidamente como num Excel.
          </p>
          <Button className="mt-6 font-bold" variant="lavender" onClick={scaffoldTemplate}>
            <Plus className="size-4 mr-2" /> Aplicar Modelo Próprio
          </Button>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <datalist id="relationship-suggestions">
            {RELATIONSHIP_OPTIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>

          <div className="overflow-x-auto rounded-sm border-2 border-border/80 bg-white shadow-sm">
            <table className="w-full min-w-[1500px] border-collapse text-[13px]">
              <thead className="bg-lavender-soft text-[10px] font-bold uppercase tracking-[0.15em] text-plum border-b-2 border-border/80">
                <tr>
                  <Th w="w-8">#</Th>
                  <Th w="min-w-[180px]">Nome</Th>
                  <Th w="min-w-[180px]">Parentesco</Th>
                  <Th w="w-36">Nascimento</Th>
                  <Th w="w-24">Gestação</Th>
                  <Th w="w-36">Morte</Th>
                  <Th w="min-w-[160px]">Enfermidades</Th>
                  <Th w="min-w-[140px]">Profissão</Th>
                  <Th w="min-w-[120px]">Vícios</Th>
                  <Th w="min-w-[120px]">Temperamento</Th>
                  <Th w="w-16">Ordem</Th>
                  <Th w="min-w-[240px]">Observações</Th>
                  <Th w="w-10"></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-b border-border/40 hover:bg-lavender-soft/20 transition-colors">
                    <td className="px-3 text-center text-[11px] font-mono font-medium text-muted-foreground/60">{i + 1}</td>
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
                        placeholder="separar por vírgula"
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
                    <td className="px-1 text-center">
                      <button
                        onClick={() => {
                          if (confirm(`Remover ${r.full_name || "pessoa sem nome"}?`))
                            removePerson.mutate(r.id);
                        }}
                        className="rounded p-1.5 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="Remover"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground/60">
              Salvamento automático a cada digitação (0.9s)
            </p>
          </div>
        </motion.div>
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
  return <th className={`px-3 py-3 text-left font-bold ${w ?? ""}`}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-1 py-1 relative group">{children}</td>;
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
      className="w-full h-8 rounded-sm border-0 bg-transparent px-2 text-[13px] font-medium text-foreground outline-none ring-1 ring-transparent transition-all focus:bg-lavender-soft/30 focus:ring-lavender placeholder:text-muted-foreground/40"
    />
  );
}
