
CREATE TABLE public.library_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author TEXT NOT NULL,
  title TEXT NOT NULL,
  topic TEXT,
  school TEXT,
  summary TEXT,
  content TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.library_entries USING GIN (tags);
CREATE INDEX ON public.library_entries (author);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_entries TO authenticated;
GRANT ALL ON public.library_entries TO service_role;

ALTER TABLE public.library_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated user can read library"
  ON public.library_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins insert library"
  ON public.library_entries FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins update library"
  ON public.library_entries FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins delete library"
  ON public.library_entries FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_library_entries_updated_at
  BEFORE UPDATE ON public.library_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed base authors
INSERT INTO public.library_entries (author, title, topic, school, summary, content, tags) VALUES
('Anne Ancelin Schützenberger', 'Ai, meus ancestrais!', 'Síndrome de aniversário e transmissão transgeracional', 'Psicogenealogia clássica',
 'Fundadora da psicogenealogia moderna. Cunhou o conceito de "síndrome de aniversário": repetições inconscientes de eventos traumáticos em datas simbólicas do clã.',
 'Schützenberger demonstra como lealdades invisíveis, segredos e traumas não elaborados atravessam gerações. A construção do genossociograma é a ferramenta central: mapear datas, doenças, mortes, casamentos e rupturas revela padrões que o sujeito repete sem perceber. Palavras-chave: cripta, fantasma, não-dito, aniversário.',
 ARRAY['transgeracional','aniversario','genossociograma','trauma','segredos']),

('Alejandro Jodorowsky', 'A dança da realidade / Psicomagia', 'Árvore genealógica e atos poéticos', 'Psicomagia',
 'Combina árvore genealógica com atos simbólicos (psicomagia) para desatar nós do clã. Trabalha nomes, profissões, repetições de idade e casamentos.',
 'Para Jodorowsky, a árvore é o inconsciente familiar em forma visível. O sujeito é convocado a curar não só a si, mas também os ancestrais. O ato psicomágico é uma prescrição simbólica que fala diretamente ao inconsciente. Atenção clínica: no Brasil, integrar com prudência ética e sem promessa mágica.',
 ARRAY['arvore','psicomagia','nomes','atos-simbolicos']),

('Bert Hellinger', 'Ordens do amor', 'Constelações familiares e ordens sistêmicas', 'Constelação familiar',
 'Formulou as três Ordens do Amor: pertencimento, hierarquia e equilíbrio entre dar e receber. Excluídos do sistema retornam como sintoma em descendentes.',
 'A técnica das constelações permite visualizar dinâmicas ocultas do sistema. Conceitos-chave: excluído, identificação com o destino do outro, movimento interrompido em direção à mãe. Em psicogenealogia, oferece leitura sistêmica dos vínculos e da lealdade cega.',
 ARRAY['constelacao','ordens-do-amor','excluidos','lealdade']),

('Françoise Dolto', 'A causa das crianças', 'Inconsciente familiar e imagem inconsciente do corpo', 'Psicanálise infantil',
 'Introduziu a escuta do bebê como sujeito de linguagem. Formulou a "imagem inconsciente do corpo" e trabalhou não-ditos familiares que aprisionam a criança.',
 'Para Dolto, o sintoma da criança fala do inconsciente do casal parental e do clã. A verbalização do não-dito à criança — mesmo bebê — libera o sistema. Referência para trabalhar transmissão de traumas pré-verbais e segredos familiares.',
 ARRAY['infancia','nao-dito','corpo','pre-verbal']),

('Ivan Böszörményi-Nagy', 'Lealdades invisíveis', 'Ética relacional transgeracional', 'Terapia contextual',
 'Propôs a ética relacional: cada geração herda um "livro-razão" invisível de dívidas e créditos afetivos que orienta lealdades e sacrifícios inconscientes.',
 'Conceitos: legado destrutivo, parentificação, justiça relacional. A cura passa por reconhecer débitos herdados e devolver ao lugar de origem o que não é seu. Base ética para o trabalho psicogenealógico.',
 ARRAY['lealdade','etica','parentificacao','divida']),

('Didier Dumas', 'O anjo e o fantasma', 'Ancestralidade, morte e psicanálise', 'Psicanálise transgeracional',
 'Psicanalista discípulo de Dolto. Trabalha a inscrição do morto no vivo, o luto não feito e a herança dos fantasmas do clã.',
 'Dumas articula clínica e antropologia: sem ritual de morte adequado, o morto vira fantasma que habita o corpo do descendente. Ferramenta essencial para casos de luto patológico, natimortos silenciados e mortes trágicas na linhagem.',
 ARRAY['morte','luto','fantasma','ancestralidade']);
