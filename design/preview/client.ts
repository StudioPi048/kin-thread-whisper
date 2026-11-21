/* eslint-disable @typescript-eslint/no-explicit-any */
// Synthetic data, loaded exclusively by vite.visual.config.ts.
import { consultanteFamily } from "../../src/lib/geno/fixtures";
import {
  parentageSnapshot,
  validateParentagePlan,
  type ParentageCandidate,
} from "../../src/lib/parentage-review";
import type { ClanWorkbookWrite } from "../../src/lib/clan-workbook";
import { appointmentDurationMin } from "../../src/lib/scheduling";
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
    summary_stale: false,
    transcript: null,
    audio_path: null,
    created_at: stamp,
    updated_at: stamp,
    clients: clients[i],
  };
});
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
  summary_stale: false,
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
function makeFixtureFamily(depth = 4) {
  const sample = consultanteFamily(depth);
  const ids = new Map(sample.persons.map((person, index) => [person.id, personId(index + 100)]));
  const people = sample.persons.map((person) => ({
    ...person,
    client_id: familyClient,
    id: ids.get(person.id)!,
    created_at: fixtureStamp,
    updated_at: fixtureStamp,
  }));
  const links = sample.rels.map((link, index) => ({
    ...link,
    client_id: familyClient,
    id: `60000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    from_person_id: ids.get(link.from_person_id)!,
    to_person_id: ids.get(link.to_person_id)!,
    created_at: fixtureStamp,
    updated_at: fixtureStamp,
  }));
  return { people, links };
}
const fixtureFamily = makeFixtureFamily();
const db: Record<string, any[]> = {
  clients,
  genogram_persons: [
    ...persons.map((person) => ({ ...person, updated_at: fixtureStamp })),
    ...fixtureFamily.people,
  ],
  genogram_relationships: [
    ...rels.map((link) => ({ ...link, updated_at: fixtureStamp })),
    ...fixtureFamily.links,
  ],
  genogram_parentage_reviews: [],
  hypothesis_reviews: [],
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
const persistedFixtureTables = [
  ...familyFixtureTables,
  "genogram_layouts",
  "genogram_node_positions",
  "client_intakes",
  "clinical_sessions",
  "hypothesis_reviews",
];
let fixtureFamilyStorage = "genealiz-local-preview-family-v2";
let fixtureHydrated = false;
function readFixtureFamily() {
  if (fixtureHydrated || typeof window === "undefined") return;
  fixtureHydrated = true;
  const size = new URLSearchParams(window.location.search).get("familia");
  if (size === "131" || size === "515") {
    fixtureFamilyStorage += `-${size}`;
    const { people, links } = makeFixtureFamily(size === "131" ? 6 : 8);
    db.genogram_persons = [
      ...db.genogram_persons.filter((row) => row.client_id !== familyClient),
      ...people,
    ];
    db.genogram_relationships = [
      ...db.genogram_relationships.filter((row) => row.client_id !== familyClient),
      ...links,
    ];
  }
  const stored = sessionStorage.getItem(fixtureFamilyStorage);
  if (!stored) return;
  try {
    const data = JSON.parse(stored);
    for (const table of persistedFixtureTables)
      if (Array.isArray(data[table])) db[table] = data[table];
  } catch {
    sessionStorage.removeItem(fixtureFamilyStorage);
  }
}

function persistFixtureFamily() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    fixtureFamilyStorage,
    JSON.stringify(Object.fromEntries(persistedFixtureTables.map((table) => [table, db[table]]))),
  );
}
function fixtureReactivationConflicts(clientId: string) {
  const now = Date.now();
  const slots = db.clinical_sessions
    .filter(
      (row) =>
        row.status !== "deleting" &&
        (row.client_id === clientId ||
          db.clients.some((client) => client.id === row.client_id && client.status === "active")) &&
        (["scheduled", "in_progress"].includes(row.clinical_status) ||
          (row.clinical_status == null && Date.parse(row.session_date) > now)),
    )
    .map((row) => {
      const start = Date.parse(row.session_date);
      const durationMin = appointmentDurationMin(row) ?? 60;
      return { row, start, end: start + durationMin * 60_000, durationMin };
    })
    .sort((a, b) => a.start - b.start || a.row.id.localeCompare(b.row.id));
  return slots
    .filter(({ row, end }) => row.client_id === clientId && end > now)
    .flatMap(({ row, start, end, durationMin }) => {
      const collision = slots.find(
        (other) => other.row.id !== row.id && other.start < end && start < other.end,
      );
      if (!collision) return [];
      const person = db.clients.find((client) => client.id === collision.row.client_id);
      return [
        {
          id: row.id,
          startISO: row.session_date,
          updatedAt: row.updated_at,
          durationMin,
          conflictName: person?.preferred_name || person?.full_name || "Cliente",
          conflictStartISO: collision.row.session_date,
        },
      ];
    })
    .slice(0, 5);
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
    this.filters.push((r) =>
      k === "clients.status"
        ? db.clients.find((client) => client.id === r.client_id)?.status === v
        : r[k] === v,
    );
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
        if (this.table === "clients" && this.payload.status === "active") {
          const blocked = rows
            .filter((row) => row.status === "archived")
            .flatMap((row) => fixtureReactivationConflicts(row.id));
          if (blocked.length) {
            return Promise.resolve({
              data: null,
              error: { code: "23P01", details: JSON.stringify(blocked) },
            }).then(resolve, reject);
          }
        }
        const touchedAt = new Date().toISOString();
        const touchDate = [
          "client_intakes",
          "clinical_sessions",
          "clients",
          ...familyFixtureTables,
        ].includes(this.table);
        const transcriptContent = (reviews: any) =>
          JSON.stringify(
            Object.entries(reviews ?? {}).flatMap(([key, review]: [string, any]) =>
              review.decision === "excluded" || review.decision === "corrected"
                ? [[key, review.decision, review.correction?.trim() || null]]
                : [],
            ),
          );
        const updated = new Map(
          rows.map((row) => {
            const next = {
              ...row,
              ...this.payload,
              ...(touchDate ? { updated_at: touchedAt } : {}),
            };
            if (this.table === "clinical_sessions") {
              if (
                row.structured_note &&
                transcriptContent(row.transcript_reviews) !==
                  transcriptContent(next.transcript_reviews)
              )
                next.summary_stale = true;
              if (next.summary_stale) next.ai_reviewed_at = null;
            }
            return [row, next];
          }),
        );
        db[this.table] = this.rows.map((row) => updated.get(row) ?? row);
        rows = [...updated.values()];
      }
      if (this.mutation === "delete") db[this.table] = this.rows.filter((r) => !rows.includes(r));
      if (this.mutation === "insert" || this.mutation === "upsert") {
        rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((v: any) => ({
          id: crypto.randomUUID(),
          created_at: stamp,
          ...(["client_intakes", "clinical_sessions", "clients", ...familyFixtureTables].includes(
            this.table,
          )
            ? { updated_at: new Date().toISOString() }
            : {}),
          ...(this.table === "clinical_sessions"
            ? { session_date: new Date().toISOString(), summary_stale: false }
            : {}),
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
      if (this.mutation && persistedFixtureTables.includes(this.table)) persistFixtureFamily();
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

type FixtureParent = ParentageCandidate & {
  link?: {
    key: string | null;
    relationship_id: string | null;
    expected_updated_at: string | null;
    start_date: string | null;
    end_date: string | null;
    notes: string | null;
  };
};
type FixtureReview = {
  reviewed: boolean;
  review: {
    original_id: string;
    original_created_at: string;
    source: string;
    note: string | null;
    decision: string;
  } | null;
};

function reviewFixtureParentage(args: Record<string, unknown>) {
  const childId = String(args._child_id);
  const clientId = String(args._client_id);
  const child = db.genogram_persons.find((row) => row.client_id === clientId && row.id === childId);
  if (!child) return fixtureError("Pessoa indisponível.");
  const beforeReviewed = Boolean(child.parentage_reviewed);
  const relationships = db.genogram_relationships.filter((row) => row.client_id === clientId);
  if (JSON.stringify(parentageSnapshot(relationships, childId)) !== JSON.stringify(args._expected))
    return fixtureError("A filiação mudou. Reabra a revisão.");
  const latest = db.genogram_parentage_reviews
    .filter((row) => row.client_id === clientId && row.child_id === childId)
    .at(-1);
  if (
    ("_expected_review_id" in args && (latest?.id ?? null) !== args._expected_review_id) ||
    ("_expected_reviewed" in args && beforeReviewed !== args._expected_reviewed)
  ) {
    return fixtureError("A revisão mudou desde a prévia.");
  }
  const restore = args._restore as FixtureReview | undefined;
  const parents = args._parents as FixtureParent[];
  const validation = (args._validation_relationships ?? relationships) as typeof relationships;
  const reason = validateParentagePlan(childId, parents, validation);
  if (reason) return fixtureError(reason);
  const current = relationships.filter(
    (row) => row.to_person_id === childId && row.relationship_type === "parent",
  );
  const before = current.map((link) => ({ ...link }));
  const now = new Date().toISOString();
  const after = parents.map(({ personId, kind, link }) => {
    const existing = current.find((row) => row.from_person_id === personId);
    if (
      link?.relationship_id &&
      (existing?.id !== link.relationship_id || existing.updated_at !== link.expected_updated_at)
    )
      throw new Error("O vínculo mudou desde a prévia.");
    const qualifier = link ? (kind ?? null) : (kind ?? (existing ? existing.qualifier : "unknown"));
    const metadata = link
      ? {
          notes: link.notes,
          start_date: link.start_date,
          end_date: link.end_date,
          clan_reference: existing?.clan_reference ?? (existing?.id === link.key ? null : link.key),
        }
      : {};
    if (existing) {
      const fields = { qualifier, ...metadata };
      return Object.entries(fields).some(([key, value]) => (existing[key] ?? null) !== value)
        ? { ...existing, ...fields, updated_at: now }
        : existing;
    }
    return {
      id: crypto.randomUUID(),
      client_id: clientId,
      from_person_id: personId,
      to_person_id: childId,
      relationship_type: "parent",
      qualifier,
      notes: null,
      start_date: null,
      end_date: null,
      marriage_order: null,
      created_at: now,
      updated_at: now,
      ...metadata,
    };
  });
  db.genogram_relationships = [
    ...db.genogram_relationships.filter((link) => !current.includes(link)),
    ...after,
  ];
  const afterReviewed = restore?.reviewed ?? true;
  db.genogram_persons = db.genogram_persons.map((row) =>
    row === child && beforeReviewed !== afterReviewed
      ? { ...row, parentage_reviewed: afterReviewed, updated_at: now }
      : row,
  );
  const id = crypto.randomUUID();
  db.genogram_parentage_reviews.push({
    id,
    client_id: clientId,
    child_id: childId,
    professional_id: uid,
    review_number: db.genogram_parentage_reviews.length + 1,
    decision: args._decision,
    source: restore ? (restore.review?.source ?? "unverified") : args._source,
    note: restore ? (restore.review?.note ?? null) : (args._note ?? null),
    before_links: before,
    before_reviewed: beforeReviewed,
    after_reviewed: afterReviewed,
    after_links: after.map((link) => ({ ...link })),
    created_at: now,
    undone_review_id: null,
    workbook_import: Boolean(restore),
    imported_review_key: restore?.review?.original_id ?? null,
    imported_review_created_at: restore?.review?.original_created_at ?? null,
    imported_review_decision: restore?.review?.decision ?? null,
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
    workbook_import: history.at(-2)?.workbook_import ?? false,
    imported_review_key: history.at(-2)?.imported_review_key ?? null,
    imported_review_created_at: history.at(-2)?.imported_review_created_at ?? null,
    imported_review_decision: history.at(-2)?.imported_review_decision ?? null,
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
        marriage_order: link.marriage_order_present
          ? link.marriage_order
          : (existing?.marriage_order ?? null),
        clan_reference: existing?.clan_reference ?? link.key,
        updated_at: now,
      };
      if (existing) Object.assign(existing, record);
      else db.genogram_relationships.push({ ...record, id: crypto.randomUUID(), created_at: now });
    }
    const affected = new Set(plan.parentages.map(({ child_key }) => keys.get(child_key)));
    const finalRelations = [
      ...db.genogram_relationships.filter(
        (row) =>
          row.client_id === clientId &&
          (row.relationship_type !== "parent" || !affected.has(row.to_person_id)),
      ),
      ...plan.parentages.flatMap(({ child_key, parents }) =>
        parents.map((parent, index) => ({
          id: `planned-${child_key}-${index}`,
          from_person_id: keys.get(parent.key),
          to_person_id: keys.get(child_key),
          relationship_type: "parent",
        })),
      ),
    ];
    for (const parentage of plan.parentages) {
      const result = reviewFixtureParentage({
        _client_id: clientId,
        _child_id: keys.get(parentage.child_key),
        _expected: parentage.expected,
        _parents: parentage.parents.map((parent) => ({
          personId: keys.get(parent.key),
          kind: parent.kind,
          link: parent.link,
        })),
        _decision: "edit",
        _source: "unverified",
        _note: "Filiação conferida na prévia da planilha fictícia.",
        _validation_relationships: finalRelations,
        ...(parentage.restore
          ? {
              _restore: parentage.restore,
              _expected_review_id: parentage.expected_review_id,
              _expected_reviewed: parentage.expected_reviewed,
            }
          : {}),
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
    if (name === "search_workspace_clients") {
      const search = String(args._search ?? "").trim();
      const fold = (value: string) =>
        value
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase();
      const tokens = fold(search)
        .slice(0, 96)
        .match(/[\p{Letter}\d]+/gu);
      const pattern = tokens ? new RegExp(tokens.join(".*"), "u") : null;
      const offset = Math.max(0, Number(args._offset ?? 0));
      const limit = Math.min(100, Math.max(1, Number(args._limit ?? 24)));
      const matches = db.clients
        .filter((client) => {
          if (client.professional_id !== uid || client.status !== (args._status ?? "active"))
            return false;
          if (
            args._without_upcoming &&
            db.clinical_sessions.some(
              (session) =>
                session.client_id === client.id &&
                session.status !== "deleting" &&
                Date.parse(session.session_date) >= Date.now() &&
                (session.clinical_status === "scheduled" || session.clinical_status == null),
            )
          )
            return false;
          const fields = [client.full_name, client.preferred_name];
          if (args._details)
            fields.push(
              client.birthplace,
              client.email,
              client.phone,
              client.presenting_complaint,
              client.tags?.join(" "),
            );
          return !search || pattern?.test(fold(fields.filter(Boolean).join(" ")));
        })
        .sort(
          (a, b) =>
            (args._details
              ? String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))
              : a.full_name.localeCompare(b.full_name, "pt-BR")) || a.id.localeCompare(b.id),
        );
      return fixtureResult({
        total: matches.length,
        clients: matches.slice(offset, offset + limit).map((client) =>
          args._details
            ? { ...client, preferred_name: client.preferred_name ?? null }
            : {
                id: client.id,
                full_name: client.full_name,
                status: client.status,
                preferred_name: client.preferred_name ?? null,
              },
        ),
      });
    }
    if (name === "append_hypothesis_review") {
      if (!db.clients.some((row) => row.id === args._client_id))
        return fixtureError("Dossiê indisponível.");
      const latest = db.hypothesis_reviews
        .filter(
          (row) => row.client_id === args._client_id && row.hypothesis_key === args._hypothesis_key,
        )
        .sort((a, b) => b.version - a.version)[0];
      if ((latest?.id ?? null) !== args._expected_review_id)
        return fixtureResult({ kind: "conflict", latest: latest ?? null });
      const review = {
        id: crypto.randomUUID(),
        client_id: args._client_id,
        professional_id: uid,
        hypothesis_key: args._hypothesis_key,
        hypothesis_title: args._hypothesis_title,
        decision: args._decision,
        note: args._note,
        evidence_fingerprint: args._evidence_fingerprint,
        evidence_snapshot: args._evidence_snapshot,
        version: (latest?.version ?? 0) + 1,
        created_at: new Date().toISOString(),
      };
      db.hypothesis_reviews.push(review);
      persistFixtureFamily();
      return fixtureResult({ kind: "saved", latest: review });
    }
    if (name === "save_genogram_arrangement") {
      const previous = db.genogram_layouts
        .filter((row) => row.client_id === args._client_id)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id))[0];
      if (
        (previous?.id ?? null) !== args._layout_id ||
        (previous?.updated_at ?? null) !== args._expected
      )
        return fixtureError("O arranjo mudou em outra aba. O rascunho local foi preservado.");
      if (previous?.is_fixed) return fixtureError("As posições já estão fixadas.");
      const positions = args._positions as { id: string; x: number; y: number }[];
      if (
        !positions.every((position) =>
          db.genogram_persons.some(
            (person) => person.id === position.id && person.client_id === args._client_id,
          ),
        )
      )
        return fixtureError("Uma pessoa mudou desde que o mapa foi aberto.");
      const now = new Date(
        Math.max(Date.now(), Date.parse(previous?.updated_at ?? fixtureStamp) + 1),
      ).toISOString();
      const layout = {
        id: previous?.id ?? crypto.randomUUID(),
        client_id: args._client_id,
        name: "Layout Atual",
        is_fixed: false,
        created_at: previous?.created_at ?? now,
        updated_at: now,
      };
      db.genogram_layouts = [...db.genogram_layouts.filter((row) => row.id !== layout.id), layout];
      const ids = new Set(positions.map(({ id }) => id));
      db.genogram_node_positions = [
        ...db.genogram_node_positions.filter(
          (row) => row.layout_id !== layout.id || !ids.has(row.node_id),
        ),
        ...positions.map(({ id, x, y }) => ({
          id: crypto.randomUUID(),
          layout_id: layout.id,
          node_id: id,
          node_type: "person",
          x,
          y,
          layout_mode: "MANUAL",
        })),
      ];
      persistFixtureFamily();
      return fixtureResult(layout);
    }
    if (name === "remove_genogram_selection") {
      const peopleIds = new Set(args._people as string[]);
      const linkIds = new Set(args._relationships as string[]);
      const people = db.genogram_persons.filter(
        (row) => row.client_id === args._client_id && !row.is_proband && peopleIds.has(row.id),
      );
      const eligibleLinks = db.genogram_relationships.filter(
        (row) =>
          row.client_id === args._client_id &&
          row.relationship_type !== "parent" &&
          linkIds.has(row.id),
      );
      if (people.length !== peopleIds.size || eligibleLinks.length !== linkIds.size)
        return fixtureError(
          "A seleção mudou ou inclui um item indisponível. Atualize e confira o mapa.",
        );
      const links = db.genogram_relationships.filter(
        (row) =>
          row.client_id === args._client_id &&
          (linkIds.has(row.id) ||
            peopleIds.has(row.from_person_id) ||
            peopleIds.has(row.to_person_id)),
      );
      const reviews = db.genogram_parentage_reviews.filter(
        (row) => row.client_id === args._client_id && peopleIds.has(row.child_id),
      );
      const versions = (rows: { id: string; updated_at: string }[]) =>
        rows.map(({ id, updated_at }) => [id, updated_at]).sort(([a], [b]) => a.localeCompare(b));
      const impact = {
        people: people.length,
        relationships: links.length,
        reviews: reviews.length,
        personVersions: versions(people),
        relationshipVersions: versions(links),
      };
      if (args._expected) {
        if (JSON.stringify(impact) !== JSON.stringify(args._expected))
          return fixtureError(
            "Os vínculos ou a seleção mudaram. Confira novamente antes de remover.",
          );
        db.genogram_relationships = db.genogram_relationships.filter((row) => !links.includes(row));
        db.genogram_parentage_reviews = db.genogram_parentage_reviews.filter(
          (row) => !reviews.includes(row),
        );
        db.genogram_persons = db.genogram_persons.filter((row) => !people.includes(row));
        db.genogram_node_positions = db.genogram_node_positions.filter(
          (row) => !peopleIds.has(row.node_id),
        );
        persistFixtureFamily();
      }
      return fixtureResult(impact);
    }
    if (name === "create_genogram_relative") {
      const clientId = args._client_id;
      const targetId = String(args._target_id);
      if (!db.genogram_persons.some((row) => row.client_id === clientId && row.id === targetId))
        return fixtureError("Dossiê ou familiar indisponível.");
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const person = {
        ...(args._person as object),
        client_id: clientId,
        id,
        is_proband: false,
        parentage_reviewed: false,
        created_at: now,
        updated_at: now,
      };
      db.genogram_persons.push(person);
      if (args._direction === "sibling") {
        db.genogram_relationships.push({
          id: crypto.randomUUID(),
          client_id: clientId,
          from_person_id: targetId,
          to_person_id: id,
          relationship_type: "sibling",
          qualifier: args._kind,
          start_date: null,
          end_date: null,
          notes: null,
          marriage_order: null,
          created_at: now,
          updated_at: now,
        });
      } else {
        const addingParent = args._direction === "parent";
        const parents = addingParent
          ? db.genogram_relationships
              .filter(
                (row) =>
                  row.client_id === clientId &&
                  row.to_person_id === targetId &&
                  row.relationship_type === "parent" &&
                  row.from_person_id !== args._replaces,
              )
              .map((row) => ({ personId: row.from_person_id }))
          : [];
        const result = reviewFixtureParentage({
          _client_id: clientId,
          _child_id: addingParent ? targetId : id,
          _expected: addingParent ? args._expected : [],
          _parents: [...parents, { personId: addingParent ? id : targetId, kind: args._kind }],
          _decision: "edit",
          _source: "unverified",
        });
        if (result.error) {
          db.genogram_persons = db.genogram_persons.filter((row) => row.id !== id);
          return result;
        }
      }
      persistFixtureFamily();
      return fixtureResult(id);
    }
    if (name === "confirm_session_audio_upload") {
      const session = db.clinical_sessions.find((row) => row.id === args._session_id);
      if (
        !session?.audio_path ||
        session.audio_path !== args._path ||
        !["awaiting_upload", "draft", "transcribing", "structuring", "ready", "error"].includes(
          session.status,
        )
      ) {
        return fixtureResult("unavailable");
      }
      if (session.status === "awaiting_upload" && session.clinical_status === "canceled")
        return fixtureResult("canceled");
      if (!fixtureAudio.has(session.audio_path)) return fixtureResult("missing");
      if (session.status === "awaiting_upload") {
        const grant = [...db.audio_consent_events]
          .reverse()
          .find(
            (event) =>
              event.scope === "recording" &&
              event.client_id === session.client_id &&
              (!event.session_id || event.session_id === session.id),
          );
        if (!grant?.granted || grant.id !== session.recording_consent_id)
          return fixtureResult("consent");
        Object.assign(session, {
          status: "draft",
          error_message: null,
          updated_at: new Date().toISOString(),
        });
        persistFixtureFamily();
      }
      return fixtureResult("confirmed");
    }
    if (name === "begin_session_deletion" || name === "finish_session_deletion") {
      const session = db.clinical_sessions.find((row) => row.id === args._session_id);
      if (name === "begin_session_deletion") {
        if (!session) return fixtureResult(null);
        session.status = "deleting";
        persistFixtureFamily();
        return fixtureResult(session.audio_path ?? null);
      }
      if (!session) return fixtureResult(true);
      if (
        session.status !== "deleting" ||
        (session.audio_path && fixtureAudio.has(session.audio_path))
      ) {
        return fixtureResult(false);
      }
      db.clinical_sessions = db.clinical_sessions.filter((row) => row !== session);
      persistFixtureFamily();
      return fixtureResult(true);
    }
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
        "hypothesis_reviews",
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
    if (name === "import_clan_workbook" || name === "import_clan_workbook_v2")
      return importFixtureWorkbook(args);
    if (name === "get_clan_workbook_snapshot") {
      const client = db.clients.find(
        (row) => row.id === args._client_id && row.professional_id === uid,
      );
      if (!client) return fixtureResult(null);
      const reviews = new Map<string, unknown>();
      for (const row of db.genogram_parentage_reviews) {
        if (row.client_id === client.id) reviews.set(row.child_id, row);
      }
      return fixtureResult({
        persons: db.genogram_persons.filter((row) => row.client_id === client.id),
        relationships: db.genogram_relationships.filter((row) => row.client_id === client.id),
        reviews: [...reviews.values()],
      });
    }
    if (name === "remove_empty_clan_rows") {
      const candidates = new Map(
        (args._candidates as { id: string; updated_at: string }[]).map((row) => [
          row.id,
          row.updated_at,
        ]),
      );
      const linked = new Set(
        db.genogram_relationships.flatMap((row) => [row.from_person_id, row.to_person_id]),
      );
      const before = db.genogram_persons.length;
      db.genogram_persons = db.genogram_persons.filter(
        (row) =>
          row.client_id !== args._client_id ||
          row.is_proband ||
          row.parentage_reviewed ||
          row.full_name.trim() ||
          !candidates.has(row.id) ||
          candidates.get(row.id) !== row.updated_at ||
          linked.has(row.id) ||
          db.genogram_parentage_reviews.some((review) => review.child_id === row.id),
      );
      persistFixtureFamily();
      return fixtureResult(before - db.genogram_persons.length);
    }
    if (name === "review_parentage" || name === "undo_parentage_review") {
      const result =
        name === "review_parentage" ? reviewFixtureParentage(args) : undoFixtureParentage(args);
      if (!result.error) persistFixtureFamily();
      return result;
    }
    if (
      [
        "mesa_pending_clinical_records",
        "list_pending_clinical_records",
        "list_pending_clinical_records_v2",
      ].includes(name)
    ) {
      const offset = name === "mesa_pending_clinical_records" ? 0 : Number(args._offset ?? 0);
      const limit = name === "mesa_pending_clinical_records" ? 5 : Number(args._limit ?? 31);
      return fixtureResult(
        db.clinical_sessions
          .filter(
            (session) =>
              session.status !== "deleting" &&
              db.clients.some(
                (client) => client.id === session.client_id && client.status === "active",
              ) &&
              Date.parse(session.session_date) <= Date.now() &&
              (["scheduled", "pending_record"].includes(session.clinical_status) ||
                (session.clinical_status == null &&
                  !session.manual_notes?.trim() &&
                  !session.ai_reviewed_at)),
          )
          .sort(
            (a, b) =>
              Date.parse(b.session_date) - Date.parse(a.session_date) || a.id.localeCompare(b.id),
          )
          .slice(offset, offset + limit)
          .map((session) => {
            const client = db.clients.find((entry) => entry.id === session.client_id);
            return {
              ...session,
              client_name: client?.preferred_name || client?.full_name || "Cliente",
              overdue: session.clinical_status === "scheduled",
            };
          }),
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
    if (
      ![
        "record_audio_consent",
        "record_audio_consent_details",
        "record_audio_consent_idempotent",
      ].includes(name)
    )
      return disabled();
    const reusable = db.audio_consent_events.find(
      (event) =>
        args._request_id && event.request_id === args._request_id && event.professional_id === uid,
    );
    if (reusable) {
      return reusable.client_id === args._client_id &&
        reusable.scope === args._scope &&
        reusable.granted === args._granted &&
        reusable.source === args._source &&
        reusable.session_id === (args._session_id ?? null) &&
        reusable.term_version === (args._term_version ?? null) &&
        reusable.document_reference === (args._document_reference ?? null)
        ? fixtureResult(reusable.id)
        : fixtureError("Esta confirmação já foi registrada com outros dados.");
    }
    if (
      !db.clients.some((client) => client.id === args._client_id) ||
      (args._session_id &&
        !db.clinical_sessions.some(
          (session) => session.id === args._session_id && session.client_id === args._client_id,
        ))
    ) {
      return fixtureError("Caso ou sessão indisponível");
    }
    const decisionId = crypto.randomUUID();
    db.audio_consent_events.push({
      id: decisionId,
      revision: db.audio_consent_events.length + 1,
      client_id: args._client_id,
      professional_id: uid,
      scope: args._scope,
      granted: args._granted,
      source: args._source,
      session_id: args._session_id ?? null,
      term_version: args._term_version ?? null,
      document_reference: args._document_reference ?? null,
      request_id: args._request_id ?? null,
      created_at: new Date().toISOString(),
    });
    return fixtureResult(name === "record_audio_consent_idempotent" ? decisionId : null);
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
      download: async (path: string) => {
        const audio = bucket === "session-audio" ? fixtureAudio.get(path) : undefined;
        return audio ? fixtureResult(audio) : fixtureError("Gravação indisponível.");
      },
      createSignedUrl: async (path: string) => {
        const recorded = bucket === "session-audio" ? fixtureAudio.get(path) : undefined;
        return {
          data: { signedUrl: recorded ? URL.createObjectURL(recorded) : null },
          error: null,
        };
      },
      upload: async (path: string, blob: Blob) => {
        if (bucket !== "session-audio") return disabled();
        if (
          db.clinical_sessions.some(
            (session) => session.audio_path === path && session.clinical_status === "canceled",
          )
        )
          return fixtureError("A sessão foi cancelada.");
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
