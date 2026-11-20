/* eslint-disable @typescript-eslint/no-explicit-any */
// Test-only in-memory data. Loaded exclusively by vite.visual.config.ts.
const uid = "00000000-0000-4000-8000-000000000001";
export const cid = "00000000-0000-4000-8000-000000000002";
const now = new Date();
const stamp = now.toISOString();
export const clients = ["Helena Duarte", "Marina Costa", "Rafael Almeida", "Lucas Santos"].map(
  (full_name, i) => ({
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
  }),
);
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
    id: `session-${i}`,
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
    clients: clients[i],
  };
});
const db: Record<string, any[]> = {
  clients,
  genogram_persons: persons,
  genogram_relationships: rels,
  clinical_sessions: sessions,
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
class Query {
  rows: any[];
  filters: ((r: any) => boolean)[] = [];
  one = false;
  head = false;
  max = Infinity;
  start = 0;
  mutation: string | null = null;
  payload: any;
  ordering: { k: string; asc: boolean } | null = null;
  constructor(public table: string) {
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
  in(k: string, v: any[]) {
    this.filters.push((r) => v.includes(r[k]));
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
    this.ordering = { k, asc: o?.ascending !== false };
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
        const updated = new Map(rows.map((row) => [row, { ...row, ...this.payload }]));
        db[this.table] = this.rows.map((row) => updated.get(row) ?? row);
        rows = [...updated.values()];
      }
      if (this.mutation === "delete") db[this.table] = this.rows.filter((r) => !rows.includes(r));
      if (this.mutation === "insert" || this.mutation === "upsert") {
        rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((v: any) => ({
          id: crypto.randomUUID(),
          created_at: stamp,
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
      if (this.ordering) {
        const { k, asc } = this.ordering;
        rows.sort((a, b) => String(a[k]).localeCompare(String(b[k])) * (asc ? 1 : -1));
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
export const supabase: any = {
  from: (table: string) => new Query(table),
  rpc: disabled,
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
    from: () => ({
      createSignedUrl: async () => ({ data: { signedUrl: null }, error: null }),
      upload: disabled,
      remove: disabled,
    }),
  },
  functions: { invoke: disabled },
};
if (typeof document !== "undefined" && !document.querySelector(".genealiz-preview-notice")) {
  const notice = document.createElement("div");
  notice.className = "genealiz-preview-notice";
  notice.textContent = "Preview local · dados fictícios · alterações apenas em memória";
  notice.setAttribute("role", "status");
  notice.style.cssText =
    "position:fixed;bottom:0;right:0;z-index:1000;background:#E7BF86;color:#17273A;padding:5px 12px;font:11px Inter,sans-serif;border-radius:5px 0 0 0;pointer-events:none";
  document.body.append(notice);
  const noticeStyles = document.createElement("style");
  noticeStyles.textContent =
    "@media(max-width:767px){.genealiz-preview-notice{bottom:calc(72px + env(safe-area-inset-bottom))!important;max-width:100%;font-size:10px!important}}";
  document.head.append(noticeStyles);
}
