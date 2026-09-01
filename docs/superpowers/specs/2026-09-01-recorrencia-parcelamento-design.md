# Recorrência e Parcelamento de Lançamentos

**Data:** 2026-09-01
**Status:** Aprovado para planejamento de implementação

## 1. Contexto

Hoje não há como registrar uma conta que se repete. A tabela `lancamentos` tem
uma coluna `recorrencia text` desde a migração inicial (`0001_schema.sql`), mas
ela nunca foi usada: `app/lancamentos/actions.ts` grava `recorrencia: null` em
todo lançamento, e nenhuma tela lê ou escreve o campo. É uma coluna morta.

Na prática isso significa que a loja precisa digitar manualmente, uma por uma:
- a conta de energia todo mês;
- cada parcela de uma compra parcelada em 3x ou 4x com fornecedor.

Este documento especifica um sistema de séries de lançamentos que cobre os dois
casos.

## 2. Escopo

**Dentro do escopo:**
- Lançamento **parcelado**: N parcelas, com frequência semanal, quinzenal ou mensal.
- Lançamento **fixo mensal**: repete indefinidamente até ser encerrado.
- Valor do parcelado informado como total (dividido entre as parcelas) ou como
  valor de cada parcela.
- Editar e excluir com escolha de alcance: só este / este e os próximos / toda a série.
- Encerrar uma recorrência fixa.

**Fora do escopo:**
- Recorrência fixa semanal ou quinzenal. O caso real da loja é mensal (energia,
  aluguel, internet). O modelo de dados já comporta — `series_lancamentos` tem
  coluna `frequencia` — então habilitar depois é liberar a opção na tela, não
  redesenhar.
- Recorrência com data de término ("repete até dez/2027"). Encerrar manualmente cobre.
- Reajuste automático de valor (ex: IPCA anual).
- Geração por agendador no servidor (`pg_cron`). O reabastecimento roda quando a
  tela de Entradas e Saídas é aberta.

## 3. Decisões de design

Cada uma destas foi decidida explicitamente com o dono do sistema:

| Decisão | Escolha | Motivo |
|---|---|---|
| Como a conta fixa gera lançamentos | Cria 12 meses à frente e reabastece | Todo cálculo do sistema (saldos, DRE, metas, fluxo, dashboard) lê a tabela `lancamentos` direto. Ocorrências virtuais calculadas em tempo de exibição exigiriam alterar todos eles. |
| Valor do parcelado | O usuário escolhe: total ou por parcela | Ambos aparecem no dia a dia (nota fiscal traz o total; boleto traz a parcela). Um botão de duas opções elimina uma classe inteira de erro de digitação. |
| Alcance da edição | Diálogo "só este / próximos / todos" | Conta de luz muda de valor todo mês (edição pontual), mas aluguel reajustado muda para sempre (edição propagada). Só um dos dois modos não atende. |
| Lançamentos já pagos | Nunca são alterados por propagação | Mudar o valor de um lançamento já baixado altera retroativamente saldo de conta, DRE e conciliação — justamente os números que precisam bater com o extrato. |
| Pagamento na criação | Indisponível quando há repetição | "Já foi pago?" em um lançamento de 3 parcelas é ambíguo (pagou o total? a 1ª parcela?). A baixa é feita por parcela, no botão "Pagar" da tabela. |

## 4. Modelo de dados

### `series_lancamentos` (nova)

Guarda a **regra** da série. Ter a regra em uma linha própria — em vez de
replicada em cada lançamento gerado — é o que permite reabastecer uma conta fixa
mesmo que todos os lançamentos dela tenham sido apagados.

- `id` uuid pk
- `tipo_serie` enum `tipo_serie_lancamento`: `parcelada` | `fixa`
- `frequencia` enum `frequencia_serie`: `semanal` | `quinzenal` | `mensal`
- `data_inicio` date not null — vencimento da 1ª ocorrência
- `total_parcelas` int — preenchido em `parcelada`, null em `fixa`
- `ativa` boolean not null default true — `false` encerra o reabastecimento
- Campos-modelo, usados para gerar as próximas ocorrências de uma série fixa:
  `descricao`, `tipo` (`tipo_lancamento`), `categoria_id`, `cliente_id`,
  `fornecedor_id`, `valor`, `observacao`
- `created_at` timestamptz

**Invariantes** (check constraints):
- `parcelada` exige `total_parcelas >= 2`; `fixa` exige `total_parcelas is null`.
- `fixa` exige `frequencia = 'mensal'` enquanto semanal/quinzenal estiverem fora de escopo.

### `lancamentos` (alterações)

- `+ serie_id uuid references series_lancamentos(id) on delete set null`
  — `set null`, nunca `cascade`: apagar a regra de uma série não pode apagar
  histórico financeiro já baixado.
- `+ parcela_numero int` — 1..N na parcelada; ordinal crescente na fixa.
- `- recorrencia` — coluna morta, removida.
- Índice em `serie_id`.

### RLS

`series_lancamentos` recebe política no mesmo padrão das demais tabelas
(`0002_rls.sql`): acesso completo para qualquer usuário com perfil.

## 5. Regras de geração

### Avanço de data

- **semanal:** +7 dias
- **quinzenal:** +14 dias
- **mensal:** +1 mês, travado no último dia do mês de destino. Dia 31 em uma
  série mensal cai em 30/abr e 28/fev (29 em ano bissexto). A trava é aplicada
  sobre a `data_inicio` original, não sobre a data anterior gerada — senão uma
  série que começa em 31/jan viraria "sempre dia 28" a partir de fevereiro.

### Divisão do valor (parcelada)

Quando o usuário informa o **total**, o valor de cada parcela é
`round2(total / n)`, e a **última parcela** absorve a diferença de centavos:
R$ 1.000,00 em 3x → 333,33 + 333,33 + 333,34. Quando informa **por parcela**,
todas recebem o mesmo valor e o total é `valor * n`.

### Quantidade gerada

- **Parcelada:** todas as N parcelas são criadas na criação da série. Não reabastece.
- **Fixa:** ocorrências até `hoje + 12 meses`.

### Reabastecimento

Uma RPC idempotente, `reabastecer_series_fixas()`, garante que toda série com
`ativa = true` tenha ocorrências até `hoje + 12 meses`. Ser idempotente é o que
torna seguro chamá-la a cada abertura: ela cria apenas o que falta, e rodar duas
vezes seguidas não duplica nada.

O disparo é uma server action chamada por um efeito de montagem em
`LancamentosTable`, que revalida a página se algo tiver sido criado. Não é feito
dentro do carregamento do server component: renderizar uma página não deve
gravar no banco, e uma escrita ali colide com o cache do App Router.

A geração roda em RPC no Postgres — não em código de aplicação — porque criar 4
parcelas precisa ser atômico. Uma falha no meio deixaria um "4x" com 2 parcelas
gravadas, e o formulário reenviado criaria duplicatas. É o mesmo motivo pelo qual
`registrar_ajuste_saldo` e `vender_item_permuta` já são RPCs.

## 6. Interface

### Modal de lançamento

Bloco novo abaixo de Vencimento, com um select **Repetição**:

- **Não se repete** (padrão) — fluxo atual, inalterado.
- **Parcelado** — revela "Nº de parcelas" (min. 2) e "Frequência"
  (semanal / quinzenal / mensal, padrão mensal), e o seletor **total / por
  parcela** ao lado do campo Valor.
- **Fixo mensal** — não pede campos adicionais.

Prévia calculada no cliente, antes de salvar:
> *3 parcelas de R$ 400,00 — vencimentos 10/09, 10/10, 10/11*

**Vencimento passa a ser obrigatório** quando há repetição (hoje é opcional):
sem data base não há como calcular a série.

**O bloco "Já foi pago?" é ocultado** quando Repetição é diferente de "não se
repete". A baixa da 1ª parcela é feita logo em seguida, pelo botão "Pagar" da
linha na tabela.

### Tabela de Entradas e Saídas

- Parcela exibida como *"Notebook Dell (2/4)"*. O sufixo é **calculado na
  exibição** a partir de `parcela_numero` e `total_parcelas`, não gravado em
  `descricao` — assim editar o texto de uma parcela não quebra a numeração.
  Como `total_parcelas` mora na série, `app/lancamentos/page.tsx` passa a
  carregar também `listarSeries()`, junto das consultas que já faz em paralelo.
- Lançamento de série fixa recebe um selo de recorrente.

### Diálogo de alcance

Ao salvar a edição, ou ao excluir, um lançamento com `serie_id`, abre um diálogo
com três opções: **Só este** / **Este e os próximos** / **Toda a série**.

"Os próximos" é definido por `parcela_numero` maior que o do lançamento aberto —
não por data de vencimento. Como o vencimento de uma ocorrência isolada pode ter
sido editado à mão, a ordem da série é a única referência estável.

## 7. Edição e exclusão

### Campos que propagam

`descricao`, `categoria_id`, `cliente_id`, `fornecedor_id`, `valor`, `observacao`.

**`vencimento` nunca propaga.** Cada ocorrência tem a data dela; mudar a data de
uma parcela não deve arrastar as outras. `tipo` também não propaga — trocar
despesa por receita no meio de uma série é sinal de erro de digitação, não de
intenção.

### Proteção dos pagos

"Este e os próximos" e "Toda a série" alteram **apenas lançamentos sem nenhum
pagamento registrado**. Os já pagos ou parciais ficam intactos, e a operação é
concluída com aviso: *"2 lançamentos já pagos não foram alterados."*

### Propagação para a regra

Editar **"toda a série"** de uma conta fixa atualiza também os campos-modelo em
`series_lancamentos`. Sem isso, os próximos 12 meses continuariam nascendo com o
valor antigo.

### Exclusão encerra a recorrência

Excluir **"este e os próximos"** ou **"toda a série"** de uma série fixa marca
`ativa = false`. Sem isso, o reabastecimento recriaria na próxima abertura da
tela exatamente os lançamentos que acabaram de ser apagados.

As travas de exclusão que já existem em `excluirLancamentoAction` (item de
permuta já revendido) continuam valendo para cada lançamento da série.

## 8. Testes

A aritmética fica isolada em `lib/series.ts`, com funções puras testadas em
vitest, no padrão de `lib/calculations.test.ts`:

- `proximaData(dataInicio, frequencia, ordinal)` — inclui dia 31 caindo em
  fevereiro e em meses de 30 dias, e ano bissexto.
- `dividirValor(total, n)` — soma das parcelas igual ao total; centavos na última.
- `ocorrenciasFaltantes(existentes, regra, hoje)` — regra do reabastecimento:
  idempotência (rodar duas vezes não gera nada na segunda) e respeito ao
  horizonte de 12 meses.

Os testes de `lib/ltv.test.ts`, `lib/relatorios.test.ts` e `lib/metas-calc.test.ts`
montam objetos `LancamentoRow` completos à mão e precisam acompanhar a troca de
`recorrencia` por `serie_id` e `parcela_numero`.
