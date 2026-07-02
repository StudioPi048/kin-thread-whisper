import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/clientes")({
  component: ClientesPage,
});

function ClientesPage() {
  return (
    <div className="container-liz py-12">
      <p className="text-xs uppercase tracking-[0.3em] text-gold">Consultório</p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Clientes</h1>
      <p className="mt-3 text-muted-foreground">
        Nenhum cliente cadastrado ainda. O CRUD completo chega na próxima etapa.
      </p>

      <div className="mt-12 rounded-lg border border-dashed border-border bg-card/50 p-16 text-center">
        <p className="font-serif text-2xl text-primary">Em breve</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Dossiê multi-dimensional · Mídia · Consentimento LGPD · Genossociograma
        </p>
      </div>
    </div>
  );
}
