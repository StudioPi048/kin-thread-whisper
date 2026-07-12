# Filosofia de Produto GeneaLiz — Princípios de Arquitetura, Linguagem, Percepção e Comportamento Clínico

**Escopo:** Este documento define princípios permanentes de produto. Ele não substitui especificações técnicas, RFCs, documentação de arquitetura ou regras clínicas. Em caso de conflito, os princípios aqui definidos prevalecem sobre decisões de interface e implementação.

---

## Parte I: Imutável (A Constituição)

### Princípios Permanentes

1. **Princípio da Explicabilidade**
Nenhuma conclusão clínica apresentada pela plataforma pode existir sem que o terapeuta consiga compreender quais evidências levaram a ela. A confiança do terapeuta depende da transparência absoluta da IA, prioridades, hipóteses e alertas.

2. **Princípio da Não-Substituição**
A GeneaLiz amplia o raciocínio clínico do terapeuta; não o substitui. A plataforma organiza, relaciona, sugere e contextualiza dados, mas **nunca afirma**. 

3. **Princípio da Progressividade**
A plataforma revela conhecimento conforme o processo clínico amadurece (Contexto → Hipótese → Evidências → Exploração). O conhecimento não é revelado por efeito visual, mas por amadurecimento metodológico.

4. **Princípio da Reversibilidade**
Nenhuma hipótese é definitiva. Toda construção clínica, interpretação ou ligação sistêmica deve poder ser revisada e retornar ao estado anterior sem perda da rastreabilidade. A investigação clínica é viva.

5. **Princípio da Temporalidade**
Toda informação relevante deve possuir contexto temporal (quando surgiu, validada, modificada ou deixou de fazer sentido). A Psicogenealogia trabalha com tempo, e o software também deve fazê-lo para enriquecer o raciocínio clínico.

6. **Princípio da Sobriedade Clínica**
A plataforma nunca representa conceitos da Psicogenealogia por excesso de metáforas visuais. A teoria deve emergir da organização da informação, da linguagem e da interação. A estética apenas reforça essa percepção. Os princípios deste documento orientam decisões de produto; eles não exigem representação visual constante. A identidade nasce da consistência, não da repetição.

7. **Princípio da Proporcionalidade**
A intensidade da representação visual ou comportamental deve ser proporcional à relevância clínica da informação. Isso evita que um pequeno indício receba o mesmo destaque de uma hipótese fortemente corroborada.

### Governança do Produto (RFC)
Toda futura alteração arquitetural, visual ou semântica deve ser precedida de um *Request for Clinical Change* (RFC) que responda:
1. Qual princípio da Constituição ela reforça?
2. Ela viola algum princípio?
3. Ela aproxima ou afasta a plataforma da Psicogenealogia?
4. Como ela será validada?

### O que a GeneaLiz é
Um ambiente clínico que organiza evidências, apoia a formulação de hipóteses e acompanha a investigação transgeracional, preservando a autonomia do terapeuta em todas as decisões clínicas.

### O que a GeneaLiz NÃO é
A GeneaLiz **não** é:
- um CRM, ERP ou Dashboard Executivo.
- um Chatbot ou ferramenta de IA autônoma.
- um software de gestão financeira.
- uma timeline genérica ou um repositório de PDFs.

### Testes de Identidade
- **Teste da Fotografia:** Remova logotipo, cores e textos. Apenas pela estrutura e relações espaciais, deve ser óbvio que o software trata de investigação familiar, não de um CRM.
- **Teste da Filmagem:** Durante 30 segundos de uso sem áudio/texto, os movimentos e interações (expansões, hierarquia) devem revelar uma ferramenta que investiga relações humanas, e não que apenas cataloga dados.

---

## Parte II: Evolutivo (O Roadmap Clínico)

### Ciclo de Maturação Clínica (Fase 4)
(Anteriormente conhecido como Máquina de Estados)
A interação nasce do ciclo de vida da informação.
1. **Observada:** A IA ou terapeuta nota um padrão.
2. **Investigada:** Exploração ativa.
3. **Corroborada:** Ganha força e liga-se a membros da família.
4. **Contestada:** Descartada temporariamente, mas mantida no histórico.
5. **Arquivada:** Ciclo fechado.

### Matriz de Evidências (Contrato de Reatividade)
Toda manifestação reage a um estado verificável:

| Evidência | Estado Clínico | Manifestação Visual/Comportamental | Reversível |
| :--- | :--- | :--- | :--- |
| Síndrome de Aniversário | Observada | Marcador temporal | Sim |
| Hipótese Nova | Observada | Manuscrito | Sim |
| Hipótese Validada | Corroborada | Integração estrutural ao documento | Sim |
| Exclusão | Confirmada | Redução sensível de contraste | Sim |
| Lealdade | Investigada | Conexão visual (eixos) | Sim |

### Fases da Gramática Visual Segura (Iterativa - Fase 3.5)
1. **Fase 3.5A:** Infraestrutura sem efeitos (`ClinicalState` e `<ClinicalDocument>`). Validação pura de arquitetura.
2. **Fase 3.5B:** Um Único Conceito (Hipótese Clínica no Dossiê).
3. **Fase 3.5C:** Conceitos Relacionais (Lealdade, Repetição, Projeto Sentido).
4. **Fase 3.5D:** Conceitos Sensíveis e de Risco (Trauma, Exclusão, Segredo).
