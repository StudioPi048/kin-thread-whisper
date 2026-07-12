# Passo 2.6 — Sistema de Narrativa Visual

> Status: **APROVADO para execução**  
> Veredito que originou: 🟡 Refinamento  
> Objetivo: passar de **elegante** para **memorável**

---

## O Diagnóstico

A plataforma chegou a um ponto em que:
- A arquitetura está correta
- Os materiais estão definidos
- As superfícies transmitem profundidade

**O que ainda falta:** a tela não diz "Psicogenealogia" nos primeiros 3 segundos.

O motivo: não existe uma **assinatura visual genealógica**. Tudo é papel, verde, marfim, tipografia — elegante, mas sem especificidade. Um CRM premium poderia ter a mesma aparência.

---

## O que muda no Passo 2.6

Não são materiais novos. São **conectores narrativos** — elementos entre os blocos que costuram a história e imprimem identidade.

### A distinção:

| Sem Narrativa | Com Narrativa |
|---|---|
| Bloco → espaço → Bloco | Bloco → conector → Bloco |
| Organizado | Conectado |
| Dashboard | Mesa de trabalho |
| Elegante | Memorável |

---

## Entregáveis

### 1. `GenealogicalMark` — A Assinatura Invisível

Um SVG de ramificação genealógica extremamente discreto.  
Não é uma árvore literal. É uma abstração de 3-4 nós conectados por linhas finas.  
Sempre pequeno (≤ 32px), sempre baixa opacidade (0.08–0.18).

Usado como:
- Separador de seção na Home (entre blocos)
- Marca d'água subliminar no header da plataforma
- Ornamento no rodapé do DossierCard (futuro)

**Efeito:** o cérebro não lê "árvore". Lê "conexão", "ramificação", "linhagem".

```
     ●
    /|\
   ● ● ●
  /|   |
 ● ●   ●
```

### 2. `NarrativeConnector` — O Costurador de Seções

Substitui o espaço vazio entre blocos por um elemento que adiciona densidade sem peso.

Três variantes:
- **Quote** — citação curta em serif italic + autor, superfície `manuscript`
- **DateMark** — data histórica/coordenada/referência, em Eyebrow monospace
- **Divider** — linha fina com o `GenealogicalMark` centrado

### 3. Home redesenhada com ritmo editorial

**Ritmo atual:**
```
[bloco]
⬜⬜⬜⬜ (espaço vazio)
[bloco]
⬜⬜⬜⬜ (espaço vazio)
[bloco]
```

**Ritmo após 2.6:**
```
[bloco]
── ● ── citação curta ── ● ──
[bloco]
── ● ── data histórica ── ● ──
[bloco]
── ◈ ──────────────────── ◈ ──
[bloco]
```

### 4. Assinatura na sidebar

Um `GenealogicalMark` muito sutil abaixo do logo — sempre presente, nunca intrusivo.  
É o equivalente visual do watermark de um papel timbrado.

---

## Regras de Uso dos Conectores

| ✅ Usar | ❌ Nunca usar |
|---|---|
| Citações reais de Schützenberger, Hellinger, etc. | Citações inventadas |
| Datas com contexto genealógico ("1873 — Geração IV") | Datas aleatórias |
| `GenealogicalMark` em opacidade 0.08–0.18 | Mark em opacidade > 0.25 |
| 1 conector entre blocos grandes | 2 conectores seguidos |
| Serif italic apenas na citação | Italic em todo o conector |

---

## Critério de Aprovação do Passo 2.6

Teste do Screenshot aplicado à Home após a implementação.

A pergunta: *"Que tipo de software você acha que é?"*

A resposta esperada agora: **genealogia**, **linhagem**, **arquivo familiar** — não apenas "clínica".

Se ainda responder "plataforma clínica sofisticada", a assinatura não foi forte o suficiente.
