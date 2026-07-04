# Testes de renderização do Genossociograma

Suite Playwright (Python) que garante — em múltiplas resoluções — que:

1. **Layout por linhagem** — o cliente fica horizontalmente centralizado;
   o pai (e demais ramo paterno) fica à esquerda, a mãe (e ramo materno)
   fica à direita.
2. **Legibilidade dos rótulos** — todo nó de pessoa tem nome renderizado
   com altura e largura não-nulas (sem colapso, sem clipping).
3. **Adaptação ao viewport** — o canvas ocupa a área útil em 1080p e 4K,
   sem sumir/quebrar.

## Como rodar

Pré-requisitos:
- Dev server ativo em `http://localhost:8080` (o sandbox Lovable já garante).
- Sessão Supabase disponível via `LOVABLE_BROWSER_AUTH_STATUS=injected`
  (também garantido no sandbox quando o usuário está logado).

```bash
python3 tests/genogram/layout_regression.py
```

Argumentos opcionais:
- `--client-id <uuid>` — cliente alvo (default: cliente da rota atual dos prints).
- `--viewports 1080,4k` — quais resoluções testar (default: ambas).

## Saída

- Retorno 0 = todos os invariantes passaram; qualquer falha imprime a
  causa e retorna 1.
- Screenshots gravados em `tests/genogram/screenshots/<viewport>.png`
  para inspeção humana / regressão visual.
