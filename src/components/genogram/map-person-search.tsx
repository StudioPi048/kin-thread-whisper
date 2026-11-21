import { useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { Node } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { generationTitle, spatialPersonLabel } from "./genogram-spatial-layout";
import { mapBranchNames } from "./map-view-context";
import type { PersonNodeData } from "./person-node";

const PAGE_SIZE = 48;
const byName = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
const forSearch = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").trim();

export function MapPersonSearch({
  nodes,
  label,
  onChoose,
}: {
  nodes: readonly Node[];
  label: string;
  onChoose: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="geno-editor-search-trigger"
          disabled={nodes.length === 0}
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span>{label}</span>
          <ChevronDown className="ml-auto size-4 shrink-0" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="geno-editor-search"
        align="start"
        collisionPadding={8}
        aria-label={label}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          input.current?.focus();
        }}
      >
        <PersonDirectory
          nodes={nodes}
          input={input}
          onChoose={(id) => {
            setOpen(false);
            onChoose(id);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function PersonDirectory({
  nodes,
  input,
  onChoose,
}: {
  nodes: readonly Node[];
  input: React.RefObject<HTMLInputElement | null>;
  onChoose: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [generation, setGeneration] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const list = useRef<HTMLDivElement>(null);
  const people = useMemo(
    () =>
      nodes
        .filter((node) => node.type === "person")
        .map((node) => {
          const data = node.data as PersonNodeData;
          const { name, relationship } = spatialPersonLabel(data);
          const level = Number(data.generation);
          const date = data.birth_date ?? data.birth_date_partial;
          const year = date?.match(/\b\d{4}\b/)?.[0];
          const group = generationTitle(level, data.lane);
          const details = [relationship, year].filter(Boolean).join(" · ");
          const branch =
            data.branchId === "maternal" || data.branchId === "paternal"
              ? mapBranchNames[data.branchId]
              : "";
          return {
            id: node.id,
            name,
            level,
            group,
            details,
            reference: data.is_proband,
            searchable: forSearch([name, details, group, data.preferred_name, branch].join(" ")),
          };
        })
        .sort(
          (a, b) =>
            a.level - b.level ||
            Number(b.reference) - Number(a.reference) ||
            byName.compare(a.name, b.name),
        ),
    [nodes],
  );
  const words = forSearch(query).split(/\s+/).filter(Boolean);
  const results = people.filter(
    (person) =>
      (!generation || person.group === generation) &&
      words.every((word) => person.searchable.includes(word)),
  );
  const groups = [...new Set(people.map(({ group }) => group))];
  const count = results.length;
  const resetResults = () => {
    setLimit(PAGE_SIZE);
    if (list.current) list.current.scrollTop = 0;
  };
  return (
    <Command shouldFilter={false} label="Índice de familiares">
      <CommandInput
        ref={input}
        value={query}
        onValueChange={(next) => {
          setQuery(next);
          resetResults();
        }}
        placeholder="Nome ou parentesco"
        aria-label="Nome ou parentesco"
      />
      <div className="geno-editor-search-scope">
        <select
          aria-label="Geração"
          value={generation}
          onChange={(event) => {
            setGeneration(event.target.value);
            resetResults();
          }}
        >
          <option value="">Todas as gerações</option>
          {groups.map((group) => (
            <option key={group}>{group}</option>
          ))}
        </select>
        <span role="status">
          {count} {count === 1 ? "familiar" : "familiares"}
        </span>
      </div>
      <CommandList label="Familiares" ref={list} className="geno-editor-search-list">
        {count === 0 && <p className="p-4 text-sm">Nenhum familiar encontrado.</p>}
        {results.slice(0, limit).map((person) => (
          <CommandItem key={person.id} value={person.id} onSelect={() => onChoose(person.id)}>
            <span>{person.name}</span>
            {person.details && <small>{person.details}</small>}
          </CommandItem>
        ))}
        {limit < count && (
          <CommandItem
            className="geno-editor-search-more"
            value="show-more-people"
            onSelect={() => setLimit((current) => current + PAGE_SIZE)}
          >
            Mostrar mais familiares
          </CommandItem>
        )}
      </CommandList>
    </Command>
  );
}
