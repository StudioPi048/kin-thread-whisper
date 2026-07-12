# Manifesto Visual GeneaLiz

> **O que é um software de Psicogenealogia?**
> Não é um CRM. Não é um prontuário médico. Não é uma rede social corporativa.
> É um **arquivo vivo de histórias, heranças e repetições**.
> Este manifesto define como o GeneaLiz deixa de ser uma plataforma clínica com UI premium e passa a ser uma linguagem visual proprietária, impossível de confundir com outro SaaS.

---

## 1. A Essência do Problema

Um dentista trabalha com radiografias. Um vendedor trabalha com pipeline.
Um psicogenealogista trabalha com:
- Linhagens
- Padrões transgeracionais
- Segredos familiares
- Lealdades invisíveis
- Traumas herdados
- Silêncios (o que não foi dito)

Se a plataforma usa os mesmos ícones, o mesmo espaçamento e a mesma estrutura de um software financeiro, o cérebro do usuário interpreta a ferramenta como genérica.
**A UI deve transparecer a natureza da disciplina.**

---

## 2. Como os Conceitos da Psicogenealogia se Materializam na Interface?

Abaixo, a definição de como os objetos de domínio da Psicogenealogia deixam de ser "textos em cards" e passam a ser **representações visuais**.

### Como uma HIPÓTESE CLÍNICA é representada?
Não é um alerta vermelho ou um box amarelo de "Aviso".
Uma hipótese é **investigativa, provisória e valiosa**.
- **Materialidade**: `surface-manuscript` (fundo levemente escurecido, sugerindo anotação a lápis).
- **Tipografia**: Serif Itálica (`Cormorant Garamond italic`). É uma voz autoral, não um dado de sistema.
- **Microinteração**: Revelação suave. A hipótese não grita; ela se oferece à leitura.

### Como um SEGREDO FAMILIAR ou SILÊNCIO é representado?
O segredo é o que não está lá, mas pesa.
- **Espaço (Ritmo)**: Zonas de respiro intencional (silêncio visual). Um card com um segredo familiar detectado tem mais padding interno, forçando o olhar a desacelerar.
- **Tipografia**: Ausência deliberada de negrito. Textos em tons mais suaves (`ink-soft`), sugerindo algo que está oculto na neblina do tempo.
- **Símbolo**: Uma área pontilhada ou um espaço em branco demarcado.

### Como um PADRÃO TRANSGERACIONAL aparece?
O padrão é a repetição.
- **Visualização**: Múltiplos ecos visuais. Se uma "Síndrome de Aniversário" é detectada, ela não é apenas uma tag. Ela possui o material `protocol` (`--material-protocol`), mas acompanhada do `GenealogicalMark` repetido, mostrando que aquilo vem de longe.
- **Na Linha do Tempo**: O padrão conecta dois eventos distantes com uma linha tênue, mas inquebrável (uma corda ou fio sutil).

### Como um TRAUMA é representado?
Não é um erro de sistema (nunca usar vermelho de erro técnico).
- **Materialidade**: Borda esquerda espessa em `terracotta` (`--material-terracotta`).
- **Composição**: Quebra sutil da simetria. Onde há trauma sistêmico, a grade perfeita cede lugar a um desalinhamento intencional de 1px ou 2px, sugerindo a fratura.

### Como uma ÁRVORE "respira"? (Genossociograma)
Não é um organograma de empresa.
- **Fundo**: `surface-archive` (pergaminho infinito).
- **Conexões**: Linhas que variam em espessura (fortes, rompidas, emaranhadas) dependendo do vínculo.
- **Ritmo**: O Genossociograma não pode parecer uma planilha gráfica. Ele deve parecer uma constelação. Respiro imenso ao redor do sistema familiar, dando a sensação de tempo e espaço.

### Como uma LINHA DO TEMPO se movimenta?
Não é um feed do Twitter ou um registro de atividades de CRM.
- **Eixo**: Um eixo vertical sólido em bronze (`--material-bronze`) — a espinha dorsal do tempo.
- **Eventos Históricos vs. Pessoais**: Eventos do macrossistema (ex: Guerra) ficam no fundo. Eventos do paciente em primeiro plano.
- **Sensação**: Descer a página é escavar o passado.

### Como a IA conversa?
A IA não é um chatbot da OpenAI. É um **segundo cérebro clínico** — um conselheiro ancião.
- **Visual**: Nunca em balões de chat de iMessage. Ela escreve em "fichas de insight".
- **Identidade**: O ícone não é o de um robô ou de faíscas ("sparkles"). É um marcador de livro, uma lente de aumento, ou a assinatura invisível (`GenealogicalMark`).

### Como um DOCUMENTO é arquivado?
- O ato de fechar um caso não é "Delete" ou "Done". É "Arquivar".
- **Visual**: O carimbo `StatusStamp` (ARQUIVO) desce com uma rotação leve (3 graus), e o card escurece levemente. Fica em repouso.

---

## 3. O Fim das Telas Genéricas

Cada rota da plataforma deve ter um propósito cognitivo único e uma personalidade inconfundível.

| Rota | O que o usuário sente | O protagonista visual |
|---|---|---|
| **Clientes** | Estou diante do meu arquivo clínico. | O Dossiê (pastas e carimbos). |
| **Biblioteca** | Estou num acervo de saberes seculares. | A Lombada do Livro (coleção). |
| **Agenda / Sessões** | Este é o pulso do meu dia. | A Linha do Dia (agora, passado, futuro). |
| **Centro Clínico (Home)** | Esta é minha mesa de trabalho. | O Fio Condutor (prioridade clínica). |
| **Genossociograma** | Estou mapeando a alma de uma família. | As Conexões (linhas e símbolos vitais). |

---

## 4. O Problema da Navegação Tripla

Atualmente o usuário é bombardeado por navegação em todos os lados (Sidebar + Topbar + Bottom Nav no desktop).

**A Regra da Navegação Silenciosa:**
1. **Desktop**: Sidebar minimalista (max 190px). Topbar **sem** marcação duplicada de logotipo, apenas o *Breadcrumb* estrutural (Instituto Liz → Clientes → Paciente X). ZERO bottom nav no desktop.
2. **Mobile**: Bottom nav permitida. Topbar focada apenas na ação.

---

## 5. O Teste de Personalidade (O que NÃO FAZER)

- Nunca usar ícones `Lucide` genéricos em estado default (Stroke 2, cor preta). Se for Lucide, que tenha stroke fino (1.5), cores semânticas (`bronze`, `gold`, `forest`) ou seja substituído por ícones proprietários de arquivo.
- Nunca usar `espaço branco` vazio apenas por usar. Se há muito vazio, ele deve ter propósito (silêncio sistêmico) ou ser ancorado por conectores narrativos.
- Nunca tratar um paciente como um "Card". Ele é um caso. Uma história.

---

## Conclusão: A Passagem para o Único

Elegância agrada. Memorabilidade marca.
O objetivo da Engenharia de Produto a partir deste Manifesto não é "fazer a tela bonita". É **traduzir a teoria sistêmica para a interface de usuário**. Quando o código, as cores e as formas operarem como extensões dos conceitos de Bert Hellinger e Anne Ancelin Schützenberger, o GeneaLiz terá alcançado seu objetivo.
