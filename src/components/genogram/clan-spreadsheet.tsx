import {
  clinicalIntelQuery,
  getMappablePersons,
  invalidateCase,
  type ClinicalIntelData,
} from "@/lib/clinical-intel";
import { useUnsaved } from "@/components/unsaved/unsaved-guard";
import { KeyedDebounce } from "@/lib/unsaved";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Loader2,
  Plus,
  Trash2,
  Download,
  Table2,
  Upload,
  Sparkles,
  MapPin,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

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

import { genealogicalOrder } from "@/lib/relationship-normalizer";
import { ensureProband } from "@/lib/ensure-proband";
import { RelationshipCombobox } from "./relationship-combobox";
import { buildLogicalGraph, getResolvedParents, type LogicalGraph } from "@/lib/geno/build";
import {
  inferGenderFromRelationship,
  readClanFile,
  autoMap,
  analyzeImport,
  IMPORT_FIELDS,
  type Mapping,
  type ImportRecord,
} from "@/lib/clan-import";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Person = Tables<"genogram_persons">;
type Props = { clientId: string };

const RELATIONSHIP_TEMPLATE = [
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

function previewPerson(clientId: string, line: number, record: ImportRecord): Person {
  return {
    ...record,
    id: `import:${line}`,
    client_id: clientId,
    is_proband: false,
    preferred_name: null,
    cause_of_death: null,
    life_events: [],
    position_x: 0,
    position_y: 0,
    tags: [],
    created_at: "",
    updated_at: "",
  };
}

function parentSummary(graph: LogicalGraph, personId: string) {
  const parents = getResolvedParents(graph, personId);
  const names = parents.map(
    (parent) => graph.persons.get(parent.personId)?.row.full_name.trim() || "Pessoa sem nome",
  );
  return { parents, names };
}

export function ClanSpreadsheet({ clientId }: Props) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Partial<Person>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [newPersonId, setNewPersonId] = useState<string | null>(null);
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

  const familyQuery = clinicalIntelQuery(clientId);
  const { data: family, isLoading, isError, refetch } = useQuery(familyQuery);
  const persons = family?.persons;
  const relationships = family?.relationships;

  const savePerson = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<"genogram_persons"> }) => {
      const { data, error } = await supabase
        .from("genogram_persons")
        .update(patch)
        .eq("client_id", clientId)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (saved, { id, patch }) => {
      qc.setQueryData<ClinicalIntelData>(
        familyQuery.queryKey,
        (current) =>
          current && {
            ...current,
            persons: current.persons.map((person) => (person.id === id ? saved : person)),
          },
      );
      setDrafts((current) => {
        if (!current[id]) return current;
        const next = { ...current[id] };
        for (const key of Object.keys(patch) as (keyof Person)[]) {
          if (Object.is(next[key], patch[key])) delete next[key];
        }
        const pending = { ...current };
        if (Object.keys(next).length) pending[id] = next;
        else delete pending[id];
        return pending;
      });
      void invalidateCase(qc, clientId);
    },
    onError: () => {
      setSaveFailed(true);
      toast.error("Não foi possível salvar a linha. Suas alterações continuam na planilha.");
    },
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
    onSuccess: async (person) => {
      setFilter("");
      setOnlyPending(false);
      setNewPersonId(person.id);
      await invalidateCase(qc, clientId);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao adicionar"),
  });

  const removePerson = useMutation({
    mutationFn: async (id: string) => {
      await queueRef.current!.flush();
      const { error } = await supabase
        .from("genogram_persons")
        .delete()
        .eq("client_id", clientId)
        .eq("id", id)
        .eq("is_proband", false);
      if (error) throw error;
    },
    onSuccess: () => invalidateCase(qc, clientId),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao remover pessoa"),
  });

  const removeEmptyPersons = useMutation({
    mutationFn: async () => {
      await queueRef.current!.flush();
      const latest = await qc.fetchQuery({ ...familyQuery, staleTime: 0 });
      const keepIds = new Set(
        getMappablePersons(latest.persons, latest.relationships).map(({ id }) => id),
      );
      const emptyIds = latest.persons
        .filter((person) => !keepIds.has(person.id))
        .map((person) => person.id);

      if (emptyIds.length === 0) return 0;

      const { error } = await supabase
        .from("genogram_persons")
        .delete()
        .eq("client_id", clientId)
        .eq("is_proband", false)
        .in("id", emptyIds);
      if (error) throw error;
      return emptyIds.length;
    },
    onSuccess: async (count) => {
      await invalidateCase(qc, clientId);
      if (count > 0) toast.success(`${count} linhas vazias removidas.`);
      else toast.info("Nenhuma linha vazia encontrada.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao limpar planilha"),
  });

  const deleteAllPersons = useMutation({
    mutationFn: async () => {
      await queueRef.current!.flush();
      const { error } = await supabase
        .from("genogram_persons")
        .delete()
        .eq("client_id", clientId)
        .eq("is_proband", false);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateCase(qc, clientId);
      toast.success("Familiares removidos. O cadastro do consulente foi mantido.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao apagar planilha"),
  });

  const addTemplate = useMutation({
    mutationFn: async () => {
      await queueRef.current!.flush();
      const latest = await qc.fetchQuery({ ...familyQuery, staleTime: 0 });
      if (latest.persons.some((person) => !person.is_proband)) {
        throw new Error("O modelo pode ser aplicado quando só o consulente estiver na planilha.");
      }
      const { error } = await supabase.from("genogram_persons").insert(
        RELATIONSHIP_TEMPLATE.map((relationship) => ({
          client_id: clientId,
          full_name: "",
          gender: inferGenderFromRelationship(relationship) ?? "desconhecido",
          relationship_to_proband: relationship,
        })),
      );
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateCase(qc, clientId);
      toast.success("Modelo adicionado. Preencha os familiares que deseja mapear.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível aplicar o modelo."),
  });

  // Debounce por linha com flush explícito: sair da aba/página passa pelo
  // guard; em falha o patch volta para a fila e a edição continua na tela.
  const queueRef = useRef<KeyedDebounce<TablesUpdate<"genogram_persons">> | null>(null);
  if (!queueRef.current)
    queueRef.current = new KeyedDebounce<TablesUpdate<"genogram_persons">>(
      (id, patch) => savePersonRef.current({ id, patch }).then(() => {}),
      900,
    );
  const savePersonRef = useRef(savePerson.mutateAsync);
  savePersonRef.current = savePerson.mutateAsync;

  const scheduleSave = (id: string, patch: TablesUpdate<"genogram_persons">) => {
    if (!queueRef.current!.hasPending()) setSaveFailed(false);
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
    queueRef.current!.push(id, patch);
  };

  useUnsaved(`clan:${clientId}`, {
    label: "Planilha do clã",
    isDirty: () => !!queueRef.current?.hasPending(),
    save: async () => {
      await queueRef.current!.flush();
    },
    discard: () => {
      queueRef.current!.discard();
      setDrafts({});
      setSaveFailed(false);
    },
  });

  // Desmontagem sem passar pelo guard (ex.: troca de cliente): envia já o que falta
  useEffect(() => {
    const q = queueRef.current!;
    return () => {
      if (q.hasPending()) void q.flush().catch(() => {});
    };
  }, []);

  // Cliente é sempre o foco: garante que o proband exista no genograma,
  // espelhando os dados do cadastro clínico. Roda uma vez ao abrir a aba.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await ensureProband(clientId);
      if (!cancelled && result) {
        void invalidateCase(qc, clientId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, qc]);

  const [filter, setFilter] = useState("");
  const [showDates, setShowDates] = useState(true);
  const [onlyPending, setOnlyPending] = useState(false);
  const hasDrafts = Object.keys(drafts).length > 0;
  const graph = useMemo(() => {
    const rels = relationships ?? [];
    const mappable = getMappablePersons(persons ?? [], rels);
    return buildLogicalGraph({
      persons: mappable,
      rels,
      probandId: mappable.find((person) => person.is_proband)?.id,
    });
  }, [persons, relationships]);
  const warningByPersonId = useMemo(
    () => new Map(graph.warnings.map((warning) => [warning.personId, warning.message])),
    [graph],
  );
  const rows = useMemo(() => {
    const ordered = [...(persons ?? [])].sort((a, b) => {
      if (a.is_proband !== b.is_proband) return a.is_proband ? -1 : 1;
      if (graph.topRowIds.has(a.id) !== graph.topRowIds.has(b.id)) {
        return graph.topRowIds.has(a.id) ? -1 : 1;
      }
      const generationA = graph.persons.get(a.id)?.generation ?? Infinity;
      const generationB = graph.persons.get(b.id)?.generation ?? Infinity;
      if (generationA !== generationB) return generationA - generationB;
      const orderA = genealogicalOrder(a.relationship_to_proband);
      const orderB = genealogicalOrder(b.relationship_to_proband);
      if (orderA !== orderB) return orderA - orderB;
      return a.full_name.localeCompare(b.full_name) || a.id.localeCompare(b.id);
    });
    return ordered.map((person) => ({ ...person, ...drafts[person.id] }));
  }, [persons, drafts, graph]);
  const visibleRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return rows.filter((row) => {
      if (onlyPending && !graph.pendingPersonIds.has(row.id)) return false;
      return (
        !q ||
        `${row.full_name} ${row.relationship_to_proband ?? ""} ${row.occupation ?? ""}`
          .toLowerCase()
          .includes(q)
      );
    });
  }, [rows, filter, onlyPending, graph]);
  useEffect(() => {
    if (!newPersonId || !visibleRows.some((person) => person.id === newPersonId)) return;
    document.getElementById(`clan-person-${newPersonId}`)?.focus();
    setNewPersonId(null);
  }, [newPersonId, visibleRows]);
  // Teclado: ↑/↓ movem para a mesma coluna da linha vizinha
  const onGridKeyDown = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const el = e.target as HTMLElement;
    if (el.tagName !== "INPUT" || (el as HTMLInputElement).type === "date") return;
    const td = el.closest("td");
    const tr = el.closest("tr");
    if (!td || !tr) return;
    const col = Array.from(tr.children).indexOf(td);
    let next = (
      e.key === "ArrowDown" ? tr.nextElementSibling : tr.previousElementSibling
    ) as HTMLElement | null;
    while (next && next.children.length <= col) {
      next = (
        e.key === "ArrowDown" ? next.nextElementSibling : next.previousElementSibling
      ) as HTMLElement | null;
    }
    const target = next?.children[col]?.querySelector("input") as HTMLInputElement | null;
    if (target) {
      e.preventDefault();
      target.focus();
    }
  };

  const [importPreview, setImportPreview] = useState<{
    header: string[];
    rows: string[][];
    mapping: Mapping;
  } | null>(null);
  const [importReplace, setImportReplace] = useState(false);
  const [importDuplicates, setImportDuplicates] = useState(false);
  const analysis = useMemo(
    () =>
      importPreview
        ? analyzeImport(
            importPreview.rows,
            importPreview.mapping,
            importReplace
              ? []
              : (persons ?? []).map((p) => ({ full_name: p.full_name, birth_date: p.birth_date })),
          )
        : [],
    [importPreview, importReplace, persons],
  );
  const toImport = useMemo(
    () =>
      analysis.filter(
        (row) => row.status === "ok" || (importDuplicates && row.status === "duplicate"),
      ),
    [analysis, importDuplicates],
  );
  const hasRegisteredLinks = !!relationships?.length;
  const importGraph = useMemo(() => {
    if (!importPreview) return null;
    const original = importReplace ? (persons ?? []).filter((p) => p.is_proband) : (persons ?? []);
    const imported = toImport.flatMap((row) =>
      row.record ? [previewPerson(clientId, row.line, row.record)] : [],
    );
    const rels = importReplace ? [] : (relationships ?? []);
    return buildLogicalGraph({
      persons: getMappablePersons([...original, ...imported], rels),
      rels,
      probandId: original.find((person) => person.is_proband)?.id,
    });
  }, [clientId, importPreview, importReplace, persons, relationships, toImport]);
  const confirmImport = useMutation({
    mutationFn: async () => {
      await queueRef.current!.flush();
      const latest = await qc.fetchQuery({ ...familyQuery, staleTime: 0 });
      if (importReplace && latest.relationships.length) {
        throw new Error("Há vínculos registrados. Adicione as linhas ou edite a planilha atual.");
      }
      if (!importPreview) throw new Error("Abra uma planilha para importar.");
      const currentAnalysis = analyzeImport(
        importPreview.rows,
        importPreview.mapping,
        importReplace ? [] : latest.persons,
      );
      const selected = currentAnalysis.filter(
        (row) => row.status === "ok" || (importDuplicates && row.status === "duplicate"),
      );
      if (selected.map((row) => row.line).join(",") !== toImport.map((row) => row.line).join(",")) {
        throw new Error("A planilha mudou. Confira as linhas na prévia antes de confirmar.");
      }
      const records = selected.flatMap((row) => (row.record ? [row.record] : []));
      if (!records.length) throw new Error("Nenhuma linha válida para importar.");
      const { data, error } = await supabase.rpc("import_genogram_persons", {
        _client_id: clientId,
        _rows: records as never,
        _replace: importReplace,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: async (n) => {
      await invalidateCase(qc, clientId);
      toast.success(`${n} familiares importados.`);
      setImportPreview(null);
      setImportReplace(false);
      setImportDuplicates(false);
    },
    onError: (e) =>
      toast.error(
        e instanceof Error
          ? e.message
          : "Não foi possível concluir a importação. Confira a conexão e a prévia.",
      ),
  });

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    setIsImporting(true);
    try {
      const { header, rows } = await readClanFile(
        await file.arrayBuffer(),
        /\.csv$/i.test(file.name) ? "csv" : "xlsx",
      );
      setImportReplace(false);
      setImportDuplicates(false);
      setImportPreview({ header, rows, mapping: autoMap(header) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verifique o formato do arquivo.");
    } finally {
      setIsImporting(false);
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
          r.death_date ?? (r.is_deceased ? "Sim" : ""),
          (r.health_conditions ?? []).join(", "),
          r.occupation ?? "",
          r.vices ?? "",
          r.temperament ?? "",
          r.birth_order ?? "",
          r.notes ?? "",
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

  if (isError && !family) {
    return (
      <div role="alert" className="rounded-md border border-border bg-surface-document p-5">
        <p className="font-semibold text-clinical-critical">
          Não foi possível carregar a planilha.
        </p>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Tente novamente para consultar os familiares e seus vínculos.
        </p>
        <Button variant="outline" className="mt-3 min-h-11" onClick={() => void refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const columnCount = showDates ? 8 : 6;
  const hasRelatives = rows.some((row) => !row.is_proband);
  const pendingCount = graph.pendingPersonIds.size;
  const isChangingRows =
    addPerson.isPending ||
    addTemplate.isPending ||
    removePerson.isPending ||
    removeEmptyPersons.isPending ||
    deleteAllPersons.isPending;
  const isRemovingRows =
    removePerson.isPending || removeEmptyPersons.isPending || deleteAllPersons.isPending;

  return (
    <div className="min-w-0 space-y-4 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">Planilha do clã</h2>
          <p className="mt-2 text-[14px] text-muted-foreground max-w-xl leading-relaxed">
            Edite os dados dos familiares aqui. A coluna Filiação mostra as conexões do mapa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="file"
            accept=".csv, .xlsx"
            className="hidden"
            ref={fileInputRef}
            onChange={importFile}
          />
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting || isChangingRows || isError}
          >
            {isImporting ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Upload className="size-4 mr-2" />
            )}
            Importar CSV/XLSX
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={exportCsv}
            disabled={rows.length === 0}
          >
            <Download className="size-4 mr-2" /> Exportar CSV
          </Button>
          <Button
            className="min-h-11"
            onClick={() => addPerson.mutate(undefined)}
            variant="forest"
            disabled={isChangingRows || isError}
          >
            <Plus className="size-4 mr-2" /> Nova pessoa
          </Button>
        </div>
      </header>

      {isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3"
        >
          <p className="text-[14px] text-clinical-warning">A planilha pode estar desatualizada.</p>
          <Button variant="outline" className="min-h-11" onClick={() => void refetch()}>
            Atualizar dados
          </Button>
        </div>
      )}

      {!hasRelatives && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-document p-4">
          <p className="max-w-lg text-[14px] text-muted-foreground">
            Adicione familiares individualmente ou comece com campos para quatro gerações.
          </p>
          <Button
            className="min-h-11"
            variant="outline"
            onClick={() => addTemplate.mutate()}
            disabled={isChangingRows || isError}
          >
            <Table2 className="size-4 mr-2" />
            {addTemplate.isPending ? "Aplicando…" : "Usar modelo de 4 gerações"}
          </Button>
        </div>
      )}

      {rows.length > 0 && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="flex flex-1 items-center gap-2 text-[15px]">
              <span className="sr-only">Buscar na planilha</span>
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Buscar por nome, parentesco ou profissão"
                className="h-11 w-full max-w-md rounded-md border border-input bg-background px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="flex min-h-11 items-center gap-2 text-[15px]">
              <input
                type="checkbox"
                className="size-5"
                checked={showDates}
                onChange={(e) => setShowDates(e.target.checked)}
              />
              Colunas de datas
            </label>
            <span className="text-[14px] text-muted-foreground" role="status">
              {visibleRows.length} de {rows.length}
            </span>
            {pendingCount > 0 && (
              <Button
                variant="outline"
                className="min-h-11"
                aria-pressed={onlyPending}
                onClick={() => setOnlyPending((active) => !active)}
              >
                {onlyPending
                  ? "Mostrar todos"
                  : `${pendingCount} ${pendingCount === 1 ? "filiação a revisar" : "filiações a revisar"}`}
              </Button>
            )}
            {pendingCount === 0 && onlyPending && (
              <Button variant="outline" className="min-h-11" onClick={() => setOnlyPending(false)}>
                Mostrar todos
              </Button>
            )}
          </div>
          <p className="mb-2 text-[14px] text-muted-foreground md:hidden">
            Deslize na tabela para ver as outras colunas.
          </p>
          <fieldset
            disabled={isRemovingRows || confirmImport.isPending}
            className="min-w-0 max-h-[70vh] overflow-auto rounded-md border border-border bg-surface-document"
          >
            <table className="w-full min-w-[760px] border-collapse text-[16px]">
              <thead className="sticky top-0 z-30 border-b border-border bg-card text-[14px] font-semibold text-forest">
                <tr>
                  <Th w="w-11">#</Th>
                  <ResizableTh label="Nome" initial={200} sticky />
                  <ResizableTh label="Parentesco informado" initial={210} />
                  <ResizableTh label="Filiação no mapa" initial={215} />
                  {showDates && <ResizableTh label="Nascimento" initial={140} />}
                  {showDates && <ResizableTh label="Morte" initial={140} />}
                  <Th w="w-14"></Th>
                  <Th w="w-10"></Th>
                </tr>
              </thead>
              <tbody onKeyDown={onGridKeyDown}>
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={columnCount} className="p-4 text-[15px] text-muted-foreground">
                      Nenhum familiar corresponde à busca.
                    </td>
                  </tr>
                )}
                {visibleRows.map((r, i) => {
                  const expanded = expandedRows.has(r.id);
                  const onMap = graph.persons.has(r.id);
                  const { parents, names } = parentSummary(graph, r.id);
                  const warning = warningByPersonId.get(r.id);
                  const pending = graph.pendingPersonIds.has(r.id);
                  const relationLabel = parents.some((parent) => parent.source === "legacy")
                    ? "Sugerida pelo parentesco"
                    : "Registrada";
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
                        <td className="px-3 text-center text-[14px] tabular-nums text-muted-foreground">
                          {i + 1}
                        </td>
                        <td className="px-1 py-1 bg-surface-document md:sticky md:left-0 md:z-10">
                          <CellInput
                            id={`clan-person-${r.id}`}
                            value={r.full_name ?? ""}
                            onChange={(v) => scheduleSave(r.id, { full_name: v })}
                            ariaLabel={`Nome da linha ${i + 1}`}
                          />
                        </td>
                        <Td>
                          {r.is_proband ? (
                            <span className="px-2 text-[15px] font-medium">Consulente</span>
                          ) : (
                            <RelationshipCombobox
                              value={r.relationship_to_proband ?? ""}
                              onChange={(v) => scheduleSave(r.id, { relationship_to_proband: v })}
                              hasWarning={pending || Boolean(warning)}
                              triggerClassName="w-full h-11 rounded-sm border-0 bg-transparent px-2 text-[16px] font-medium ring-1 ring-transparent hover:bg-forest-soft/20 focus:bg-forest-soft/30 focus:ring-forest"
                            />
                          )}
                        </Td>
                        <Td>
                          <div className="space-y-0.5 px-2 py-1 text-[14px] leading-snug">
                            {names.length > 0 && (
                              <p className="font-medium text-ink [overflow-wrap:anywhere]">
                                {names.join(" · ")}
                              </p>
                            )}
                            {onMap ? (
                              <>
                                <p
                                  className={
                                    pending || warning
                                      ? "text-clinical-warning"
                                      : "text-muted-foreground"
                                  }
                                >
                                  {warning ??
                                    (pending
                                      ? "Filiação a revisar"
                                      : names.length
                                        ? relationLabel
                                        : "Sem filiação informada")}
                                </p>
                                <Link
                                  to="/app/clientes/$clientId"
                                  params={{ clientId }}
                                  search={(previous) => ({
                                    ...previous,
                                    tab: "genogram",
                                    person: r.id,
                                  })}
                                  aria-label={`Revisar no mapa: ${r.full_name || `linha ${i + 1}`}`}
                                  className="inline-flex min-h-11 items-center gap-1.5 font-medium text-forest underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <MapPin className="size-4" aria-hidden />
                                  Revisar no mapa
                                </Link>
                              </>
                            ) : (
                              <p className="text-muted-foreground">A preencher</p>
                            )}
                          </div>
                        </Td>
                        {showDates && (
                          <>
                            <Td>
                              <CellInput
                                type="date"
                                value={r.birth_date ?? ""}
                                ariaLabel={`Nascimento da linha ${i + 1}`}
                                onChange={(v) => scheduleSave(r.id, { birth_date: v || null })}
                              />
                            </Td>
                            <Td>
                              <CellInput
                                type="date"
                                value={r.death_date ?? ""}
                                ariaLabel={`Falecimento da linha ${i + 1}`}
                                onChange={(v) =>
                                  scheduleSave(r.id, { death_date: v || null, is_deceased: !!v })
                                }
                              />
                            </Td>
                          </>
                        )}
                        <td className="px-1 text-center">
                          <button
                            onClick={() => toggleExpanded(r.id)}
                            className="relative rounded h-11 w-11 flex items-center justify-center text-muted-foreground transition-colors hover:bg-forest-soft/40 hover:text-forest"
                            aria-expanded={expanded}
                            aria-label={`Detalhes de ${r.full_name || `linha ${i + 1}`}`}
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
                          {!r.is_proband && (
                            <button
                              disabled={isChangingRows || isError}
                              onClick={async () => {
                                const ok = await askConfirm({
                                  title: "Remover pessoa?",
                                  description: `Remover ${r.full_name || "esta pessoa"} da planilha e do mapa? Os vínculos registrados com esta pessoa também serão removidos.`,
                                  confirmLabel: "Remover",
                                  destructive: true,
                                });
                                if (ok) removePerson.mutate(r.id);
                              }}
                              className="rounded h-11 w-11 flex items-center justify-center text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              aria-label={`Remover ${r.full_name || `linha ${i + 1}`}`}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-border/40 bg-forest-soft/10">
                          <td colSpan={columnCount} className="px-4 py-3">
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
          </fieldset>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p
              role="status"
              className={`text-[14px] ${hasDrafts && saveFailed ? "text-clinical-critical" : "text-muted-foreground"}`}
            >
              {hasDrafts
                ? saveFailed
                  ? "Alterações aguardando novo envio."
                  : "Salvando alterações…"
                : "As alterações são salvas automaticamente."}
            </p>
            {hasDrafts && saveFailed && (
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => void queueRef.current!.flush().catch(() => {})}
              >
                Tentar salvar novamente
              </Button>
            )}
          </div>
        </div>
      )}

      {hasRelatives && (
        <details className="rounded-md border border-border bg-surface-document px-4">
          <summary className="min-h-11 cursor-pointer content-center text-[14px] font-medium">
            Organizar a planilha
          </summary>
          <div className="flex flex-wrap gap-2 pb-3">
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => removeEmptyPersons.mutate()}
              disabled={isChangingRows || isError}
            >
              <Sparkles className="size-4 mr-2" />
              {removeEmptyPersons.isPending ? "Removendo…" : "Remover linhas vazias"}
            </Button>
            <Button
              variant="outline"
              className="min-h-11 text-destructive"
              disabled={isChangingRows || isError}
              onClick={async () => {
                const ok = await askConfirm({
                  title: "Remover todos os familiares?",
                  description:
                    "Os familiares e seus vínculos serão removidos da planilha e do mapa. O cadastro do consulente será mantido.",
                  confirmLabel: "Remover familiares",
                  destructive: true,
                });
                if (ok) deleteAllPersons.mutate();
              }}
            >
              <Trash2 className="size-4 mr-2" /> Remover familiares
            </Button>
          </div>
        </details>
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
      <Dialog
        open={!!importPreview}
        onOpenChange={(o) => !o && !confirmImport.isPending && setImportPreview(null)}
      >
        <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prévia da importação</DialogTitle>
            <DialogDescription>
              Confira as colunas e as sugestões de filiação. O arquivo traz dados das pessoas.
              Vínculos registrados são revisados no mapa.
            </DialogDescription>
          </DialogHeader>
          {importPreview && (
            <div className="space-y-4 text-[15px]">
              <fieldset className="grid gap-2 sm:grid-cols-3" disabled={confirmImport.isPending}>
                <legend className="mb-2 font-semibold">Colunas do arquivo</legend>
                {IMPORT_FIELDS.map((f) => (
                  <label key={f.key} className="flex flex-col gap-1 text-[14px]">
                    {f.label}
                    <select
                      className="h-11 rounded-md border border-input bg-background px-2"
                      value={importPreview.mapping[f.key] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setImportPreview((p) =>
                          p
                            ? {
                                ...p,
                                mapping: {
                                  ...p.mapping,
                                  [f.key]: v === "" ? undefined : Number(v),
                                },
                              }
                            : p,
                        );
                      }}
                    >
                      <option value="">— não importar —</option>
                      {importPreview.header.map((h, i) => (
                        <option key={i} value={i}>
                          {h || `Coluna ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </fieldset>
              <p role="status">
                <strong>{analysis.filter((r) => r.status === "ok").length}</strong> válidas ·{" "}
                <strong>{analysis.filter((r) => r.status === "duplicate").length}</strong> possíveis
                duplicidades ·{" "}
                <strong>{analysis.filter((r) => r.status === "error").length}</strong> com erro ·{" "}
                {analysis.filter((r) => r.status === "skip").length} ignoradas
              </p>
              <div className="max-h-72 overflow-auto rounded-md border border-border">
                <table className="w-full text-[14px]">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-2 py-1 text-left">Linha</th>
                      <th className="px-2 py-1 text-left">Nome</th>
                      <th className="px-2 py-1 text-left">Parentesco</th>
                      <th className="px-2 py-1 text-left">Filiação prevista</th>
                      <th className="px-2 py-1 text-left">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.slice(0, 200).map((r) => {
                      const id = `import:${r.line}`;
                      const inPreview = importGraph?.persons.has(id);
                      const previewNames =
                        importGraph && inPreview ? parentSummary(importGraph, id).names : [];
                      return (
                        <tr key={r.line} className="border-t border-border align-top">
                          <td className="px-2 py-1 tabular-nums">{r.line}</td>
                          <td className="px-2 py-1">{r.record?.full_name ?? "—"}</td>
                          <td className="px-2 py-1">{r.record?.relationship_to_proband ?? "—"}</td>
                          <td className="px-2 py-1">
                            {previewNames.length > 0
                              ? `Sugestão: ${previewNames.join(" · ")}`
                              : inPreview
                                ? "Sem pais identificados"
                                : "—"}
                          </td>
                          <td
                            className={`px-2 py-1 ${r.status === "error" ? "text-destructive" : ""}`}
                          >
                            {
                              {
                                ok: "Ok",
                                error: "Erro",
                                duplicate: "Duplicidade?",
                                skip: "Ignorada",
                              }[r.status]
                            }
                            {r.messages.length > 0 && (
                              <span className="block text-[13px]">{r.messages.join("; ")}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={importDuplicates}
                  disabled={confirmImport.isPending}
                  onChange={(e) => setImportDuplicates(e.target.checked)}
                />
                Importar também as possíveis duplicidades
              </label>
              {hasRelatives &&
                (hasRegisteredLinks && !importReplace ? (
                  <p className="text-[14px] text-clinical-warning">
                    Esta família tem vínculos registrados. Adicione as linhas do arquivo ou edite a
                    planilha atual para preservar as conexões.
                  </p>
                ) : (
                  <label className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={importReplace}
                      disabled={confirmImport.isPending}
                      onChange={(e) => setImportReplace(e.target.checked)}
                    />
                    Substituir os familiares atuais e manter o cadastro do consulente
                  </label>
                ))}
              {hasRegisteredLinks && importReplace && (
                <p role="alert" className="text-[14px] text-clinical-warning">
                  Há vínculos registrados. Desmarque a opção de substituir para manter as conexões.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={confirmImport.isPending}
              onClick={() => setImportPreview(null)}
            >
              Cancelar
            </Button>
            <Button
              className="min-h-11"
              variant={importReplace ? "destructive" : "default"}
              disabled={
                confirmImport.isPending ||
                toImport.length === 0 ||
                (importReplace && hasRegisteredLinks)
              }
              onClick={() => confirmImport.mutate()}
            >
              {confirmImport.isPending
                ? "Gravando…"
                : `${importReplace ? "Substituir e importar" : "Importar"} ${toImport.length} linha(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Th({ children, w }: { children?: React.ReactNode; w?: string }) {
  return <th className={`px-3 py-3 text-left ${w ?? ""}`}>{children}</th>;
}
/** Coluna com largura ajustável por arrasto ou teclado (setas ←/→). */
function ResizableTh({
  label,
  initial,
  sticky,
}: {
  label: string;
  initial: number;
  sticky?: boolean;
}) {
  const [width, setWidth] = React.useState(initial);
  const clamp = (v: number) => Math.min(600, Math.max(90, v));
  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = width;
    const move = (ev: PointerEvent) => setWidth(clamp(w0 + ev.clientX - x0));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <th
      style={{ width, minWidth: width }}
      className={`relative px-3 py-3 text-left ${sticky ? "md:sticky md:left-0 md:z-20 md:bg-card" : ""}`}
    >
      {label}
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={`Ajustar largura da coluna ${label}`}
        aria-valuenow={width}
        aria-valuemin={90}
        aria-valuemax={600}
        tabIndex={0}
        onPointerDown={startDrag}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          const step = e.key === "ArrowLeft" ? -20 : 20;
          setWidth((w) => clamp(w + step));
        }}
        className="absolute right-0 top-0 h-full w-3 cursor-col-resize border-r-2 border-transparent hover:border-forest focus-visible:border-forest focus-visible:outline-none"
      />
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
  id?: string;
  ariaLabel?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  list?: string;
  className?: string;
}) {
  return (
    <input
      id={props.id}
      aria-label={props.ariaLabel}
      type={props.type ?? "text"}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      list={props.list}
      className={`w-full h-11 rounded-sm border-0 bg-transparent px-2 text-[16px] font-medium text-foreground outline-none ring-1 ring-transparent transition-all focus:bg-forest-soft/30 focus:ring-forest placeholder:text-muted-foreground/40 ${props.className ?? ""}`}
    />
  );
}
