import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/biblioteca")({
  component: BibliotecaPage,
});

const autores = [
  { name: "Anne Ancelin Schützenberger", topic: "Síndrome de aniversário, transgeracional" },
  { name: "Alejandro Jodorowsky", topic: "Psicomagia, árvore genealógica" },
  { name: "Bert Hellinger", topic: "Constelações familiares" },
  { name: "Françoise Dolto", topic: "Casa Verde, inconsciente familiar" },
  { name: "Ivan Böszörményi-Nagy", topic: "Lealdades invisíveis, ética relacional" },
  { name: "Didier Dumas", topic: "Ancestralidade e clínica" },
];

function BibliotecaPage() {
  return (
    <div className="container-liz py-12">
      <p className="text-xs uppercase tracking-[0.3em] text-gold">Conhecimento</p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Biblioteca sistêmica</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Autores-base da psicogenealogia. Nas próximas etapas: verbetes completos, busca contextual
        e ligação automática com o caso em atendimento.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {autores.map((a) => (
          <article
            key={a.name}
            className="rounded-lg border border-border bg-card p-6 transition-colors hover:border-gold"
          >
            <h3 className="font-serif text-xl text-primary">{a.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{a.topic}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
