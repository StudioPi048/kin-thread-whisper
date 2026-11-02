import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useBlocker } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { UnsavedRegistry, isGuardedNavigation, type UnsavedEntry } from "@/lib/unsaved";

const Ctx = createContext<UnsavedRegistry | null>(null);

/**
 * Um único guard no app autenticado: bloqueia troca de página e de aba do
 * dossiê (TanStack useBlocker) e o fechamento da aba do navegador enquanto
 * algum componente registrado tiver alterações pendentes.
 */
export function UnsavedProvider({ children }: { children: ReactNode }) {
  const [registry] = useState(() => new UnsavedRegistry());
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      registry.anyDirty() &&
      isGuardedNavigation(
        { pathname: current.pathname, search: current.search as Record<string, unknown> },
        { pathname: next.pathname, search: next.search as Record<string, unknown> },
      ),
    enableBeforeUnload: () => registry.anyDirty(),
    withResolver: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = blocker.status === "blocked";
  const labels = open ? [...new Set(registry.dirty().map(([, e]) => e.label))] : [];

  const close = () => {
    setError(null);
    blocker.reset?.();
  };
  const save = async () => {
    setSaving(true);
    setError(null);
    const r = await registry.saveAll();
    setSaving(false);
    if (r.ok) blocker.proceed?.();
    else
      setError(
        `Não foi possível salvar: ${r.failed.map((f) => `${f.label} (${f.message})`).join("; ")}. Suas alterações continuam na tela.`,
      );
  };
  const discard = () => {
    registry.discardAll();
    setError(null);
    blocker.proceed?.();
  };

  return (
    <Ctx.Provider value={registry}>
      {children}
      <AlertDialog open={open} onOpenChange={(o) => !o && !saving && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Há alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-[15px]">
                <p>Antes de sair, escolha o que fazer com:</p>
                <ul className="list-disc pl-5">
                  {labels.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
                {error && (
                  <p role="alert" className="font-semibold text-destructive">
                    {error}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="min-h-11" onClick={close} disabled={saving}>
              Ficar aqui
            </Button>
            <Button variant="outline" className="min-h-11" onClick={discard} disabled={saving}>
              Descartar e sair
            </Button>
            <Button className="min-h-11" onClick={save} disabled={saving}>
              {saving ? "Salvando…" : "Salvar e sair"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Ctx.Provider>
  );
}

/**
 * Registra uma fonte de alterações pendentes. Os callbacks são lidos por
 * ref, então sempre veem o estado mais recente. Fora do provider, não faz nada.
 */
export function useUnsaved(key: string, entry: UnsavedEntry) {
  const registry = useContext(Ctx);
  const ref = useRef(entry);
  ref.current = entry;
  useEffect(() => {
    if (!registry) return;
    registry.set(key, {
      get label() {
        return ref.current.label;
      },
      isDirty: () => ref.current.isDirty(),
      save: () => ref.current.save(),
      discard: () => ref.current.discard(),
    });
    return () => registry.delete(key);
  }, [registry, key]);
}
