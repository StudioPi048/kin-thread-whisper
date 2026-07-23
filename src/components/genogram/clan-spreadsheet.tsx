import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  Trash2,
  Download,
  Table2,
  Upload,
  Sparkles,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

import { smartNormalizeRelationship, genealogicalOrder } from "@/lib/relationship-normalizer";
import { ensureProband } from "@/lib/ensure-proband";
import { RelationshipCombobox } from "./relationship-combobox";
import { buildLogicalGraph } from "@/lib/geno/build";

type Person = Tables<"genogram_persons">;
type Props = { clientId: string };

const RELATIONSHIP_TEMPLATE = [
  "Consulente",
  "Irmã(o)",
  "Irmã(o)",
  "Irmã(o)",
  "Pai",
  "Irmã(o) do Pai",
  "Irmã(o) do Pai",
  "Irmã(o) do Pai",
  "Avô paterno",
  "Irmã(o) do avô paterno",
  "Irmã(o) do avô paterno",
  "Bisavô paterno (pai do avô)",
  "Irmã(o) do Bisavô paterno (pai do avô)",
  "Bisavó paterna (mãe do avô)",
  "Irmã(o) da Bisavó paterna (mãe do avô)",
  "Avó paterna",
  "Irmã(o) da avó paterna",
  "Irmã(o) da avó paterna",
  "Bisavô paterno (pai da avó)",
  "Irmã(o) do Bisavô paterno (pai da avó)",
  "Bisavó paterna (mãe da avó)",
  "Irmã(o) da Bisavó paterna (mãe da avó)",
  "Mãe",
  "Irmã(o) da Mãe",
  "Irmã(o) da Mãe",
  "Irmã(o) da Mãe",
  "Avô materno",
  "Irmã(o) do avô materno",
  "Irmã(o) do avô materno",
  "Bisavô materno (pai do avô)",
  "Irmã(o) do Bisavô materno (pai do avô)",
  "Bisavó materna (mãe do avô)",
  "Irmã(o) da Bisavó materna (mãe do avô)",
  "Avó materna",
  "Irmã(o) da avó materna",
  "Irmã(o) da avó materna",
  "Bisavô materno (pai da avó)",
  "Irmã(o) do Bisavô materno (pai da avó)",
  "Bisavó materna (mãe da avó)",
  "Irmã(o) da Bisavó materna (mãe da avó)",
] as const;

export function ClanSpreadsheet({ clientId }: Props) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Partial<Person>>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingPatch = useRef<Record<string, TablesUpdate<"genogram_persons">>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Confirmação genérica em modal (substitui window.confirm nativo) — resolve
  // a promise conforme o botão clicado; fechar de qualquer outra forma conta como recusa.
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    resolve: (v: boolean) => void;
  } | null>(null);
  const askConfirm = (opts: {
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
  }) => new Promise<boolean>((resolve) => setConfirmState({ ...opts, resolve }));

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
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao remover pessoa"),
  });

  const removeEmptyPersons = useMutation({
    mutationFn: async () => {
      const emptyIds = (persons ?? [])
        .filter((p) => !p.is_proband && !p.full_name?.trim() && !p.birth_date?.trim())
        .map((p) => p.id);

      if (emptyIds.length === 0) return 0;

      const { error } = await supabase.from("genogram_persons").delete().in("id", emptyIds);
      if (error) throw error;
      return emptyIds.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["genogram-persons", clientId] });
      if (count > 0) toast.success(`${count} linhas vazias removidas.`);
      else toast.info("Nenhuma linha vazia encontrada.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao limpar planilha"),
  });

  const deleteAllPersons = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("genogram_persons").delete().eq("client_id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["genogram-persons", clientId] });
      toast.success("Planilha completamente apagada.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao apagar planilha"),
  });

  const scheduleSave = (id: string, patch: TablesUpdate<"genogram_persons">) => {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
    // Acumula num ref (síncrono) em vez de confiar no `patch` capturado pelo
    // closure do setTimeout — senão, editar dois campos em menos de 900ms
    // faz o timer do primeiro ser cancelado e só o último campo é salvo.
    pendingPatch.current[id] = { ...pendingPatch.current[id], ...patch };
    if (timers.current[id]) clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => {
      const fullPatch = pendingPatch.current[id];
      delete pendingPatch.current[id];
      savePerson.mutate({ id, patch: fullPatch });
    }, 900);
  };

  useEffect(() => {
    const t = timers.current;
    return () => {
      Object.values(t).forEach(clearTimeout);
    };
  }, []);

  // Cliente é sempre o foco: garante que o proband exista no genograma,
  // espelhando os dados do cadastro clínico. Roda uma vez ao abrir a aba.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await ensureProband(clientId);
      if (!cancelled && result) {
        qc.invalidateQueries({ queryKey: ["genogram-persons", clientId] });
        qc.invalidateQueries({ queryKey: ["genogram", clientId] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, qc]);

  const rows = useMemo(() => {
    const base = (persons ?? []).map((p) => ({ ...p, ...(drafts[p.id] ?? {}) }));
    // Ordena genealogicamente: Consulente no topo, depois por geração
    return base.sort((a, b) => {
      const orderA = genealogicalOrder(a.relationship_to_proband);
      const orderB = genealogicalOrder(b.relationship_to_proband);
      if (orderA !== orderB) return orderA - orderB;
      // Dentro do mesmo rank, ordena por nome
      return (a.full_name ?? "").localeCompare(b.full_name ?? "");
    });
  }, [persons, drafts]);

  // Mesmo motor do genossociograma, só pra saber quem vai ficar solto na
  // árvore e por quê — sem precisar abrir a aba do desenho pra descobrir.
  const warningsByPersonId = useMemo(() => {
    const map = new Map<string, string>();
    if (rows.length === 0) return map;
    const g = buildLogicalGraph({ persons: rows, rels: [] });
    for (const w of g.warnings) map.set(w.personId, w.message);
    return map;
  }, [rows]);

  const scaffoldTemplate = async () => {
    if (rows.length > 0) {
      const ok = await askConfirm({
        title: "Aplicar modelo mesmo assim?",
        description: `Já existem ${rows.length} pessoas cadastradas. Adicionar as ${RELATIONSHIP_TEMPLATE.length} linhas do modelo mesmo assim?`,
        confirmLabel: "Aplicar modelo",
      });
      if (!ok) return;
    }
    for (const rel of RELATIONSHIP_TEMPLATE) {
      await addPerson.mutateAsync(rel);
    }
    toast.success("Modelo aplicado. Complete os nomes e datas.");
  };

  const importFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        let parsedRows: string[][] = [];

        if (file.name.toLowerCase().endsWith(".xlsx")) {
          // Process Excel
          const XLSX = await import("xlsx");
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array", cellDates: true });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          // cellDates:true garante que células de data do Excel virem como Date objects
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: true,
          }) as unknown[][];

          if (jsonData.length < 2) throw new Error("Arquivo vazio ou sem cabeçalho.");

          parsedRows = jsonData
            .slice(1)
            .filter((row) =>
              row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== ""),
            )
            .map((row) =>
              Array.from({ length: 11 }).map((_, i) => {
                const cell = row[i];

                // 1) Objeto Date nativo (cellDates:true funcionou)
                if (cell instanceof Date) {
                  const y = cell.getUTCFullYear();
                  const m = String(cell.getUTCMonth() + 1).padStart(2, "0");
                  const d = String(cell.getUTCDate()).padStart(2, "0");
                  return `${y}-${m}-${d}`;
                }

                // 2) Número serial do Excel (ex: 44927 = 2023-01-01)
                // Fórmula: epoch Excel = 1899-12-30, epoch JS = 1970-01-01
                // Diferença = 25569 dias. (serial - 25569) * 86400000 = ms JS
                if (typeof cell === "number" && cell > 25000 && cell < 60000) {
                  const jsDate = new Date((cell - 25569) * 86400000);
                  const y = jsDate.getUTCFullYear();
                  const m = String(jsDate.getUTCMonth() + 1).padStart(2, "0");
                  const d = String(jsDate.getUTCDate()).padStart(2, "0");
                  return `${y}-${m}-${d}`;
                }

                return cell !== undefined && cell !== null ? String(cell) : "";
              }),
            );
        } else {
          // Process CSV
          const text = event.target?.result as string;
          if (!text) throw new Error("Erro ao ler o texto do arquivo.");

          const lines = text.split(/\r?\n/).filter((line) => line.trim());
          if (lines.length < 2) throw new Error("Arquivo vazio ou sem cabeçalho.");

          const separator = lines[0].includes(";") ? ";" : ",";
          parsedRows = lines.slice(1).map((line) => {
            const regex = new RegExp(`(?:^|${separator})(?:"([^"]*)"|([^${separator}]*))`, "g");
            const row: string[] = [];
            let match;
            while ((match = regex.exec(line)) !== null) {
              row.push(match[1] || match[2] || "");
            }
            return row;
          });
        }

        // Pergunta se deseja substituir a planilha inteira
        const shouldOverwrite =
          persons && persons.length > 0
            ? await askConfirm({
                title: "Substituir a planilha atual?",
                description:
                  "Você pode apagar tudo e usar só os dados do arquivo, ou manter o que já está aqui e adicionar as novas linhas no final.",
                confirmLabel: "Apagar tudo e usar o arquivo",
                cancelLabel: "Manter e adicionar no final",
                destructive: true,
              })
            : false;

        let currentContext = "Consulente";

        // Normalizar e filtrar: skip linhas sem nenhum dado útil
        const inserts = parsedRows
          .filter((r) => r.length > 1)
          .map((row) => {
            const [
              nome,
              parentesco,
              nascimento,
              gestacao,
              morte,
              enfermidades,
              profissao,
              vicios,
              temperamento,
              ordem,
              obs,
            ] = row;

            let rawRel = parentesco?.trim() || "";
            const lowerRel = rawRel.toLowerCase();

            // Se for um ancestral direto, salva como contexto atual
            if (rawRel && !lowerRel.includes("irmã") && !lowerRel.includes("irmão")) {
              currentContext = rawRel;
            }
            // Se for SÓ "irmãos" genérico abaixo de um ancestral, injeta o contexto para o sistema entender
            else if (
              lowerRel === "irmãos" ||
              lowerRel === "irmãs" ||
              lowerRel === "irmão" ||
              lowerRel === "irmã" ||
              lowerRel === "irmao" ||
              lowerRel === "irma" ||
              lowerRel === "irmaos"
            ) {
              if (currentContext !== "Consulente" && currentContext !== "Paciente") {
                // Preposição precisa bater com o gênero da âncora (do Pai / da
                // Mãe / do Avô / da Avó...), senão o normalizador não reconhece
                // o texto e a pessoa desaparece da árvore.
                const prep = /mãe|avó|bisavó/i.test(currentContext) ? "da" : "do";
                rawRel = `Irmã(o) ${prep} ${currentContext}`;
              }
            }

            // Apenas para inferir o gênero corretamente no momento do import
            const relCanonical = rawRel ? smartNormalizeRelationship(rawRel) : null;

            return {
              client_id: clientId,
              full_name: nome?.trim() || "",
              relationship_to_proband: rawRel || null, // Mantém a nomenclatura que o usuário digitou (com o contexto injetado se necessário)
              gender: inferGenderFromRelationship(relCanonical ?? "") || "unknown",
              birth_date: parseDateString(nascimento),
              gestational_weeks: gestacao?.trim() || null,
              death_date: parseDateString(morte),
              is_deceased: !!morte?.trim(),
              health_conditions: enfermidades
                ? enfermidades
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : [],
              occupation: profissao?.trim() || null,
              vices: vicios?.trim() || null,
              temperament: temperamento?.trim() || null,
              birth_order: ordem && !isNaN(parseInt(ordem)) ? parseInt(ordem) : null,
              notes: obs?.trim() || null,
            };
          })
          // Remove linhas vazias E a linha "Consulente" — o proband vem do cadastro do cliente
          .filter(
            (r) => (!!r.full_name || !!r.birth_date) && r.relationship_to_proband !== "Consulente",
          );

        if (inserts.length > 0) {
          if (shouldOverwrite) {
            const { error: delError } = await supabase
              .from("genogram_persons")
              .delete()
              .eq("client_id", clientId);
            if (delError) throw delError;
          }

          const { error } = await supabase.from("genogram_persons").insert(inserts);
          if (error) {
            console.error("Insert error:", error);
            throw new Error(`Erro no banco de dados: ${error.message}`);
          }

          // Garante o proband a partir do cadastro do cliente
          await ensureProband(clientId);

          qc.invalidateQueries({ queryKey: ["genogram-persons", clientId] });
          qc.invalidateQueries({ queryKey: ["genogram", clientId] });
          toast.success(`${inserts.length} familiares importados com sucesso!`);
        } else {
          toast.info("Nenhum dado válido encontrado para importar.");
        }
      } catch (error) {
        console.error("Import Error:", error);
        toast.error(`Erro ao importar: ${(error as Error)?.message || "Verifique o formato."}`);
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    if (file.name.toLowerCase().endsWith(".xlsx")) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
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
          <p className="text-[14px] font-bold uppercase tracking-[0.2em] text-gold mb-1">
            Planilha do Clã
          </p>
          <h2 className="font-serif text-3xl font-bold text-primary">Atlas Familiar</h2>
          <p className="mt-2 text-[14px] text-muted-foreground max-w-xl leading-relaxed">
            Mapeie o sistema familiar de forma ágil em lista. Cada linha digitada aqui atualiza o
            Genograma e alimenta o motor de padrões clínicos.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <input
            type="file"
            accept=".csv, .xlsx"
            className="hidden"
            ref={fileInputRef}
            onChange={importFile}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="font-bold border-forest/20 text-forest hover:bg-forest/5"
          >
            {isImporting ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Upload className="size-4 mr-2" />
            )}
            Importar XLS/CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => removeEmptyPersons.mutate()}
            disabled={removeEmptyPersons.isPending}
            className="font-bold border-clinical-warning/25 text-clinical-warning hover:bg-clinical-warning/5"
            title="Remove linhas sem nome e data"
          >
            {removeEmptyPersons.isPending ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="size-4 mr-2" />
            )}
            Limpar vazios
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const ok = await askConfirm({
                title: "Apagar toda a planilha?",
                description:
                  "Isso remove TODAS as linhas cadastradas para este cliente. Esta ação não pode ser desfeita.",
                confirmLabel: "Apagar tudo",
                destructive: true,
              });
              if (ok) deleteAllPersons.mutate();
            }}
            disabled={deleteAllPersons.isPending}
            className="font-bold border-destructive/20 text-destructive hover:bg-destructive/5"
            title="Apaga a planilha inteira"
          >
            {deleteAllPersons.isPending ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="size-4 mr-2" />
            )}
            Limpar Tudo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="font-bold"
          >
            <Download className="size-4 mr-2" /> Exportar CSV
          </Button>
          <Button size="sm" onClick={() => addPerson.mutate(undefined)} variant="forest">
            <Plus className="size-4 mr-2" /> Nova pessoa
          </Button>
        </div>
      </header>

      {rows.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-sm border-2 border-dashed border-border bg-surface-document shadow-sm p-12 text-center relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
            <img src="/data_import.png" alt="" className="w-[300px] h-[300px] object-cover" />
          </div>
          <div className="relative z-10 flex flex-col items-center">
            <Table2 className="mx-auto size-12 text-forest opacity-80 mb-4" />
            <h3 className="font-serif text-3xl font-bold text-primary">Nenhum dado mapeado</h3>
            <p className="mx-auto mt-3 max-w-md text-[14px] text-muted-foreground leading-relaxed">
              Você pode importar uma planilha CSV com os dados da família, aplicar o modelo de 4
              gerações ou adicionar as pessoas uma a uma.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Button
                className="font-bold"
                variant="forest"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4 mr-2" /> Importar CSV/XLSX
              </Button>
              <Button className="font-bold" variant="outline" onClick={scaffoldTemplate}>
                <Table2 className="size-4 mr-2" /> Aplicar Modelo Próprio
              </Button>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <p className="mb-1.5 text-[13px] font-bold uppercase tracking-[0.1em] text-muted-foreground md:hidden">
            ← Arraste pra o lado pra ver todas as colunas →
          </p>
          <div className="overflow-x-auto rounded-sm border-2 border-border/80 bg-surface-document shadow-sm">
            <table className="w-full min-w-[760px] border-collapse text-[16px]">
              <thead className="bg-forest-soft/40 text-[14px] font-bold uppercase tracking-[0.15em] text-forest border-b-2 border-border/80">
                <tr>
                  <Th w="w-11">#</Th>
                  <Th w="min-w-[170px]" sticky>
                    Nome
                  </Th>
                  <Th w="min-w-[220px]">Parentesco</Th>
                  <Th w="w-32">Nascimento</Th>
                  <Th w="w-32">Morte</Th>
                  <Th w="w-14"></Th>
                  <Th w="w-10"></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const expanded = expandedRows.has(r.id);
                  const hasSecondaryData = !!(
                    r.gestational_weeks?.trim() ||
                    (r.health_conditions ?? []).length > 0 ||
                    r.occupation?.trim() ||
                    r.vices?.trim() ||
                    r.temperament?.trim() ||
                    r.birth_order != null ||
                    r.notes?.trim()
                  );
                  return (
                    <Fragment key={r.id}>
                      <tr className="border-b border-border/40 hover:bg-forest-soft/20 transition-colors">
                        <td className="px-3 text-center text-[14px] font-mono font-medium text-muted-foreground">
                          {i + 1}
                        </td>
                        <td className="px-1 py-1 sticky left-0 z-10 bg-surface-document shadow-[4px_0_6px_-4px_rgba(58,45,30,0.2)]">
                          <CellInput
                            value={r.full_name ?? ""}
                            onChange={(v) => scheduleSave(r.id, { full_name: v })}
                          />
                        </td>
                        <Td>
                          <div className="relative flex w-full items-center">
                            <RelationshipCombobox
                              value={r.relationship_to_proband ?? ""}
                              onChange={(v) => scheduleSave(r.id, { relationship_to_proband: v })}
                              hasWarning={
                                (!r.relationship_to_proband?.trim() && !!r.full_name?.trim()) ||
                                warningsByPersonId.has(r.id)
                              }
                              triggerClassName="w-full h-11 rounded-sm border-0 bg-transparent px-2 text-[16px] font-medium ring-1 ring-transparent hover:bg-forest-soft/20 focus:bg-forest-soft/30 focus:ring-forest"
                            />
                            {(() => {
                              const missingRel =
                                !r.relationship_to_proband?.trim() && !!r.full_name?.trim();
                              const graphWarning = warningsByPersonId.get(r.id);
                              const title = missingRel
                                ? "Vínculo pendente! Esta pessoa não aparecerá conectada na árvore."
                                : graphWarning;
                              if (!title) return null;
                              return (
                                <div
                                  className="absolute right-2 text-clinical-critical"
                                  title={title}
                                >
                                  <AlertCircle className="size-4" />
                                </div>
                              );
                            })()}
                          </div>
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
                            type="date"
                            value={r.death_date ?? ""}
                            onChange={(v) =>
                              scheduleSave(r.id, { death_date: v || null, is_deceased: !!v })
                            }
                          />
                        </Td>
                        <td className="px-1 text-center">
                          <button
                            onClick={() => toggleExpanded(r.id)}
                            className="relative rounded h-11 w-11 flex items-center justify-center text-muted-foreground transition-colors hover:bg-forest-soft/40 hover:text-forest"
                            title="Enfermidades, profissão, vícios, temperamento, ordem, observações e gestação"
                          >
                            {expanded ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                            {!expanded && hasSecondaryData && (
                              <span className="absolute top-2 right-2 size-1.5 rounded-full bg-gold" />
                            )}
                          </button>
                        </td>
                        <td className="px-1 text-center">
                          <button
                            onClick={async () => {
                              const ok = await askConfirm({
                                title: "Remover pessoa?",
                                description: `Remover ${r.full_name || "pessoa sem nome"} da planilha?`,
                                confirmLabel: "Remover",
                                destructive: true,
                              });
                              if (ok) removePerson.mutate(r.id);
                            }}
                            className="rounded h-11 w-11 flex items-center justify-center text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            title="Remover"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-border/40 bg-forest-soft/10">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="flex flex-wrap gap-4">
                              <DetailField label="Gestação" w="w-24">
                                <CellInput
                                  value={r.gestational_weeks ?? ""}
                                  onChange={(v) =>
                                    scheduleSave(r.id, { gestational_weeks: v || null })
                                  }
                                  placeholder="ex. 40s"
                                />
                              </DetailField>
                              <DetailField label="Enfermidades" w="min-w-[200px]">
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
                              </DetailField>
                              <DetailField label="Profissão" w="min-w-[160px]">
                                <CellInput
                                  value={r.occupation ?? ""}
                                  onChange={(v) => scheduleSave(r.id, { occupation: v })}
                                />
                              </DetailField>
                              <DetailField label="Vícios" w="min-w-[140px]">
                                <CellInput
                                  value={r.vices ?? ""}
                                  onChange={(v) => scheduleSave(r.id, { vices: v })}
                                />
                              </DetailField>
                              <DetailField label="Temperamento" w="min-w-[140px]">
                                <CellInput
                                  value={r.temperament ?? ""}
                                  onChange={(v) => scheduleSave(r.id, { temperament: v })}
                                />
                              </DetailField>
                              <DetailField label="Ordem" w="w-16">
                                <CellInput
                                  type="number"
                                  value={r.birth_order?.toString() ?? ""}
                                  onChange={(v) =>
                                    scheduleSave(r.id, {
                                      birth_order: v === "" ? null : Number(v),
                                    })
                                  }
                                />
                              </DetailField>
                              <DetailField label="Observações" w="min-w-[260px] flex-1">
                                <CellInput
                                  value={r.notes ?? ""}
                                  onChange={(v) => scheduleSave(r.id, { notes: v })}
                                />
                              </DetailField>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[14px] uppercase tracking-[0.1em] font-bold text-muted-foreground">
              Salvamento automático a cada digitação (0.9s)
            </p>
          </div>
        </motion.div>
      )}

      <AlertDialog
        open={!!confirmState}
        onOpenChange={(o) => {
          if (!o) {
            confirmState?.resolve(false);
            setConfirmState(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-ink">
              {confirmState?.title}
            </AlertDialogTitle>
            <AlertDialogDescription>{confirmState?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{confirmState?.cancelLabel ?? "Cancelar"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmState?.resolve(true)}
              className={
                confirmState?.destructive
                  ? "bg-clinical-critical text-white hover:bg-clinical-critical/90"
                  : undefined
              }
            >
              {confirmState?.confirmLabel ?? "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function parseDateString(d?: string): string | null {
  if (!d) return null;
  const val = String(d).trim();
  if (!val) return null;

  // ISO YYYY-MM-DD (já normalizado)
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return isValidYMD(val) ? val : null;
  }

  // Aceita separadores /, -, ., ou \ com espaços opcionais
  const parts = val
    .split(/[/\\\-. \t]/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 3) {
    if (!parts.every((p) => /^\d+$/.test(p))) return null;
    const nums = parts.map(Number);

    let dd: string, mm: string, yy: string;

    // Detecta o formato pelo tamanho e range dos valores
    // Se o primeiro número > 31, provavelmente é o ano (YYYY/MM/DD)
    if (nums[0] > 31) {
      [yy, mm, dd] = parts;
    }
    // Se o terceiro número > 31 ou tem 4 dígitos, é DD/MM/YYYY ou MM/DD/YYYY
    else if (nums[2] > 31 || parts[2].length === 4) {
      // Distingue DD/MM/YYYY de MM/DD/YYYY:
      // Se o primeiro número > 12, é dia (não pode ser mês)
      if (nums[0] > 12) {
        [dd, mm, yy] = parts; // DD/MM/YYYY (brasileiro)
      } else if (nums[1] > 12) {
        [mm, dd, yy] = parts; // MM/DD/YYYY (americano)
      } else {
        // Ambíguo: assume brasileiro (DD/MM/YYYY) por ser o padrão local
        [dd, mm, yy] = parts;
      }
    } else {
      // Fallback: assume DD/MM/YY
      [dd, mm, yy] = parts;
    }

    // Ano com 2 dígitos: 00-30 → 2000-2030, 31-99 → 1931-1999
    if (yy.length === 2) {
      const n = parseInt(yy, 10);
      yy = String(n <= 30 ? 2000 + n : 1900 + n);
    }
    if (yy.length !== 4) return null;

    const iso = `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    return isValidYMD(iso) ? iso : null;
  }

  // Apenas dia e mês (ex.: "01/03" ou "14\08") → assume o ano 2000 temporariamente para não perder o dado
  if (parts.length === 2 && parts.every((p) => /^\d+$/.test(p))) {
    const [p1, p2] = parts;
    let dd = p1,
      mm = p2;
    if (Number(p1) > 12) {
      // P1 não pode ser mês, então é DD/MM
      dd = p1;
      mm = p2;
    } else if (Number(p2) > 12) {
      // P2 não pode ser mês, então é MM/DD
      mm = p1;
      dd = p2;
    }
    const iso = `2000-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    return isValidYMD(iso) ? iso : null;
  }

  // Apenas ano (ex.: "1985") → assume 01/01 para não perder o dado
  if (/^\d{4}$/.test(val)) return `${val}-01-01`;

  return null;
}

function isValidYMD(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function Th({ children, w, sticky }: { children?: React.ReactNode; w?: string; sticky?: boolean }) {
  return (
    <th
      className={`px-3 py-3 text-left font-bold ${w ?? ""} ${sticky ? "sticky left-0 z-20 bg-forest-soft/40 shadow-[4px_0_6px_-4px_rgba(58,45,30,0.25)]" : ""}`}
    >
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-1 py-1 relative group">{children}</td>;
}

function DetailField({
  label,
  w,
  children,
}: {
  label: string;
  w?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${w ?? ""}`}>
      <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function CellInput(props: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  list?: string;
  className?: string;
}) {
  return (
    <input
      type={props.type ?? "text"}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      list={props.list}
      className={`w-full h-11 rounded-sm border-0 bg-transparent px-2 text-[16px] font-medium text-foreground outline-none ring-1 ring-transparent transition-all focus:bg-forest-soft/30 focus:ring-forest placeholder:text-muted-foreground/40 ${props.className ?? ""}`}
    />
  );
}
