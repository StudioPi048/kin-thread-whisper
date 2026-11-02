import { describe, expect, it } from "vitest";
import { buildLogicalGraph, layoutGraph, GEN_GAP, type NodePositionRow } from "./geno/build";
import { parseDateString } from "./clan-import";
import type { PersonRow, RelationshipRow } from "./patterns";

const person = (id: string, is_proband = false): PersonRow =>
  ({
    id,
    client_id: "synthetic-case",
    full_name: id,
    is_proband,
    relationship_to_proband: null,
    health_conditions: [],
    life_events: [],
    tags: [],
    birth_date: null,
    death_date: null,
    is_deceased: false,
  }) as unknown as PersonRow;
const parent = (from: string, to: string): RelationshipRow =>
  ({
    id: `${from}-${to}`,
    client_id: "synthetic-case",
    from_person_id: from,
    to_person_id: to,
    relationship_type: "parent",
    qualifier: "biological",
  }) as RelationshipRow;

describe("integração: verdade das datas e orientação obrigatória", () => {
  it("não fabrica uma data exata a partir de ano ou dia/mês sem ano", () => {
    expect(parseDateString("1985")).toBeNull();
    expect(parseDateString("14/08")).toBeNull();
    expect(parseDateString("31/02/1985")).toBeNull();
    expect(parseDateString("14/08/1985")).toBe("1985-08-14");
  });

  it("resolve três gerações sem tags, independentemente da ordem dos vínculos", () => {
    const persons = [
      person("client", true),
      person("sibling"),
      person("father"),
      person("mother"),
      person("grandfather"),
      person("grandmother"),
    ];
    const rels = [
      parent("grandmother", "father"),
      parent("father", "sibling"),
      parent("mother", "client"),
      parent("grandfather", "father"),
      parent("mother", "sibling"),
      parent("father", "client"),
    ];
    const g = buildLogicalGraph({ persons, rels });
    expect(g.persons.get("father")!.generation).toBe(1);
    expect(g.persons.get("grandfather")!.generation).toBe(2);
    const pl = layoutGraph(g);
    const y = (id: string) => pl.personPos.get(id)!.y;
    expect(y("client")).toBe(0);
    expect(y("sibling")).toBe(y("client"));
    expect(y("father")).toBe(GEN_GAP);
    expect(y("mother")).toBe(GEN_GAP);
    expect(y("grandfather")).toBe(2 * GEN_GAP);
    expect(y("grandmother")).toBe(2 * GEN_GAP);
  });

  it("posições antigas invertidas preservam X sem inverter gerações", () => {
    const persons = [person("client", true), person("father"), person("mother")];
    const g = buildLogicalGraph({
      persons,
      rels: [parent("father", "client"), parent("mother", "client")],
      positions: [
        { node_id: "client", node_type: "person", x: 47, y: 900 },
        { node_id: "father", node_type: "person", x: -250, y: -100 },
      ] as NodePositionRow[],
    });
    const pl = layoutGraph(g);
    expect(pl.personPos.get("client")!.y).toBe(0);
    expect(pl.personPos.get("father")!.y).toBe(GEN_GAP);
    expect(pl.personPos.get("client")!.x).toBe(47);
    expect(pl.personPos.get("father")!.x).toBe(-250);
  });
});
