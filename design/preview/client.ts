/* eslint-disable @typescript-eslint/no-explicit-any */
// Synthetic data, loaded exclusively by vite.visual.config.ts.
import { consultanteFamily } from "../../src/lib/geno/fixtures";
import {
  parentageSnapshot,
  validateParentagePlan,
  type ParentageCandidate,
} from "../../src/lib/parentage-review";
import type { ClanWorkbookWrite } from "../../src/lib/clan-workbook";
const uid = "00000000-0000-4000-8000-000000000001";
export const cid = "00000000-0000-4000-8000-000000000002";
const now = new Date();
const stamp = now.toISOString();
export const clients = [
  "Helena Duarte",
  "Marina Costa",
  "Rafael Almeida",
  "Lucas Santos",
  "Consultante",
].map((full_name, i) => ({
  id: i ? `00000000-0000-4000-8000-00000000000${i + 2}` : cid,
  user_id: uid,
  professional_id: uid,
  full_name,
  preferred_name: full_name.split(" ")[0],
  birth_date: "1990-03-12",
  gender: "feminino",
  birthplace: "Florianópolis, SC",
  occupation: "Professora",
  status: "active",
  consent_given_at: i === 2 ? null : stamp,
  updated_at: stamp,
  created_at: stamp,
  presenting_complaint: "Caso fictício para avaliação da interface. Nenhum dado clínico real.",
  tags: ["Demonstração"],
  email: null,
  phone: null,
  avatar_url: null,
}));
export const personId = (index: number) =>
  `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
export const persons = [
  ["Antônio Duarte", "masculino", "1932-05-10", "Avô paterno", -300, 0],
  ["Cecília Duarte", "feminino", "1936-07-22", "Avó paterna", -90, 0],
  ["Raimundo Silva", "masculino", "1930-10-15", "Avô materno", 360, 0],
  ["Lúcia Silva", "feminino", "1934-01-08", "Avó materna", 570, 0],
  ["Carlos Duarte", "masculino", "1960-08-24", "Pai", -190, 220],
  ["Mariana Silva", "feminino", "1965-11-02", "Mãe", 470, 220],
  ["Helena Duarte", "feminino", "1990-03-12", "Consulente", 100, 450],
  ["Pedro Duarte", "masculino", "1992-09-14", "Irmão", 310, 450],
  ["Miguel Duarte", "masculino", "1937-01-19", "Irmão do avô paterno", 0, 0],
  ["Joaquim Duarte", "masculino", "1908-07-21", "Bisavô paterno (pai do avô)", 0, 0],
  ["Olívia Mendes", "feminino", "1912-05-16", "Bisavó paterna (mãe do avô)", 0, 0],
  ["Tomás Duarte", "masculino", "1911-04-25", "Irmão do bisavô", 0, 0],
  ["Mateus Duarte", "masculino", "1882-03-10", "Trisavô", 0, 0],
  ["Benedita Santos", "feminino", "1886-02-17", "Trisavó", 0, 0],
  ["Miguel Duarte", "masculino", "1943-12-21", "Irmão do avô", 0, 0],
  ["Cíntia Duarte", "feminino", "1994-01-09", "Irmã adotiva", 0, 0],
  ["Flávio Duarte", "masculino", "1956-09-04", "Tio(a) paterno(a)", 0, 0],
  ["Teresa Silva", "feminino", "1963-08-07", "Tio(a) materno(a)", 0, 0],
  ["Rui Silva", "masculino", "1969-02-21", "Tio(a) materno(a)", 0, 0],
].map(([full_name, gender, birth_date, relationship_to_proband, x, y], i) => ({
  id: personId(i),
  client_id: cid,
  full_name,
  preferred_name: String(full_name).split(" ")[0],
  gender,
  birth_date,
  relationship_to_proband,
  is_proband: i === 6,
  is_deceased: i === 0,
  death_date: i === 0 ? "2012-08-06" : null,
  notes: "Registro fictício para revisão visual.",
  birth_place: "Florianópolis",
  life_events:
    i === 4
      ? [
          { date: "1984", type: "Mudança", description: "Passou a morar na capital." },
          { date: "1988-06", type: "Formação", description: "Concluiu a formação técnica." },
        ]
      : i === 6
        ? [
            {
              date: "2015-06-10",
              type: "Mudança",
              description: "Mudança de cidade para trabalhar.",
            },
            { type: "Trabalho", description: "Início da carreira, data a confirmar." },
          ]
        : [],
  health_conditions: [],
  occupation: null,
  _x: x,
  _y: y,
}));
export const rels = [
  [0, 1, "union"],
  [2, 3, "union"],
  [4, 5, "union"],
  [0, 4, "parent"],
  [1, 4, "parent"],
  [2, 5, "parent"],
  [4, 6, "parent"],
  [5, 6, "parent"],
  [4, 7, "parent"],
  [5, 7, "parent"],
  [9, 0, "parent"],
  [10, 0, "parent"],
  [9, 8, "parent"],
  [10, 8, "parent"],
  [12, 9, "parent"],
  [13, 9, "parent"],
  [12, 11, "parent"],
  [13, 11, "parent"],
  [4, 15, "parent", "adoptive"],
  [5, 15, "parent", "adoptive"],
  [8, 11, "emotional", "close"],
].map(([a, b, t, q], i) => ({
  id: `rel-${i}`,
  client_id: cid,
  from_person_id: personId(Number(a)),
  to_person_id: personId(Number(b)),
  relationship_type: t,
  qualifier: q ?? (t === "union" ? "marriage" : "biological"),
  notes: null,
}));
export const sessions = [9, 11, 14].map((h, i) => {
  const date = new Date();
  date.setHours(h, 0, 0, 0);
  return {
    id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    client_id: clients[i].id,
    user_id: uid,
    session_date: date.toISOString(),
    title: i ? "Acompanhamento" : "Registro inicial",
    status: "scheduled",
    duration_seconds: 3000,
    structured_note: null,
    transcript: null,
    audio_path: null,
    created_at: stamp,
    updated_at: stamp,
    clients: clients[i],
  };
});
const consultante = consultanteFamily();
const familyClient = clients[4].id;
const syntheticReviewSession = {
  id: "20000000-0000-4000-8000-000000000004",
  client_id: familyClient,
  user_id: uid,
  session_date: "2026-11-19T15:00:00.000Z",
  title: "Sessão fictícia para revisão",
  status: "ready",
  clinical_status: "completed",
  manual_notes: "Nota profissional sintética preservada.",
  duration_seconds: null,
  audio_path: null,
  structured_note: null,
  transcript:
    "A família do exercício relata uma mudança de cidade. A data ainda vai ser confirmada.",
  transcript_segments: [
    { start: 0, end: 3, text: "A família do exercício relata uma mudança de cidade." },
    { start: 3, end: 6, text: "A data ainda vai ser confirmada." },
  ],
  transcript_reviews: {},
  created_at: stamp,
  updated_at: stamp,
};
const fixtureStamp = "2026-11-20T12:00:00.000Z";
const familyPersonIds = new Map(
  consultante.persons.map((person, index) => [person.id, personId(index + 100)]),
);
const fixtureFamily = consultante.persons.map((person) => ({
  ...person,
  client_id: familyClient,
  id: familyPersonIds.get(person.id)!,
  created_at: fixtureStamp,
  updated_at: fixtureStamp,
}));
const fixtureLinks = consultante.rels.map((link, index) => ({
  ...link,
  client_id: familyClient,
  id: `60000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  from_person_id: familyPersonIds.get(link.from_person_id)!,
  to_person_id: familyPersonIds.get(link.to_person_id)!,
  created_at: fixtureStamp,
  updated_at: fixtureStamp,
}));
const db: Record<string, any[]> = {
  clients,
  genogram_persons: [
    ...persons.map((person) => ({ ...person, updated_at: fixtureStamp })),
    ...fixtureFamily,
  ],
  genogram_relationships: [
    ...rels.map((link) => ({ ...link, updated_at: fixtureStamp })),
    ...fixtureLinks,
  ],
  genogram_parentage_reviews: [],
  dossier_deletion_jobs: [],
  clinical_sessions: [...sessions, syntheticReviewSession],
  audio_consent_events: [],
  profiles: [
    {
      id: uid,
      full_name: "Ana · conta de demonstração",
      email: "demo@example.invalid",
      formation: "Psicogenealogista",
      city: "Florianópolis",
      bio: "Perfil fictício",
      avatar_url: null,
    },
  ],
  user_roles: [{ user_id: uid, role: "professional" }],
  patterns_detected: [],
  library_entries: [],
  client_intakes: [],
  // Let the existing engine own generation order and union alignment.
  genogram_layouts: [],
  genogram_node_positions: [],
};
const familyFixtureTables = [
  "genogram_persons",
  "genogram_relationships",
  "genogram_parentage_reviews",
];
const fixtureFamilyStorage = "genealiz-local-preview-family-v2";
let fixtureHydrated = false;
function readFixtureFamily() {
  if (fixtureHydrated || typeof window === "undefined") return;
  fixtureHydrated = true;
  const stored = sessionStorage.getItem(fixtureFamilyStorage);
  if (!stored) return;
  try {
    const data = JSON.parse(stored);
    for (const table of familyFixtureTables)
      if (Array.isArray(data[table])) db[table] = data[table];
  } catch {
    sessionStorage.removeItem(fixtureFamilyStorage);
  }
}

function persistFixtureFamily() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    fixtureFamilyStorage,
    JSON.stringify(Object.fromEntries(familyFixtureTables.map((table) => [table, db[table]]))),
  );
}
class Query {
  rows: any[];
  filters: ((r: any) => boolean)[] = [];
  one = false;
  head = false;
  max = Infinity;
  start = 0;
  mutation: string | null = null;
  payload: any;
  ordering: { k: string; asc: boolean }[] = [];
  constructor(public table: string) {
    readFixtureFamily();
    this.rows = db[table] ?? [];
  }
  select(_fields?: string, opts?: any) {
    this.head = !!opts?.head;
    return this;
  }
  eq(k: string, v: any) {
    this.filters.push((r) => r[k] === v);
    return this;
  }
  neq(k: string, v: any) {
    this.filters.push((r) => r[k] !== v);
    return this;
  }
  is(k: string, v: any) {
    this.filters.push((r) => r[k] == v);
    return this;
  }
  not(k: string, op: string, v: any) {
    this.filters.push((r) => (op === "is" && v === null ? r[k] != null : r[k] !== v));
    return this;
  }
  in(k: string, v: any[]) {
    this.filters.push((r) => v.includes(r[k]));
    return this;
  }
  gt(k: string, v: any) {
    this.filters.push((r) => r[k] > v);
    return this;
  }
  or(expression: string) {
    const terms = expression.split(",").map((condition) => {
      const [key, op, ...rest] = condition.split(".");
      const value = rest.join(".");
      const pattern = op === "imatch" ? new RegExp(value.replace(/^"|"$/g, ""), "iu") : null;
      return { key, op, value, pattern };
    });
    this.filters.push((r) =>
      terms.some(({ key, op, value, pattern }) => {
        if (pattern) return pattern.test(String(r[key] ?? ""));
        return op === "is" && value === "null" ? r[key] == null : r[key] === value;
      }),
    );
    return this;
  }
  gte(k: string, v: any) {
    this.filters.push((r) => r[k] >= v);
    return this;
  }
  lt(k: string, v: any) {
    this.filters.push((r) => r[k] < v);
    return this;
  }
  lte(k: string, v: any) {
    this.filters.push((r) => r[k] <= v);
    return this;
  }
  ilike(k: string, v: string) {
    this.filters.push((r) =>
      String(r[k]).toLowerCase().includes(v.replaceAll("%", "").toLowerCase()),
    );
    return this;
  }
  order(k: string, o?: any) {
    this.ordering.push({ k, asc: o?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  range(from: number, to: number) {
    this.start = from;
    this.max = to - from + 1;
    return this;
  }
  single() {
    this.one = true;
    return this;
  }
  maybeSingle() {
    this.one = true;
    return this;
  }
  insert(v: any) {
    this.mutation = "insert";
    this.payload = v;
    return this;
  }
  upsert(v: any) {
    this.mutation = "upsert";
    this.payload = v;
    return this;
  }
  update(v: any) {
    this.mutation = "update";
    this.payload = v;
    return this;
  }
  delete() {
    this.mutation = "delete";
    return this;
  }
  then(resolve: any, reject: any) {
    try {
      let rows = this.rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.mutation === "update") {
        const touchedAt = new Date().toISOString();
        const touchDate = ["client_intakes", "clinical_sessions"].includes(this.table);
        const updated = new Map(
          rows.map((row) => [
            row,
            { ...row, ...this.payload, ...(touchDate ? { updated_at: touchedAt } : {}) },
          ]),
        );
        db[this.table] = this.rows.map((row) => updated.get(row) ?? row);
        rows = [...updated.values()];
      }
      if (this.mutation === "delete") db[this.table] = this.rows.filter((r) => !rows.includes(r));
      if (this.mutation === "insert" || this.mutation === "upsert") {
        rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((v: any) => ({
          id: crypto.randomUUID(),
          created_at: stamp,
          ...(["client_intakes", "clinical_sessions"].includes(this.table)
            ? { updated_at: new Date().toISOString() }
            : {}),
          ...(this.table === "clinical_sessions" ? { session_date: new Date().toISOString() } : {}),
          ...v,
        }));
        const remaining =
          this.mutation === "upsert" && this.table === "genogram_node_positions"
            ? this.rows.filter(
                (existing) =>
                  !rows.some(
                    (row) =>
                      row.layout_id === existing.layout_id && row.node_id === existing.node_id,
                  ),
              )
            : this.rows;
        db[this.table] = [...remaining, ...rows];
      }
      if (this.ordering.length) {
        rows.sort((a, b) => {
          for (const { k, asc } of this.ordering) {
            const order =
              typeof a[k] === "number" && typeof b[k] === "number"
                ? a[k] - b[k]
                : String(a[k]).localeCompare(String(b[k]), "pt-BR");
            if (order) return order * (asc ? 1 : -1);
          }
          return 0;
        });
      }
      rows = rows.slice(this.start, this.start + this.max);
      return Promise.resolve({
        data: this.head ? null : this.one ? (rows[0] ?? null) : rows,
        count: rows.length,
        error: null,
      }).then(resolve, reject);
    } catch (e) {
      return Promise.reject(e).then(resolve, reject);
    }
  }
}
const disabled = async () => ({
  data: null,
  error: new Error("Recurso externo indisponível no preview local."),
});
const fixtureAudio = new Map<string, Blob>();

function fixtureResult<T>(data: T) {
  return { data, error: null };
}

function fixtureError(message: string) {
  return { data: null, error: new Error(message) };
}

function reviewFixtureParentage(args: Record<string, unknown>) {
  const childId = String(args._child_id);
  const clientId = String(args._client_id);
  const child = db.genogram_persons.find((row) => row.client_id === clientId && row.id === childId);
  if (!child) return fixtureError("Pessoa indisponível.");
  const beforeReviewed = Boolean(child.parentage_reviewed);
  const relationships = db.genogram_relationships.filter((row) => row.client_id === clientId);
  if (JSON.stringify(parentageSnapshot(relationships, childId)) !== JSON.stringify(args._expected))
    return fixtureError("A filiação mudou. Reabra a revisão.");
  const parents = args._parents as ParentageCandidate[];
  const reason = validateParentagePlan(childId, parents, relationships);
  if (reason) return fixtureError(reason);
  const current = relationships.filter(
    (row) => row.to_person_id === childId && row.relationship_type === "parent",
  );
  const before = current.map((link) => ({ ...link }));
  const now = new Date().toISOString();
  const after = parents.map(({ personId, kind }) => {
    const existing = current.find((row) => row.from_person_id === personId);
    if (existing)
      return kind && kind !== existing.qualifier
        ? { ...existing, qualifier: kind, updated_at: now }
        : existing;
    return {
      id: crypto.randomUUID(),
      client_id: clientId,
      from_person_id: personId,
      to_person_id: childId,
      relationship_type: "parent",
      qualifier: kind,
      notes: null,
      start_date: null,
      end_date: null,
      marriage_order: null,
      created_at: now,
      updated_at: now,
    };
  });
  db.genogram_relationships = [
    ...db.genogram_relationships.filter((link) => !current.includes(link)),
    ...after,
  ];
  db.genogram_persons = db.genogram_persons.map((row) =>
    row === child ? { ...row, parentage_reviewed: true } : row,
  );
  const id = crypto.randomUUID();
  db.genogram_parentage_reviews.push({
    id,
    client_id: clientId,
    child_id: childId,
    professional_id: uid,
    review_number: db.genogram_parentage_reviews.length + 1,
    decision: args._decision,
    source: args._source,
    note: args._note ?? null,
    before_links: before,
    before_reviewed: beforeReviewed,
    after_reviewed: true,
    after_links: after.map((link) => ({ ...link })),
    created_at: now,
    undone_review_id: null,
  });
  return fixtureResult(id);
}

function undoFixtureParentage(args: Record<string, unknown>) {
  const review = db.genogram_parentage_reviews.find(
    (row) => row.id === args._review_id && row.client_id === args._client_id,
  );
  if (!review) return fixtureError("Revisão indisponível.");
  const history = db.genogram_parentage_reviews.filter(
    (row) => row.client_id === review.client_id && row.child_id === review.child_id,
  );
  const links = db.genogram_relationships.filter((row) => row.client_id === review.client_id);
  if (
    history.at(-1)?.id !== review.id ||
    JSON.stringify(parentageSnapshot(links, review.child_id)) !==
      JSON.stringify(parentageSnapshot(review.after_links, review.child_id))
  )
    return fixtureError("A filiação mudou depois da revisão.");
  db.genogram_relationships = [
    ...db.genogram_relationships.filter(
      (row) =>
        row.client_id !== review.client_id ||
        row.to_person_id !== review.child_id ||
        row.relationship_type !== "parent",
    ),
    ...review.before_links,
  ];
  db.genogram_persons = db.genogram_persons.map((row) =>
    row.id === review.child_id && row.client_id === review.client_id
      ? { ...row, parentage_reviewed: review.before_reviewed }
      : row,
  );
  const id = crypto.randomUUID();
  db.genogram_parentage_reviews.push({
    ...review,
    id,
    review_number: db.genogram_parentage_reviews.length + 1,
    decision: "undo",
    source: history.at(-2)?.source ?? "unverified",
    note: history.at(-2)?.note ?? null,
    before_links: review.after_links,
    after_links: review.before_links,
    before_reviewed: review.after_reviewed,
    after_reviewed: review.before_reviewed,
    undone_review_id: review.id,
    created_at: new Date().toISOString(),
  });
  return fixtureResult(id);
}

function importFixtureWorkbook(args: Record<string, unknown>) {
  const clientId = String(args._client_id);
  const client = db.clients.find(
    (record) => record.id === clientId && record.professional_id === uid,
  );
  if (!client) return fixtureError("Dossiê indisponível.");
  const plan = {
    people: args._people,
    links: args._links,
    parentages: args._parentages,
  } as ClanWorkbookWrite;
  const backup = Object.fromEntries(
    familyFixtureTables.map((table) => [table, structuredClone(db[table])]),
  );
  const now = new Date().toISOString();
  try {
    const existingPeople = db.genogram_persons.filter((person) => person.client_id === clientId);
    const keys = new Map<string, string>();
    for (const person of existingPeople) {
      keys.set(person.id, person.id);
      if (person.clan_reference) keys.set(person.clan_reference, person.id);
      if (person.is_proband) keys.set("consultante", person.id);
    }
    let inserted = 0;
    let updated = 0;
    for (const item of plan.people) {
      const existing = existingPeople.find((person) => person.id === item.person_id);
      if (item.person_id && (!existing || existing.updated_at !== item.expected_updated_at)) {
        throw new Error("A pessoa mudou desde a prévia.");
      }
      if (keys.has(item.key) && keys.get(item.key) !== item.person_id)
        throw new Error("ID já em uso.");
      if (existing) {
        keys.set(item.key, existing.id);
        if (
          !existing.is_proband &&
          (Object.keys(item.patch).length || (!existing.clan_reference && item.key !== existing.id))
        ) {
          Object.assign(existing, item.patch, {
            updated_at: now,
            clan_reference: existing.clan_reference ?? (item.key === existing.id ? null : item.key),
          });
          updated++;
        }
      } else {
        const id = crypto.randomUUID();
        db.genogram_persons.push({
          health_conditions: [],
          life_events: [],
          is_deceased: false,
          is_proband: false,
          ...item.patch,
          id,
          client_id: clientId,
          clan_reference: item.key,
          created_at: now,
          updated_at: now,
        });
        keys.set(item.key, id);
        inserted++;
      }
    }
    for (const link of plan.links) {
      const from = keys.get(link.from_key);
      const to = keys.get(link.to_key);
      if (!from || !to || from === to) throw new Error("Confira os IDs da aba Vínculos.");
      const existing = db.genogram_relationships.find(
        (record) => record.client_id === clientId && record.id === link.relationship_id,
      );
      if (link.relationship_id && (!existing || existing.updated_at !== link.expected_updated_at))
        throw new Error("O vínculo mudou desde a prévia.");
      const record = {
        client_id: clientId,
        from_person_id: from,
        to_person_id: to,
        relationship_type: link.relationship_type,
        qualifier: link.qualifier,
        start_date: link.start_date,
        end_date: link.end_date,
        notes: link.notes,
        clan_reference: existing?.clan_reference ?? link.key,
        updated_at: now,
      };
      if (existing) Object.assign(existing, record);
      else db.genogram_relationships.push({ ...record, id: crypto.randomUUID(), created_at: now });
    }
    for (const parentage of plan.parentages) {
      const result = reviewFixtureParentage({
        _client_id: clientId,
        _child_id: keys.get(parentage.child_key),
        _expected: parentage.expected,
        _parents: parentage.parents.map((parent) => ({
          personId: keys.get(parent.key),
          kind: parent.kind,
        })),
        _decision: "edit",
        _source: "document",
        _note: "Filiação conferida na prévia da planilha fictícia.",
      });
      if (result.error) throw result.error;
    }
    persistFixtureFamily();
    return fixtureResult({
      inserted,
      updated,
      related: plan.links.length,
      reviewed: plan.parentages.length,
    });
  } catch (error) {
    for (const table of familyFixtureTables) db[table] = backup[table];
    return fixtureError(error instanceof Error ? error.message : "Importação indisponível.");
  }
}

export const supabase: any = {
  from: (table: string) => new Query(table),
  rpc: async (name: string, args: Record<string, unknown>) => {
    readFixtureFamily();
    if (name === "list_dossier_deletions")
      return fixtureResult(db.dossier_deletion_jobs.filter((job) => !job.completed_at));
    if (name === "begin_dossier_deletion") {
      const id = args._client_id;
      if (db.dossier_deletion_jobs.some((job) => job.client_id === id)) return fixtureResult(true);
      const client = db.clients.find((row) => row.id === id && row.professional_id === uid);
      if (!client || client.status !== "archived")
        return {
          data: null,
          error: new Error("Arquive o dossiê antes de excluir definitivamente."),
        };
      db.dossier_deletion_jobs.push({
        client_id: id,
        created_at: new Date().toISOString(),
        completed_at: null,
        audio_paths: db.clinical_sessions
          .filter((row) => row.client_id === id)
          .flatMap((row) => (typeof row.audio_path === "string" ? [row.audio_path] : [])),
        avatar_paths: [],
      });
      const layouts = new Set(
        db.genogram_layouts.filter((row) => row.client_id === id).map((row) => row.id),
      );
      for (const table of [
        "audio_consent_events",
        "client_intakes",
        "clinical_sessions",
        "genogram_persons",
        "genogram_relationships",
        "genogram_parentage_reviews",
        "genogram_layouts",
      ]) {
        db[table] = db[table].filter((row) => row.client_id !== id);
      }
      db.genogram_node_positions = db.genogram_node_positions.filter(
        (row) => !layouts.has(row.layout_id),
      );
      db.clients = db.clients.filter((row) => row.id !== id);
      persistFixtureFamily();
      return fixtureResult(true);
    }
    if (name === "dossier_deletion_manifest")
      return fixtureResult(
        db.dossier_deletion_jobs.find((job) => job.client_id === args._client_id) ?? null,
      );
    if (name === "finish_dossier_deletion") {
      const job = db.dossier_deletion_jobs.find((job) => job.client_id === args._client_id);
      if (!job || job.audio_paths.some((path: string) => fixtureAudio.has(path)))
        return fixtureResult(false);
      job.completed_at ??= new Date().toISOString();
      job.audio_paths = [];
      return fixtureResult(true);
    }
    if (name === "import_clan_workbook") return importFixtureWorkbook(args);
    if (name === "review_parentage" || name === "undo_parentage_review") {
      const result =
        name === "review_parentage" ? reviewFixtureParentage(args) : undoFixtureParentage(args);
      if (!result.error) persistFixtureFamily();
      return result;
    }
    if (name === "mesa_pending_clinical_records") {
      return fixtureResult(
        db.clinical_sessions
          .filter(
            (session) =>
              Date.parse(session.session_date) <= Date.now() &&
              (session.clinical_status === "pending_record" ||
                (session.clinical_status == null &&
                  !session.manual_notes?.trim() &&
                  !session.ai_reviewed_at &&
                  !session.structured_note)),
          )
          .sort((a, b) => Date.parse(b.session_date) - Date.parse(a.session_date))
          .slice(0, 5),
      );
    }
    if (name === "list_timeline_cases") {
      const normalize = (name: string) =>
        name
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase();
      const search = normalize(String(args._search ?? "").trim());
      const offset = Math.max(0, Number(args._offset ?? 0));
      return fixtureResult(
        db.clients
          .filter(
            (client) =>
              client.status === (args._status ?? "active") &&
              normalize(`${client.full_name} ${client.preferred_name ?? ""}`).includes(search),
          )
          .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"))
          .slice(offset, offset + 13)
          .map((client) => ({
            id: client.id,
            full_name: client.full_name,
            preferred_name: client.preferred_name,
            has_events: db.genogram_persons.some(
              (person) =>
                person.client_id === client.id &&
                (person.birth_date ||
                  person.death_date ||
                  person.birth_date_partial ||
                  person.death_date_partial ||
                  person.is_deceased ||
                  person.life_events?.length),
            ),
          })),
      );
    }
    if (name !== "record_audio_consent" && name !== "record_audio_consent_details")
      return disabled();
    if (
      !db.clients.some((client) => client.id === args._client_id) ||
      (args._session_id &&
        !db.clinical_sessions.some(
          (session) => session.id === args._session_id && session.client_id === args._client_id,
        ))
    ) {
      return fixtureError("Caso ou sessão indisponível");
    }
    db.audio_consent_events.push({
      id: crypto.randomUUID(),
      revision: db.audio_consent_events.length + 1,
      client_id: args._client_id,
      professional_id: uid,
      scope: args._scope,
      granted: args._granted,
      source: args._source,
      session_id: args._session_id ?? null,
      term_version: args._term_version ?? null,
      document_reference: args._document_reference ?? null,
      created_at: new Date().toISOString(),
    });
    return { data: null, error: null };
  },
  auth: {
    getUser: async () => ({
      data: { user: { id: uid, email: "demo@example.invalid" } },
      error: null,
    }),
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
    signInWithPassword: disabled,
    signUp: disabled,
    resetPasswordForEmail: disabled,
    updateUser: disabled,
  },
  storage: {
    from: (bucket: string) => ({
      createSignedUrl: async (path: string) => {
        const recorded = bucket === "session-audio" ? fixtureAudio.get(path) : undefined;
        return {
          data: { signedUrl: recorded ? URL.createObjectURL(recorded) : null },
          error: null,
        };
      },
      upload: async (path: string, blob: Blob) => {
        if (bucket !== "session-audio") return disabled();
        if (fixtureAudio.has(path)) return { error: new Error("Arquivo já enviado.") };
        fixtureAudio.set(path, blob);
        return { data: { path }, error: null };
      },
      info: async (path: string) =>
        bucket === "session-audio" && fixtureAudio.has(path)
          ? { data: { name: path }, error: null }
          : { data: null, error: new Error("Arquivo indisponível.") },
      remove: async (paths: string[]) => {
        if (bucket !== "session-audio") return disabled();
        paths.forEach((path) => fixtureAudio.delete(path));
        return { data: [], error: null };
      },
    }),
  },
  functions: { invoke: disabled },
};
if (typeof document !== "undefined" && !document.querySelector(".genealiz-preview-notice")) {
  const notice = document.createElement("div");
  notice.className = "genealiz-preview-notice";
  notice.textContent = "Prévia local · dados fictícios · alterações nesta aba";
  notice.setAttribute("role", "status");
  notice.style.cssText =
    "position:fixed;bottom:0;right:0;z-index:1000;background:#E7BF86;color:#17273A;padding:5px 12px;font:11px Inter,sans-serif;border-radius:5px 0 0 0;pointer-events:none";
  document.body.append(notice);
  const noticeStyles = document.createElement("style");
  noticeStyles.textContent =
    "@media(max-width:767px){.genealiz-preview-notice{bottom:calc(72px + env(safe-area-inset-bottom))!important;max-width:100%;font-size:10px!important}}";
  document.head.append(noticeStyles);
}
