# Sistema de Gestão Financeira — Loja de Informática

**Data:** 2026-08-04
**Status:** Aprovado para planejamento de implementação

## 1. Contexto

A loja vende peças e acessórios de informática em geral, monta/vende computadores, e presta assistência técnica para PCs e notebooks. Hoje existe um artefato HTML single-file (`sistema-financeiro-loja.html`) que serviu de ponto de partida: um controle de contas a pagar/receber com dashboard simples, guardando tudo em `localStorage` do navegador, sem backend real.

Este documento especifica a versão real do sistema: um web app com banco de dados na nuvem, multiacesso, pensado para servir de base financeira do negócio — e para futuramente se conectar ao Bling (ERP de vendas da loja) e a automações de aviso (Telegram/chat), sem precisar ser redesenhado quando essas integrações chegarem.

## 2. Escopo

**Dentro do escopo (v1):**
- Dashboard financeiro
- Entradas e saídas (contas a pagar/receber)
- Formas de pagamento com taxa/valor líquido
- Permutas com registro do item recebido
- Gestão de clientes e LTV
- Controle de dívidas (clientes e empréstimos/financiamentos da loja)
- Controle de fornecedores
- Gestão financeira geral (relatórios por categoria e por frente de negócio)
- Anexo de comprovantes de pagamento
- Múltiplas contas/caixas

**Fora do escopo (v1 — arquitetura deve permitir adicionar depois sem redesenho):**
- Integração com API do Bling
- Automações de aviso (notificações programadas)
- Bot/integração com Telegram ou outro chat
- Múltiplos papéis de usuário (Dono/Gerente/Viewer) — v1 usa usuário único com acesso completo; ver seção 7.
- Controle de estoque completo (quantidade, baixa automática) — v1 usa apenas um campo de custo opcional por lançamento, não um cadastro de produtos.

## 3. Arquitetura

- **Frontend:** Next.js (App Router), TypeScript, hospedado na Vercel.
- **Backend:** Supabase — Postgres (dados), Auth (login), Storage (comprovantes).
- **Permissões:** aplicadas via Row Level Security (RLS) no Postgres, não apenas na camada de aplicação. Em v1 as políticas liberam acesso completo a qualquer usuário autenticado da loja, mas já estruturadas por papel (ver seção 7) para que adicionar Gerente/Viewer no futuro seja uma questão de nova política, não de redesenho.
- **Extensões futuras:** Supabase Edge Functions cobrem os três itens fora de escopo:
  - Webhook do Bling → cria `lancamento` + `pagamento` automaticamente a cada venda.
  - Supabase Cron → checagens diárias (vencimentos, comprovante faltando) disparando notificação.
  - Webhook de bot Telegram → envia avisos e permite registrar lançamentos por mensagem.
  Nenhuma dessas integrações exige alterar o modelo de dados descrito abaixo — apenas escrevem/leem as mesmas tabelas.

## 4. Modelo de dados

### `contas_financeiras`
Contas/caixas da loja (ex: Caixa Loja, Banco PJ). Cada uma tem saldo próprio; o dashboard mostra saldo individual e consolidado.
- `id`, `nome`, `tipo` (caixa/banco/cartão), `saldo_inicial`, `ativo`, `created_at`

### `profiles`
Usuários da loja, vinculados ao `auth.users` do Supabase.
- `id` (= auth.users.id), `nome`, `papel` (enum: `dono` | `gerente` | `viewer` — em v1 todo usuário criado recebe `dono`), `created_at`

### `categorias`
Evolução da tabela de categorias do HTML de referência, com o campo novo de frente de negócio.
- `id`, `nome`, `grupo_dre`, `frente_negocio` (enum: `pecas_acessorios` | `computadores` | `assistencia_tecnica` | `outros` | null para categorias de despesa geral), `created_at`

### `clientes`
- `id`, `nome`, `contato`, `documento`, `classificacao` (enum: `padrao` | `vip` | `recorrente` | `inadimplente` — editável manualmente; `inadimplente` também pode ser sugerido automaticamente quando há dívida vencida), `observacao`, `created_at`
- Métricas de LTV, ticket médio e frequência de compra são **calculadas**, não armazenadas: agregadas a partir de `lancamentos`/`pagamentos` vinculados ao cliente.

### `equipamentos_cliente`
Histórico de aparelhos trazidos para assistência.
- `id`, `cliente_id`, `tipo` (notebook/desktop/outro), `marca_modelo`, `numero_serie`, `observacao`, `created_at`

### `fornecedores`
- `id`, `nome`, `contato`, `documento`, `tipo`, `observacao`, `created_at`

### `lancamentos`
Núcleo do sistema — equivalente às "contas" do HTML de referência, com os campos novos discutidos.
- `id`, `descricao`, `tipo` (`despesa` | `receita`), `categoria_id`, `cliente_id` (nullable), `fornecedor_id` (nullable), `conta_financeira_id`, `equipamento_id` (nullable, só para lançamentos de assistência técnica), `valor`, `custo` (nullable — CMV/custo opcional do lançamento, usado para calcular margem por frente de negócio), `vencimento`, `competencia`, `recorrencia`, `observacao`, `created_at`, `updated_at`

**Regra de dívidas (não é tabela nova):**
- "Dívida de cliente" = `lancamentos` com `tipo = 'receita'`, `cliente_id` preenchido e saldo em aberto.
- "Dívida da loja / empréstimo" = `lancamentos` com `tipo = 'despesa'` numa categoria com `grupo_dre = 'Empréstimos e Financiamentos'` (categoria dedicada, separada de fornecedores de mercadoria).
- "Fornecedor" = `lancamentos` com `tipo = 'despesa'` e `fornecedor_id` preenchido, categoria fora do grupo de empréstimos.

### `pagamentos`
Cada baixa (total ou parcial) de um lançamento.
- `id`, `lancamento_id`, `valor`, `taxa` (nullable, opcional), `valor_liquido` (calculado = `valor - taxa` quando `taxa` informada, senão = `valor`), `forma_pagamento` (enum: pix/dinheiro/boleto/transferencia/cartao_credito/cartao_debito/permuta), `data_pagamento`, `comprovante_url` (nullable, arquivo no Supabase Storage), `observacao`, `created_at`

### `itens_permuta`
Quando `pagamentos.forma_pagamento = 'permuta'`.
- `id`, `pagamento_id`, `descricao`, `valor_estimado`, `status` (enum: `em_estoque` | `revendido` | `usado_em_conserto` | `descartado`), `observacao`, `created_at`

## 5. Módulos e funcionalidades

### 5.1 Dashboard
Tela inicial, foco #1 do sistema. Combina:
- KPIs: saldo consolidado + saldo por conta/caixa, total atrasado, total a vencer em 7 dias, receita do mês.
- Gráfico de fluxo de caixa (entradas x saídas), com quebra semanal.
- Comparativo de receita/margem por frente de negócio (Peças/Acessórios, Computadores, Assistência Técnica).
- Bloco de alertas ("precisa de atenção"): contas vencidas, clientes inadimplentes, lançamentos de valor alto sem comprovante.

### 5.2 Entradas e saídas
Lista de lançamentos com os mesmos filtros do HTML de referência (status, mês, categoria, busca), acrescida de frente de negócio e custo/CMV opcional por lançamento. Modal de novo/editar lançamento e modal de registrar pagamento, seguindo o mesmo padrão de UX do artefato original.

### 5.3 Formas de pagamento
No momento de registrar um pagamento: forma de pagamento, valor pago, campo opcional de taxa. Quando a taxa é informada, o sistema calcula e exibe o valor líquido automaticamente; quando não é, valor líquido = valor pago.

### 5.4 Permutas
Ao selecionar forma de pagamento "permuta", abre formulário do item recebido (descrição, valor estimado, status). Tela própria listando todos os itens de permuta e seu status atual.

### 5.5 Clientes e LTV
Cadastro de cliente com histórico de lançamentos vinculados, LTV total, ticket médio, frequência de compra (todos calculados), equipamentos do cliente (histórico de assistência técnica por aparelho), e classificação editável.

### 5.6 Dívidas
Duas visões sobre `lancamentos` (não telas com dados próprios):
- **Clientes devendo:** receitas em aberto por cliente, com vencimento.
- **Dívidas da loja:** despesas em aberto na categoria de empréstimos/financiamentos.

### 5.7 Fornecedores
Equivalente ao bloco "Fornecedores e credores" do HTML de referência: saldo em aberto por fornecedor, histórico, próximo vencimento.

### 5.8 Gestão financeira geral
Relatório por categoria (como no HTML de referência) e relatório por frente de negócio, cada um mostrando total, pago, em aberto, vencido e — no caso de frente de negócio — margem (receita − custo, quando informado).

### 5.9 Comprovantes
Upload de foto/PDF por pagamento, armazenado no Supabase Storage e vinculado ao registro. Indicador visual no dashboard e na lista de lançamentos quando falta comprovante em pagamento acima de um valor configurável.

### 5.10 Contas/caixas
Cadastro de contas financeiras, extrato e saldo por conta, saldo consolidado no dashboard.

## 6. Identidade visual

Direção escolhida: **dark, técnica, alto contraste** — fundo escuro, cards em cinza-azulado, cores de destaque vibrantes (verde para positivo/pago, vermelho para atrasado/negativo) sobre uma base neutra. Clean e moderno, sem excesso de cor — a paleta se concentra nos KPIs e alertas, o resto da interface permanece neutra para não competir por atenção.

## 7. Permissões

**v1:** usuário único — qualquer conta autenticada da loja tem acesso completo (ler e escrever em todos os módulos). Simplificação deliberada para não construir uma camada de permissões antes de saber se é necessária no dia a dia.

**Extensibilidade prevista:** a coluna `profiles.papel` já existe desde o v1 com os valores `dono`/`gerente`/`viewer` (todo usuário criado em v1 recebe `dono`). As políticas de RLS são escritas parametrizadas por papel desde o início. Se no futuro for necessário diferenciar acesso, o trabalho é: (a) atribuir `gerente`/`viewer` aos usuários certos, (b) ajustar as políticas RLS existentes — sem alterar schema nem lógica de aplicação.

## 8. Fora de escopo — notas para quando chegar a hora

- **Bling:** Edge Function recebendo webhook de venda do Bling, criando `lancamento` (tipo receita) + `pagamento` correspondente.
- **Automações de aviso:** Supabase Cron rodando checagem diária sobre `lancamentos` vencidos/vencendo e `pagamentos` sem comprovante, disparando notificação (canal a definir quando for implementado).
- **Telegram/chat:** Edge Function como webhook do bot, reaproveitando as mesmas rotinas de criação de lançamento usadas pelo Bling e pela automação de avisos.

## 9. Fora de escopo — explicitamente não incluído

- Controle de estoque com quantidade e baixa automática (produtos, SKUs). O sistema é financeiro, não um ERP — se isso for necessário, é candidato a ficar por conta do Bling e ser integrado via webhook (seção 8), não reconstruído aqui.
- Múltiplos papéis de usuário ativos (ver seção 7 — estrutura pronta, não ativada em v1).
