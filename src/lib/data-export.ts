/** Personal export: explicit ownership, stable pagination, and related layout positions. */
export type ExportTable =
  | "profiles"
  | "clients"
  | "client_intakes"
  | "genogram_persons"
  | "genogram_relationships"
  | "genogram_layouts"
  | "genogram_node_positions"
  | "clinical_sessions"
  | "hypothesis_reviews";
export type ExportRow = { id: string; [key: string]: unknown };
export type ExportFilter = { column: string; values: string[] };
export type ExportPageReader = (request: {
  table: ExportTable;
  filter: ExportFilter;
  from: number;
  to: number;
}) => Promise<ExportRow[]>;

async function allRows(read: ExportPageReader, table: ExportTable, filter: ExportFilter) {
  const rows: ExportRow[] = [];
  if (!filter.values.length) return rows;
  const allowed = new Set(filter.values);
  for (let from = 0; ; from += 500) {
    const page = await read({ table, filter, from, to: from + 499 });
    if (page.some((r) => !allowed.has(String(r[filter.column]))))
      throw new Error(`A resposta de ${table} contém registros fora do escopo da conta.`);
    rows.push(...page);
    if (page.length < 500) break;
  }
  return rows;
}

async function related(read: ExportPageReader, table: ExportTable, column: string, ids: string[]) {
  const rows: ExportRow[] = [];
  for (let i = 0; i < ids.length; i += 100)
    rows.push(...(await allRows(read, table, { column, values: ids.slice(i, i + 100) })));
  return rows;
}

export async function exportAccountData(read: ExportPageReader, userId: string) {
  if (!userId) throw new Error("Conta não identificada.");
  const profiles = await allRows(read, "profiles", { column: "id", values: [userId] });
  const clients = await allRows(read, "clients", { column: "professional_id", values: [userId] });
  const ids = clients.map((c) => c.id);
  const out: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    user_id: userId,
    format_version: 1,
    note: "Dados da própria conta. Arquivos de áudio e acervo editorial compartilhado não incluídos. Leitura paginada; não é um snapshot transacional do banco.",
    profiles,
    clients,
  };
  for (const table of [
    "client_intakes",
    "genogram_persons",
    "genogram_relationships",
    "genogram_layouts",
    "clinical_sessions",
    "hypothesis_reviews",
  ] as const)
    out[table] = await related(read, table, "client_id", ids);
  const layouts = out.genogram_layouts as ExportRow[];
  out.genogram_node_positions = await related(
    read,
    "genogram_node_positions",
    "layout_id",
    layouts.map((r) => r.id),
  );
  return out;
}
