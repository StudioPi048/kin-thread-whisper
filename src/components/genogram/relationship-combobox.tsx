import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { RELATIONSHIP_GROUPS } from "@/lib/relationship-normalizer";
import { cn } from "@/lib/utils";

/**
 * Combobox buscável de parentesco — usado na planilha do clã e no formulário
 * de pessoa do genograma. Sempre permite texto livre como fallback (a
 * "restrição" era o problema original; a lista é ajuda, não bloqueio).
 */
export function RelationshipCombobox({
  value,
  onChange,
  hasWarning,
  triggerClassName,
  placeholder = "Selecionar parentesco…",
}: {
  value: string;
  onChange: (v: string) => void;
  hasWarning?: boolean;
  triggerClassName?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const trimmedSearch = search.trim();
  const hasExactMatch = RELATIONSHIP_GROUPS.some((g) =>
    g.options.some((o) => o.toLowerCase() === trimmedSearch.toLowerCase()),
  );

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setSearch(value);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center text-left outline-none transition-all truncate",
            value ? "text-foreground" : "text-muted-foreground/40",
            hasWarning && "pr-8 bg-clinical-critical/5",
            triggerClassName,
          )}
        >
          {value || placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Buscar (ex: avô, tio, bisavó materna)…"
          />
          <CommandList>
            <CommandEmpty className="px-3 py-4 text-[13px] text-muted-foreground">
              Nenhuma opção da lista bate com isso.
            </CommandEmpty>
            {trimmedSearch && !hasExactMatch && (
              <CommandGroup heading="Texto digitado">
                <CommandItem
                  value={`__custom__${trimmedSearch}`}
                  onSelect={() => {
                    onChange(trimmedSearch);
                    setOpen(false);
                  }}
                >
                  Usar "{trimmedSearch}" mesmo assim
                </CommandItem>
              </CommandGroup>
            )}
            {RELATIONSHIP_GROUPS.map((group) => {
              const filtered = trimmedSearch
                ? group.options.filter((o) => o.toLowerCase().includes(trimmedSearch.toLowerCase()))
                : group.options;
              if (filtered.length === 0) return null;
              return (
                <CommandGroup key={group.label} heading={group.label}>
                  {filtered.map((opt) => (
                    <CommandItem
                      key={opt}
                      value={opt}
                      onSelect={() => {
                        onChange(opt);
                        setOpen(false);
                      }}
                    >
                      {opt}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
