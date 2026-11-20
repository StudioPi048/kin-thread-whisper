/** Personal export: explicit ownership, stable pagination, and related layout positions. */
export type ExportTable =
  | "profiles"
  | "clients"
  | "client_intakes"
  | "genogram_persons"
  | "genogram_relationships"
  | "genogram_parentage_reviews"
  | "genogram_layouts"
  | "genogram_node_positions"
  | "clinical_sessions"
  | "hypothesis_reviews"
  | "audio_consent_events";
export type ExportRow = { id: string; [key: string]: unknown };
export type ExportFilter = { column: string; values: string[] };
export type ExportPageReader = (request: {
  table: ExportTable;
  filter: ExportFilter;
  from: number;
  to: number;
  columns?: string;
}) => Promise<ExportRow[]>;

async function allRows(
  read: ExportPageReader,
  table: ExportTable,
  filter: ExportFilter,
  columns?: string,
) {
  const rows: ExportRow[] = [];
  if (!filter.values.length) return rows;
  const allowed = new Set(filter.values);
  for (let from = 0; ; from += 500) {
    const page = await read({
      table,
      filter,
      from,
      to: from + 499,
      ...(columns ? { columns } : {}),
    });
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

const caseTables = [
  "client_intakes",
  "genogram_persons",
  "genogram_relationships",
  "genogram_parentage_reviews",
  "genogram_layouts",
  "clinical_sessions",
  "hypothesis_reviews",
  "audio_consent_events",
] as const;

type CaseRows = Record<(typeof caseTables)[number] | "genogram_node_positions", ExportRow[]>;

async function exportCases(read: ExportPageReader, clients: ExportRow[]): Promise<CaseRows> {
  const ids = clients.map((client) => client.id);
  const entries = await Promise.all(
    caseTables.map(async (table) => [table, await related(read, table, "client_id", ids)] as const),
  );
  const out = Object.fromEntries(entries) as CaseRows;
  out.genogram_node_positions = await related(
    read,
    "genogram_node_positions",
    "layout_id",
    out.genogram_layouts.map((row) => row.id),
  );
  return out;
}

const exportNote =
  "Dados da própria conta. Inclui registros de áudio, sem os arquivos de mídia, e exclui o acervo editorial compartilhado. Datas incompletas mantêm a precisão registrada. Leitura paginada.";

export async function exportAccountData(read: ExportPageReader, userId: string) {
  if (!userId) throw new Error("Conta não identificada.");
  const profiles = await allRows(read, "profiles", { column: "id", values: [userId] });
  const clients = await allRows(read, "clients", { column: "professional_id", values: [userId] });
  return {
    exported_at: new Date().toISOString(),
    user_id: userId,
    format_version: 1,
    note: exportNote,
    profiles,
    clients,
    ...(await exportCases(read, clients)),
  };
}

export async function exportDossierData(read: ExportPageReader, userId: string, clientId: string) {
  if (!userId || !clientId) throw new Error("Dossiê não identificado.");
  const [client] = await allRows(read, "clients", { column: "id", values: [clientId] });
  if (client?.professional_id !== userId) throw new Error("Dossiê indisponível para esta conta.");
  return {
    exported_at: new Date().toISOString(),
    format: "genealiz.dossier",
    format_version: 1,
    note: exportNote,
    client,
    ...(await exportCases(read, [client])),
  };
}

export async function readDossierReport(
  read: ExportPageReader,
  userId: string,
  clientId: string,
  scope: { family: boolean; timeline: boolean; sessions: boolean; includeNotes: boolean },
) {
  if (!userId || !clientId) throw new Error("Dossiê não identificado.");
  const filter = { column: "client_id", values: [clientId] };
  const [client] = await allRows(
    read,
    "clients",
    { column: "id", values: [clientId] },
    "id, professional_id, full_name",
  );
  if (client?.professional_id !== userId) throw new Error("Dossiê indisponível para esta conta.");
  const wantsFamily = scope.family || scope.timeline;
  const [persons, links, sessions] = await Promise.all([
    wantsFamily
      ? allRows(
          read,
          "genogram_persons",
          filter,
          "id, client_id, full_name, preferred_name, relationship_to_proband, gender, is_proband, birth_order, birth_date, death_date, is_deceased, parentage_reviewed" +
            (scope.timeline ? ", birth_date_partial, death_date_partial, life_events, notes" : ""),
        )
      : [],
    wantsFamily
      ? allRows(
          read,
          "genogram_relationships",
          filter,
          "id, client_id, from_person_id, to_person_id, relationship_type, qualifier, start_date, end_date, marriage_order",
        )
      : [],
    scope.sessions
      ? allRows(
          read,
          "clinical_sessions",
          filter,
          "id, client_id, user_id, session_date, clinical_status, status" +
            (scope.includeNotes ? ", manual_notes" : ""),
        )
      : [],
  ]);
  return { clientName: String(client.full_name), persons, links, sessions };
}
