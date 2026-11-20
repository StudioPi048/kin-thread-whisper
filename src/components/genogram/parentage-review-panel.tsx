import { useEffect, useId, useRef, useState } from "react";
import { Crosshair, Link2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { relationshipQualifiers } from "@/lib/genogram";
import {
  parentageSources,
  type ParentageSource,
  type ParentageVersion,
} from "@/lib/parentage-review";

export type ReviewParent = { personId: string; kind: string };
type PersonOption = {
  id: string;
  full_name?: string | null;
  preferred_name?: string | null;
  relationship_to_proband?: string | null;
  birth_date?: string | null;
};

export type ParentageDraft = {
  childId: string;
  expected: ParentageVersion[];
  current: (ReviewParent & { notes?: string | null })[];
  proposed: [ReviewParent, ReviewParent];
  pendingParent?: ReviewParent;
  suggestedIds: string[];
  source: ParentageSource;
  note: string;
};

const parentagePersonName = (person?: PersonOption) =>
  person?.full_name?.trim() || person?.preferred_name?.trim() || "Pessoa sem nome";

const foldName = (value: string) =>
  value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{M}/gu, "");

function parentageOptionLabel(person: PersonOption) {
  const name = parentagePersonName(person);
  return [
    name,
    person.relationship_to_proband !== name ? person.relationship_to_proband : null,
    person.birth_date?.slice(0, 4),
  ]
    .filter(Boolean)
    .join(" · ");
}

type ReviewSource = { source: ParentageSource; note: string | null };

export function ParentageReviewPanel({
  draft,
  people,
  previousSource,
  error,
  validation,
  pending,
  onChange,
  onConfirm,
  onClose,
  onShowMap,
  onPickParent,
}: {
  draft: ParentageDraft;
  people: readonly PersonOption[];
  previousSource?: ReviewSource;
  error: string | undefined;
  validation: string | null;
  pending: boolean;
  onChange: (draft: ParentageDraft) => void;
  onConfirm: () => void;
  onClose: () => void;
  onShowMap: () => void;
  onPickParent: (slot: number) => void;
}) {
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [queries, setQueries] = useState(["", ""]);
  const child = people.find((person) => person.id === draft.childId);
  const proposedIds = new Set(draft.proposed.map(({ personId }) => personId).filter(Boolean));
  const removed = draft.current.filter((parent) => !proposedIds.has(parent.personId));
  const kinds = [...relationshipQualifiers.parent, { value: "unknown", label: "Por confirmar" }];
  const parentName = (id: string) => parentagePersonName(people.find((person) => person.id === id));

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "nearest" });
  }, [draft.childId]);

  function editSlot(slot: number, change: Partial<ReviewParent>) {
    const proposed: ParentageDraft["proposed"] = [...draft.proposed];
    proposed[slot] = { ...proposed[slot], ...change };
    onChange({
      ...draft,
      proposed,
      pendingParent:
        change.personId === draft.pendingParent?.personId ? undefined : draft.pendingParent,
    });
  }

  return (
    <section
      aria-label="Revisão de filiação"
      className="geno-parentage-review"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented && !pending) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <header className="geno-parentage-header">
        <div className="min-w-0">
          <h2 id={headingId} ref={heading} tabIndex={-1}>
            Revisão de filiação
          </h2>
          <p>{parentagePersonName(child)}</p>
        </div>
        <Button
          className="size-11 shrink-0"
          type="button"
          variant="ghost"
          aria-label="Fechar revisão de filiação"
          disabled={pending}
          onClick={onClose}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </header>
      <form
        aria-labelledby={headingId}
        onSubmit={(event) => {
          event.preventDefault();
          if (!validation && !pending) onConfirm();
        }}
      >
        <div className="geno-parentage-fields">
          <fieldset disabled={pending}>
            <div className="geno-parentage-current">
              <h3>
                <span className="geno-parentage-stroke" aria-hidden />
                Filiação atual
              </h3>
              {draft.current.length ? (
                <ul>
                  {draft.current.map((parent, i) => (
                    <li key={`${parent.personId}-${i}`}>
                      <strong>{parentName(parent.personId)}</strong>
                      <span>
                        {kinds.find(({ value }) => value === parent.kind)?.label ??
                          "Natureza não registrada"}
                      </span>
                      {parent.notes && <span>Observação registrada · {parent.notes}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Sem filiação registrada.</p>
              )}
              {previousSource && (
                <p>
                  {parentageSources[previousSource.source]}
                  {previousSource.note && <> · {previousSource.note}</>}
                </p>
              )}
            </div>

            <div className="geno-parentage-proposal">
              <h3>
                <span
                  className="geno-parentage-stroke geno-parentage-stroke--proposal"
                  aria-hidden
                />
                Filiação proposta
              </h3>
              {draft.pendingParent && (
                <div className="geno-parentage-candidate">
                  <p>
                    <strong>{parentName(draft.pendingParent.personId)}</strong> foi indicado para a
                    filiação. Escolha quem será substituído.
                  </p>
                  {[0, 1].map((slot) => (
                    <Button
                      key={slot}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-11 whitespace-normal text-left"
                      onClick={() => editSlot(slot, draft.pendingParent!)}
                    >
                      Substituir {parentName(draft.proposed[slot].personId)}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onChange({ ...draft, pendingParent: undefined })}
                  >
                    Retirar proposta
                  </Button>
                </div>
              )}
              {draft.proposed.map((parent, slot) => (
                <div key={slot} className="geno-parentage-slot">
                  <label className="geno-parentage-search">
                    <span className="sr-only">Buscar genitor {slot + 1}</span>
                    <Search className="size-4" aria-hidden />
                    <input
                      value={queries[slot]}
                      placeholder="Buscar nome, parentesco ou ano"
                      onChange={(event) => {
                        const value = event.target.value;
                        setQueries((current) =>
                          current.map((query, index) => (index === slot ? value : query)),
                        );
                      }}
                    />
                  </label>
                  <label>
                    Genitor {slot + 1}
                    <select
                      value={parent.personId}
                      onChange={(event) => {
                        const personId = event.target.value;
                        const sameParent = draft.current.find((item) => item.personId === personId);
                        editSlot(slot, { personId, kind: sameParent?.kind ?? "" });
                      }}
                    >
                      <option value="">Sem genitor neste campo</option>
                      {people
                        .filter(
                          (person) =>
                            person.id !== draft.childId &&
                            (person.id === parent.personId ||
                              foldName(parentageOptionLabel(person)).includes(
                                foldName(queries[slot].trim()),
                              )),
                        )
                        .map((person) => (
                          <option
                            key={person.id}
                            value={person.id}
                            disabled={draft.proposed[1 - slot].personId === person.id}
                          >
                            {parentageOptionLabel(person)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11 justify-self-start"
                    aria-label={`Escolher genitor ${slot + 1} no mapa`}
                    onClick={() => onPickParent(slot)}
                  >
                    <Crosshair className="size-4" aria-hidden /> Escolher no mapa
                  </Button>
                  {parent.personId && (
                    <>
                      <p className="geno-parentage-selected">
                        {parentName(parent.personId)}
                        {draft.suggestedIds.includes(parent.personId) && (
                          <span> · Sugestão pelo parentesco</span>
                        )}
                      </p>
                      <label>
                        Natureza do vínculo {slot + 1}
                        <select
                          value={
                            kinds.some(({ value }) => value === parent.kind) ? parent.kind : ""
                          }
                          onChange={(event) => editSlot(slot, { kind: event.target.value })}
                        >
                          <option value="">
                            {draft.current.some((item) => item.personId === parent.personId)
                              ? "Manter natureza registrada"
                              : "Selecione a natureza"}
                          </option>
                          {kinds.map(({ value, label }) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                </div>
              ))}
              {removed.length > 0 && (
                <p className="geno-parentage-removals">
                  Sai da filiação após confirmar ·{" "}
                  {removed.map((parent) => parentName(parent.personId)).join(", ")}
                </p>
              )}
            </div>

            <details className="geno-parentage-source">
              <summary>Registrar fonte e observação</summary>
              <label>
                Fonte consultada
                <select
                  value={draft.source}
                  onChange={(event) =>
                    onChange({ ...draft, source: event.target.value as ParentageSource })
                  }
                >
                  {Object.entries(parentageSources).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Observação da revisão
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={draft.note}
                  onChange={(event) => onChange({ ...draft, note: event.target.value })}
                />
              </label>
            </details>
          </fieldset>
        </div>
        {(error || validation) && (
          <p role={error ? "alert" : "status"} className="geno-parentage-error">
            {error ?? validation}
          </p>
        )}
        <footer>
          <Button type="button" variant="outline" className="min-h-11" onClick={onShowMap}>
            <Crosshair className="size-4" aria-hidden /> Ver no mapa
          </Button>
          <Button
            type="submit"
            variant="forest"
            className="min-h-11"
            disabled={!!validation || pending}
          >
            <Link2 className="size-4" aria-hidden />
            {pending ? "Confirmando…" : "Confirmar filiação"}
          </Button>
        </footer>
      </form>
    </section>
  );
}
