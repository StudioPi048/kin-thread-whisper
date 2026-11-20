import { readDossierReport, type ExportPageReader } from "@/lib/data-export";
import { buildLogicalGraph } from "@/lib/geno/build";
import { buildCaseTimeline, formatByPrecision } from "@/lib/timeline";
import { CLINICAL_LABEL, clinicalStatusOf } from "@/lib/session-state";
import type { PersonRow, RelationshipRow } from "@/lib/patterns";

export type ReportOptions = {
  family: boolean;
  timeline: boolean;
  sessions: boolean;
  includeNotes: boolean;
  reducedIdentity: boolean;
};

type ReportSection = { title: string; lines: string[] };
export type DossierReport = { title: string; sections: ReportSection[] };

const timelineType = {
  birth: "Nascimento",
  death: "Falecimento",
  union: "União",
  event: "Acontecimento",
};

export async function prepareDossierReport(
  read: ExportPageReader,
  userId: string,
  clientId: string,
  options: ReportOptions,
): Promise<DossierReport> {
  const includeNotes = options.sessions && options.includeNotes && !options.reducedIdentity;
  const source = await readDossierReport(read, userId, clientId, { ...options, includeNotes });
  const persons = source.persons as unknown as PersonRow[];
  const relationships = source.links as unknown as RelationshipRow[];
  const graph = buildLogicalGraph({
    persons,
    rels: relationships,
    probandId: persons.find((person) => person.is_proband)?.id,
  });
  const displayed = new Map(
    persons.map((person, index) => [
      person.id,
      options.reducedIdentity ? `Pessoa ${index + 1}` : person.full_name,
    ]),
  );
  const sections: ReportSection[] = [];
  if (options.family) {
    const lines = [...graph.persons.values()]
      .sort((a, b) => a.generation - b.generation)
      .map((person) => {
        const name = displayed.get(person.row.id);
        const parents = (graph.parentsByChild.get(person.row.id) ?? [])
          .filter((parent) => parent.source === "explicit")
          .map((parent) => displayed.get(parent.personId))
          .filter(Boolean);
        const role = options.reducedIdentity
          ? person.row.is_proband
            ? "Consultante"
            : `Geração ${person.generation}`
          : person.row.relationship_to_proband;
        return [
          name,
          role,
          parents.length ? `Genitores registrados · ${parents.join(" e ")}` : null,
        ]
          .filter(Boolean)
          .join(" · ");
      });
    sections.push({ title: "Família e filiações", lines });
  }
  if (options.timeline) {
    const lines = buildCaseTimeline(persons, graph, relationships).map((event) => {
      const when = options.reducedIdentity
        ? event.year
          ? String(event.year)
          : "Data desconhecida"
        : formatByPrecision(event.rawDate, event.precision);
      return [
        when,
        displayed.get(event.personId),
        options.reducedIdentity ? timelineType[event.kind] : event.label,
      ]
        .filter(Boolean)
        .join(" · ");
    });
    sections.push({ title: "Linha do tempo", lines });
  }
  if (options.sessions) {
    const format = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
    const lines = source.sessions
      .filter((session) => session.user_id === userId)
      .sort((a, b) => String(a.session_date).localeCompare(String(b.session_date)))
      .map((session) => {
        const date = new Date(String(session.session_date));
        const when = Number.isNaN(date.getTime())
          ? "Data desconhecida"
          : options.reducedIdentity
            ? String(date.getUTCFullYear())
            : format.format(date);
        const note =
          includeNotes && typeof session.manual_notes === "string"
            ? session.manual_notes.trim()
            : "";
        const clinical = clinicalStatusOf({
          session_date: String(session.session_date),
          status: String(session.status),
          clinical_status:
            typeof session.clinical_status === "string" ? session.clinical_status : null,
          manual_notes: note,
        });
        return `${when} · ${CLINICAL_LABEL[clinical]}${note ? `\n${note}` : ""}`;
      });
    sections.push({ title: "Sessões", lines });
  }
  return {
    title: options.reducedIdentity ? "Relatório do dossiê" : source.clientName,
    sections,
  };
}

export async function saveDossierReportPdf(report: DossierReport) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ format: "a4", unit: "pt" });
  const maxWidth = 495;
  const bottom = doc.internal.pageSize.getHeight() - 48;
  const x = 50;
  let y = 56;

  function text(value: string, options: { size: number; bold?: boolean; line: number }) {
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(options.size);
    const wrapped = doc.splitTextToSize(value, maxWidth) as string[];
    for (const line of wrapped) {
      if (y > bottom) {
        doc.addPage();
        y = 56;
      }
      doc.text(line, x, y);
      y += options.line;
    }
  }

  text("GENEALIZ", { size: 12, bold: true, line: 22 });
  text(report.title, { size: 20, bold: true, line: 26 });
  for (const section of report.sections) {
    if (y > bottom - 45) {
      doc.addPage();
      y = 56;
    }
    y += 15;
    text(section.title, { size: 13, bold: true, line: 21 });
    for (const line of section.lines.length
      ? section.lines
      : ["Sem registros para este relatório."]) {
      text(line, { size: 11, line: 17 });
      y += 4;
    }
  }
  doc.save(`genealiz-relatorio-${new Date().toISOString().slice(0, 10)}.pdf`);
}
