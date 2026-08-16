# Correção dos Bugs Encontrados na Análise — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os 5 problemas encontrados na análise do sistema financeiro (`sistema-financeiro-loja`): vínculo de cliente/fornecedor nunca gravado, exclusão de lançamento que pode corromper permuta já revendida, papel de usuário decorativo no RLS, gravação não-atômica de pagamento em permuta, e um bug de duplicidade em código morto do dashboard.

**Architecture:** Cada tarefa é independente e termina em um commit próprio. Tarefas 1, 2 e 5 são só TypeScript/React (camada `app/` e `lib/queries/`). Tarefas 3 e 4 adicionam migrações SQL novas (`supabase/migrations/0009_*.sql`, `0010_*.sql`) seguindo a numeração sequencial já usada no projeto, mais o código TS que passa a chamar a nova função/policy.

**Tech Stack:** Next.js 15 (App Router, server actions), Supabase (Postgres + RLS + RPC via `supabase-js`), TypeScript, Vitest.

**Nota sobre testes:** este repositório só tem testes automatizados (Vitest) para funções puras em `lib/*.ts` (`calculations`, `metas-calc`, `ltv`, `relatorios-calc`). Código que depende do Supabase (queries, server actions, componentes) não tem testes automatizados hoje — nenhuma tarefa deste plano introduz esse padrão, para não divergir do resto do código. Cada tarefa usa `npx tsc --noEmit`, `npm run lint` e `npm run test` (suíte existente, para garantir que nada quebrou) como rede de segurança, com verificação manual no navegador quando a mudança é visível na UI.

**Sobre aplicar as migrações SQL (Tarefas 3 e 4):** este ambiente não tem acesso configurado ao projeto Supabase de produção deste app (nem `.env.local`, nem projeto conectado no MCP). As migrações ficam prontas em `supabase/migrations/`, mas **não serão aplicadas ao banco automaticamente** — isso exige confirmação explícita do usuário e uma forma de executar SQL no projeto certo (CLI `supabase db push`, SQL editor do painel Supabase, ou conectar o projeto ao MCP do Supabase nesta sessão).

---

### Task 1: Vincular cliente/fornecedor ao lançamento (Crítico)

**Problema:** `salvarLancamentoAction` grava `cliente_id`, `fornecedor_id` e `equipamento_id` sempre como `null`, e não existe campo no formulário para escolher cliente/fornecedor. Isso deixa `/dividas` (clientes devendo), `/clientes/[id]` (histórico e LTV) e `/fornecedores/[id]` (histórico e próximo vencimento) sempre vazios.

**Escopo desta tarefa:** adicionar seleção de cliente e fornecedor (ambos opcionais) ao formulário de lançamento. `equipamento_id` fica de fora — não há UI de equipamentos vinculada a este fluxo, e criar essa UI é um escopo maior, não coberto pelos achados da análise.

**Files:**
- Modify: `app/lancamentos/page.tsx`
- Modify: `app/lancamentos/LancamentosTable.tsx`
- Modify: `app/lancamentos/LancamentoModal.tsx`
- Modify: `app/lancamentos/actions.ts`

- [ ] **Step 1: Buscar clientes e fornecedores na página e repassar para a tabela**

Em `app/lancamentos/page.tsx`, substitua o conteúdo inteiro por:

```tsx
import { listarLancamentos } from "@/lib/queries/lancamentos";
import { listarPagamentos } from "@/lib/queries/pagamentos";
import { listarCategorias } from "@/lib/queries/categorias";
import { listarClientes } from "@/lib/queries/clientes";
import { listarFornecedores } from "@/lib/queries/fornecedores";
import { LancamentosTable } from "./LancamentosTable";

export default async function LancamentosPage() {
  const [lancamentos, pagamentos, categorias, clientes, fornecedores] = await Promise.all([
    listarLancamentos(),
    listarPagamentos(),
    listarCategorias(),
    listarClientes(),
    listarFornecedores(),
  ]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Entradas e Saídas</h1>
      <LancamentosTable
        lancamentos={lancamentos}
        pagamentos={pagamentos}
        categorias={categorias}
        clientes={clientes}
        fornecedores={fornecedores}
      />
    </div>
  );
}
```

- [ ] **Step 2: Repassar clientes/fornecedores da tabela para o modal**

Em `app/lancamentos/LancamentosTable.tsx`, ajuste o import de tipos (linha 8) de:

```tsx
import type { LancamentoRow, PagamentoRow, Categoria } from "@/lib/types";
```

para:

```tsx
import type { LancamentoRow, PagamentoRow, Categoria, Cliente, Fornecedor } from "@/lib/types";
```

Ajuste a assinatura do componente (linhas 109-117) de:

```tsx
export function LancamentosTable({
  lancamentos,
  pagamentos,
  categorias,
}: {
  lancamentos: LancamentoRow[];
  pagamentos: PagamentoRow[];
  categorias: Categoria[];
}) {
```

para:

```tsx
export function LancamentosTable({
  lancamentos,
  pagamentos,
  categorias,
  clientes,
  fornecedores,
}: {
  lancamentos: LancamentoRow[];
  pagamentos: PagamentoRow[];
  categorias: Categoria[];
  clientes: Cliente[];
  fornecedores: Fornecedor[];
}) {
```

E o uso do `<LancamentoModal>` (linhas 317-322) de:

```tsx
      <LancamentoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        lancamento={editando}
        categorias={categorias}
      />
```

para:

```tsx
      <LancamentoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        lancamento={editando}
        categorias={categorias}
        clientes={clientes}
        fornecedores={fornecedores}
      />
```

- [ ] **Step 3: Adicionar os campos Cliente e Fornecedor no formulário**

Em `app/lancamentos/LancamentoModal.tsx`, ajuste o import de tipos (linha 12) de:

```tsx
import type { Categoria, LancamentoRow } from "@/lib/types";
```

para:

```tsx
import type { Categoria, Cliente, Fornecedor, LancamentoRow } from "@/lib/types";
```

Ajuste a assinatura do componente (linhas 14-24) de:

```tsx
export function LancamentoModal({
  open,
  onClose,
  lancamento,
  categorias,
}: {
  open: boolean;
  onClose: () => void;
  lancamento: LancamentoRow | null;
  categorias: Categoria[];
}) {
```

para:

```tsx
export function LancamentoModal({
  open,
  onClose,
  lancamento,
  categorias,
  clientes,
  fornecedores,
}: {
  open: boolean;
  onClose: () => void;
  lancamento: LancamentoRow | null;
  categorias: Categoria[];
  clientes: Cliente[];
  fornecedores: Fornecedor[];
}) {
```

Logo após o bloco do select de "Categoria" (linhas 82-96, que termina em `</div>`), insira um novo bloco antes do bloco de "Vencimento":

```tsx
        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Cliente (opcional)</label>
          <select
            name="cliente_id"
            defaultValue={lancamento?.cliente_id ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            <option value="">Nenhum</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Fornecedor (opcional)</label>
          <select
            name="fornecedor_id"
            defaultValue={lancamento?.fornecedor_id ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            <option value="">Nenhum</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>
```

(O grid é `grid-cols-2`, então os dois novos campos formam sua própria linha, sem quebrar o layout existente.)

- [ ] **Step 4: Ler os campos no server action**

Em `app/lancamentos/actions.ts`, dentro de `salvarLancamentoAction`, altere o objeto `input` (linhas 41-55) de:

```ts
  const input = {
    descricao: formData.get("descricao") as string,
    tipo: formData.get("tipo") as "despesa" | "receita",
    categoria_id: (formData.get("categoria_id") as string) || null,
    cliente_id: null,
    fornecedor_id: null,
    conta_financeira_id: (formData.get("conta_financeira_id") as string) || null,
    equipamento_id: null,
    valor: Number(formData.get("valor")),
    custo: formData.get("custo") ? Number(formData.get("custo")) : null,
    vencimento: (formData.get("vencimento") as string) || null,
    competencia: (formData.get("vencimento") as string)?.slice(0, 7) || null,
    recorrencia: null,
    observacao: (formData.get("observacao") as string) || null,
  };
```

para:

```ts
  const input = {
    descricao: formData.get("descricao") as string,
    tipo: formData.get("tipo") as "despesa" | "receita",
    categoria_id: (formData.get("categoria_id") as string) || null,
    cliente_id: (formData.get("cliente_id") as string) || null,
    fornecedor_id: (formData.get("fornecedor_id") as string) || null,
    conta_financeira_id: (formData.get("conta_financeira_id") as string) || null,
    equipamento_id: null,
    valor: Number(formData.get("valor")),
    custo: formData.get("custo") ? Number(formData.get("custo")) : null,
    vencimento: (formData.get("vencimento") as string) || null,
    competencia: (formData.get("vencimento") as string)?.slice(0, 7) || null,
    recorrencia: null,
    observacao: (formData.get("observacao") as string) || null,
  };
```

- [ ] **Step 5: Checar tipos e lint**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 6: Verificação manual no navegador**

Suba o dev server (`npm run dev` via preview), abra `/lancamentos`, clique em "+ Novo lançamento", confirme que os selects "Cliente" e "Fornecedor" aparecem, escolha um cliente, salve, edite o mesmo lançamento de novo e confirme que o cliente escolhido continua selecionado. Depois abra `/clientes/[id]` desse cliente e confirme que o lançamento aparece em "Histórico" e que LTV/ticket médio deixaram de ser zero.

- [ ] **Step 7: Commit**

```bash
git add app/lancamentos/page.tsx app/lancamentos/LancamentosTable.tsx app/lancamentos/LancamentoModal.tsx app/lancamentos/actions.ts
git commit -m "fix: vincula cliente e fornecedor ao lançamento no formulário"
```

---

### Task 2: Bloquear exclusão de lançamento que já gerou item de permuta revendido (Alto)

**Problema:** `excluirLancamentoAction` só reverte itens de permuta em que o lançamento é o **destino** da venda (`lancamento_venda_id`), mas não checa se algum `pagamento` **deste** lançamento gerou um `itens_permuta` que já foi revendido. Como `pagamentos.lancamento_id` tem `on delete cascade` e `itens_permuta.pagamento_id` também, excluir o lançamento apaga o item de permuta e o cascade destrói o registro de origem da venda já feita — corrompendo o lucro/relatório daquela venda. `estornarPagamentoAction` já tem essa trava; falta espelhar no nível de lançamento.

**Files:**
- Modify: `lib/queries/itensPermuta.ts`
- Modify: `app/lancamentos/actions.ts`

- [ ] **Step 1: Adicionar consulta de itens de permuta originados pelos pagamentos de um lançamento**

Em `lib/queries/itensPermuta.ts`, adicione esta função (após `buscarItemPermutaPorPagamento`, antes de `criarItemPermuta`):

```ts
// Pega os itens de permuta que nasceram de algum pagamento DESTE lançamento
// (não confundir com reverterItemPermutaPorLancamento, que trata o caso
// inverso: este lançamento sendo a venda de um item de OUTRA origem).
export async function buscarItensPermutaPorLancamentoOrigem(lancamentoId: string) {
  const supabase = await createClient();
  const { data: pagamentos, error: pagamentosError } = await supabase
    .from("pagamentos")
    .select("id")
    .eq("lancamento_id", lancamentoId);
  if (pagamentosError) throw pagamentosError;
  if (!pagamentos || pagamentos.length === 0) return [];

  const { data, error } = await supabase
    .from("itens_permuta")
    .select("*")
    .in(
      "pagamento_id",
      pagamentos.map((p) => p.id)
    );
  if (error) throw error;
  return data as ItemPermuta[];
}
```

- [ ] **Step 2: Bloquear a exclusão no server action**

Em `app/lancamentos/actions.ts`, ajuste o import (linha 10) de:

```ts
import { reverterItemPermutaPorLancamento } from "@/lib/queries/itensPermuta";
```

para:

```ts
import {
  reverterItemPermutaPorLancamento,
  buscarItensPermutaPorLancamentoOrigem,
} from "@/lib/queries/itensPermuta";
```

E troque `excluirLancamentoAction` (linhas 85-93) de:

```ts
export async function excluirLancamentoAction(id: string) {
  // Se este lançamento veio de uma venda de permuta, devolve o item pro
  // estoque antes de apagar - senão ele fica preso em "vendido" pra sempre,
  // sem lançamento nenhum por trás.
  await reverterItemPermutaPorLancamento(id);
  await excluirLancamento(id);
  revalidatePath("/permutas");
  revalidarPaginasFinanceiras();
}
```

para:

```ts
export async function excluirLancamentoAction(id: string) {
  // Se algum pagamento deste lançamento gerou um item de permuta que já foi
  // revendido (ou baixado), apagar o lançamento apagaria o item em cascata
  // e deixaria a venda dele órfã, sem nenhum item por trás. Mesma trava que
  // estornarPagamentoAction já tem no nível de pagamento.
  const itensDeOrigem = await buscarItensPermutaPorLancamentoOrigem(id);
  const itemJaMovimentado = itensDeOrigem.find((item) => item.status !== "em_estoque");
  if (itemJaMovimentado) {
    throw new Error(
      "Este lançamento gerou um item de permuta que já foi vendido (ou baixado). Reverta isso antes de excluir o lançamento."
    );
  }

  // Se este lançamento veio de uma venda de permuta, devolve o item pro
  // estoque antes de apagar - senão ele fica preso em "vendido" pra sempre,
  // sem lançamento nenhum por trás.
  await reverterItemPermutaPorLancamento(id);
  await excluirLancamento(id);
  revalidatePath("/permutas");
  revalidarPaginasFinanceiras();
}
```

- [ ] **Step 3: Checar tipos e lint**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 4: Verificação manual no navegador**

Fluxo: crie um lançamento com pagamento em permuta (marcando "Uma parte foi recebida em permuta?"), confirme o item em `/permutas`, venda esse item pela tela de permutas, depois volte no lançamento original e tente "Excluir lançamento" — deve aparecer o erro bloqueando a exclusão. Crie um segundo lançamento com permuta sem vender o item, e confirme que excluir esse ainda funciona normalmente (item volta pro estoque/some).

- [ ] **Step 5: Commit**

```bash
git add lib/queries/itensPermuta.ts app/lancamentos/actions.ts
git commit -m "fix: bloqueia exclusão de lançamento cujo item de permuta já foi revendido"
```

---

### Task 3: Aplicar o papel do usuário (dono/gerente/viewer) nas políticas de RLS (Médio)

**Problema:** a coluna `profiles.papel` (`dono`/`gerente`/`viewer`) existe mas nenhuma política de RLS a usa — toda policy é `for all` liberando qualquer perfil autenticado a ler/criar/editar/apagar. Um "viewer" tem, na prática, os mesmos poderes de um "dono".

**Escopo:** leitura continua liberada para qualquer perfil autenticado; inclusão/atualização/exclusão passam a exigir `papel in ('dono', 'gerente')`. A tabela `profiles` mantém sua policy própria (cada usuário só mexe no próprio perfil) — não faz parte deste loop.

**Files:**
- Create: `supabase/migrations/0009_rls_papel.sql`

- [ ] **Step 1: Escrever a migração**

Crie `supabase/migrations/0009_rls_papel.sql`:

```sql
-- Até aqui, toda policy usava "for all" liberando qualquer perfil
-- autenticado (dono/gerente/viewer) a ler E escrever. Isso torna a coluna
-- profiles.papel decorativa. Separa leitura (qualquer perfil) de escrita
-- (só dono/gerente) nas tabelas de dados - profiles fica de fora, ela já
-- tem sua própria policy de "só o próprio perfil".
do $$
declare
  t text;
begin
  foreach t in array array[
    'contas_financeiras',
    'categorias',
    'clientes',
    'equipamentos_cliente',
    'fornecedores',
    'lancamentos',
    'pagamentos',
    'itens_permuta'
  ]
  loop
    execute format('drop policy if exists %I on %I', t || ': acesso completo para usuário com perfil', t);

    execute format('drop policy if exists %I on %I', t || ': leitura para qualquer perfil', t);
    execute format(
      'create policy %I on %I for select using (exists (select 1 from profiles where id = auth.uid()))',
      t || ': leitura para qualquer perfil', t
    );

    execute format('drop policy if exists %I on %I', t || ': inclusão para dono ou gerente', t);
    execute format(
      'create policy %I on %I for insert with check (exists (select 1 from profiles where id = auth.uid() and papel in (''dono'',''gerente'')))',
      t || ': inclusão para dono ou gerente', t
    );

    execute format('drop policy if exists %I on %I', t || ': atualização para dono ou gerente', t);
    execute format(
      'create policy %I on %I for update using (exists (select 1 from profiles where id = auth.uid() and papel in (''dono'',''gerente''))) with check (exists (select 1 from profiles where id = auth.uid() and papel in (''dono'',''gerente'')))',
      t || ': atualização para dono ou gerente', t
    );

    execute format('drop policy if exists %I on %I', t || ': exclusão para dono ou gerente', t);
    execute format(
      'create policy %I on %I for delete using (exists (select 1 from profiles where id = auth.uid() and papel in (''dono'',''gerente'')))',
      t || ': exclusão para dono ou gerente', t
    );
  end loop;
end $$;
```

- [ ] **Step 2: Revisão estática**

Leia o arquivo de volta e confirme que os 8 nomes de tabela batem exatamente com os `create table` de `supabase/migrations/0001_schema.sql` (sem `profiles`).

- [ ] **Step 3: Aplicar a migração — PARE E PERGUNTE AO USUÁRIO ANTES**

Esta migração muda regras de segurança em produção. Não execute contra o banco sem confirmação explícita do usuário. Opções, na ordem de preferência:
1. Usuário conecta o projeto Supabase correto ao MCP nesta sessão, e então `apply_migration` é chamado com o conteúdo acima.
2. Usuário roda `supabase db push` localmente (com o projeto certo linkado via `supabase link`).
3. Usuário cola o SQL no SQL Editor do painel do Supabase.

Depois de aplicada, use a tool `get_advisors` (tipo `security`) no projeto certo para confirmar que não sobrou nenhuma tabela sem RLS adequado.

- [ ] **Step 4: Commit (o arquivo de migração, independente de já ter sido aplicado ou não)**

```bash
git add supabase/migrations/0009_rls_papel.sql
git commit -m "feat: restringe escrita a perfis dono/gerente via RLS"
```

---

### Task 4: Tornar atômico o registro de pagamento em permuta (Médio)

**Problema:** `registrarPagamentoComPermuta` (`app/lancamentos/permutaPagamento.ts`) roda o insert do pagamento em permuta e o insert do item de permuta como duas chamadas separadas dentro de um `Promise.all`. Se a segunda falhar depois da primeira ter sucesso, sobra um `pagamento` do tipo "permuta" contabilizado no saldo sem nenhum `itens_permuta` por trás — invisível em `/permutas` e sem forma de corrigir pela UI. O próprio código já reconhece isso como dívida técnica de v1.

**Solução:** mover a lógica para uma função Postgres (`registrar_pagamento_com_permuta`), no mesmo padrão de `vender_item_permuta` (`0008_vender_item_permuta_rpc.sql`), e trocar o código TS para chamá-la via `supabase.rpc(...)`.

**Files:**
- Create: `supabase/migrations/0010_registrar_pagamento_permuta_rpc.sql`
- Modify: `lib/queries/pagamentos.ts`
- Modify: `app/lancamentos/permutaPagamento.ts`
- Modify: `lib/queries/itensPermuta.ts`

- [ ] **Step 1: Escrever a função Postgres**

Crie `supabase/migrations/0010_registrar_pagamento_permuta_rpc.sql`:

```sql
-- Agrupa o registro de pagamento (parte em dinheiro/outro + parte em
-- permuta) numa única transação. Antes disso, os dois inserts rodavam em
-- paralelo no lado do app (app/lancamentos/permutaPagamento.ts) - se o
-- segundo falhasse depois do primeiro ter sucesso, sobrava um pagamento
-- "permuta" contado no saldo sem item de permuta nenhum por trás.
create or replace function registrar_pagamento_com_permuta(
  p_lancamento_id uuid,
  p_data_pagamento date,
  p_valor_caixa numeric,
  p_taxa numeric,
  p_forma_pagamento forma_pagamento,
  p_comprovante_url text,
  p_permuta_descricao text,
  p_valor_permuta numeric
) returns void
language plpgsql
as $$
declare
  v_pagamento_permuta_id uuid;
begin
  if p_valor_caixa > 0.004 then
    insert into pagamentos (lancamento_id, valor, taxa, forma_pagamento, data_pagamento, comprovante_url)
    values (p_lancamento_id, p_valor_caixa, p_taxa, p_forma_pagamento, p_data_pagamento, p_comprovante_url);
  end if;

  if p_valor_permuta > 0.004 and coalesce(p_permuta_descricao, '') <> '' then
    insert into pagamentos (lancamento_id, valor, forma_pagamento, data_pagamento, comprovante_url)
    values (
      p_lancamento_id,
      p_valor_permuta,
      'permuta',
      p_data_pagamento,
      case when p_valor_caixa > 0.004 then null else p_comprovante_url end
    )
    returning id into v_pagamento_permuta_id;

    insert into itens_permuta (pagamento_id, descricao, valor_estimado, status)
    values (v_pagamento_permuta_id, p_permuta_descricao, p_valor_permuta, 'em_estoque');
  end if;
end;
$$;
```

- [ ] **Step 2: Adicionar o wrapper TS que chama a RPC**

Em `lib/queries/pagamentos.ts`, adicione esta função no final do arquivo:

```ts
// Chama registrar_pagamento_com_permuta (supabase/migrations/0010), que
// grava o pagamento em caixa e/ou em permuta + o item de permuta numa
// única transação no banco - evita deixar um pagamento "permuta" sem item
// de estoque correspondente caso um dos dois inserts falhe.
export async function registrarPagamentoComPermutaTransacional(input: {
  lancamento_id: string;
  data_pagamento: string;
  valor_caixa: number;
  taxa: number | null;
  forma_pagamento: string | null;
  comprovante_url: string | null;
  permuta_descricao: string;
  valor_permuta: number;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_pagamento_com_permuta", {
    p_lancamento_id: input.lancamento_id,
    p_data_pagamento: input.data_pagamento,
    p_valor_caixa: input.valor_caixa,
    p_taxa: input.taxa,
    p_forma_pagamento: input.forma_pagamento,
    p_comprovante_url: input.comprovante_url,
    p_permuta_descricao: input.permuta_descricao,
    p_valor_permuta: input.valor_permuta,
  });
  if (error) throw error;
}
```

- [ ] **Step 3: Reescrever `registrarPagamentoComPermuta` para chamar a RPC**

Substitua o conteúdo inteiro de `app/lancamentos/permutaPagamento.ts` por:

```ts
import { registrarPagamentoComPermutaTransacional } from "@/lib/queries/pagamentos";
import { round2 } from "@/lib/calculations";

// Um pagamento pode ser parte em dinheiro/cartão, parte em permuta - os dois
// valores SOMAM (não um desconta do outro). A gravação em si (pagamento(s) +
// item de permuta) é atômica, feita pela função Postgres
// registrar_pagamento_com_permuta (supabase/migrations/0010). Compartilhado
// entre o fluxo de criação (actions.ts) e o de pagamento avulso
// (pagamentoActions.ts) para não deixar as duas cópias divergirem.
export async function registrarPagamentoComPermuta(input: {
  lancamentoId: string;
  dataPagamento: string;
  valorCaixa: number;
  taxa: number | null;
  formaPagamento: string | null;
  comprovanteUrl: string | null;
  permutaDescricao: string;
  valorPermuta: number;
}) {
  const valorCaixa = round2(input.valorCaixa);
  const valorPermuta = input.permutaDescricao ? round2(input.valorPermuta) : 0;

  if (valorCaixa <= 0.004 && valorPermuta <= 0.004) {
    throw new Error("Informe um valor pago (em dinheiro/outro e/ou em permuta) maior que zero.");
  }

  await registrarPagamentoComPermutaTransacional({
    lancamento_id: input.lancamentoId,
    data_pagamento: input.dataPagamento,
    valor_caixa: valorCaixa,
    taxa: input.taxa,
    forma_pagamento: input.formaPagamento,
    comprovante_url: input.comprovanteUrl,
    permuta_descricao: input.permutaDescricao,
    valor_permuta: valorPermuta,
  });

  return { criouPermuta: valorPermuta > 0.004 && !!input.permutaDescricao };
}
```

- [ ] **Step 4: Remover código morto deixado pela troca**

`registrarPagamento` (em `lib/queries/pagamentos.ts`) e `criarItemPermuta` (em `lib/queries/itensPermuta.ts`) só eram usados dentro do `permutaPagamento.ts` antigo. Depois do Step 3, nada mais os chama — confirme com:

Run: `grep -rn "registrarPagamento\b" --include="*.ts" --include="*.tsx" . | grep -v node_modules`
Expected: só a definição em `lib/queries/pagamentos.ts`, nenhum outro call site.

Run: `grep -rn "criarItemPermuta\b" --include="*.ts" --include="*.tsx" . | grep -v node_modules`
Expected: só a definição em `lib/queries/itensPermuta.ts`, nenhum outro call site.

Se os dois greps confirmarem isso, remova as duas funções (`registrarPagamento` de `lib/queries/pagamentos.ts` linhas 15-27, `criarItemPermuta` de `lib/queries/itensPermuta.ts` linhas 37-46).

- [ ] **Step 5: Checar tipos e lint**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 6: Aplicar a migração — PARE E PERGUNTE AO USUÁRIO ANTES**

Mesma ressalva da Tarefa 3: sem a função `registrar_pagamento_com_permuta` existir no banco, todo pagamento (inclusive sem permuta) vai falhar, porque o código novo sempre chama a RPC. Não faça deploy do código desta tarefa antes de confirmar que a migração `0010` foi aplicada no projeto de produção certo.

- [ ] **Step 7: Verificação manual no navegador (depois da migração aplicada)**

Registre um pagamento só em dinheiro (sem permuta) num lançamento existente, confirme que aparece normalmente. Registre outro pagamento com parte em permuta, confirme que o item aparece em `/permutas` e que o total pago soma dinheiro + permuta como antes.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0010_registrar_pagamento_permuta_rpc.sql lib/queries/pagamentos.ts lib/queries/itensPermuta.ts app/lancamentos/permutaPagamento.ts
git commit -m "fix: torna atômico o registro de pagamento em dinheiro + permuta via RPC"
```

---

### Task 5: Remover cálculo morto e com bug de duplicidade em `dashboard.ts` (Baixo)

**Problema:** `receitaPeriodo` (`lib/queries/dashboard.ts:77-79`) soma `totalPago()` de **todos** os pagamentos, sem excluir `forma_pagamento === "permuta"` — diferente de todo o resto da mesma função (`totalEntradasPeriodo`, `saldoPorConta`, `fluxoDiario`), que exclui permuta explicitamente. Hoje não tem efeito porque nenhuma página usa `receitaPeriodo` (confirmado por grep). Como é código morto com um bug latente, a correção é remover — se um dia precisar de novo, refazer usando o mesmo padrão de exclusão de permuta que o resto do arquivo já usa.

**Files:**
- Modify: `lib/queries/dashboard.ts`

- [ ] **Step 1: Remover o cálculo e o campo do retorno**

Em `lib/queries/dashboard.ts`, remova o bloco (linhas 77-79):

```ts
  const receitaPeriodo = lancamentos
    .filter((l) => l.tipo === "receita" && l.vencimento && l.vencimento >= inicio && l.vencimento <= fim)
    .reduce((acc, l) => acc + totalPago(pagamentos, l.id), 0);

```

E remova a linha `receitaPeriodo,` do objeto de retorno (linha 191).

- [ ] **Step 2: Confirmar que nada mais referencia `receitaPeriodo`**

Run: `grep -rn "receitaPeriodo" --include="*.ts" --include="*.tsx" . | grep -v node_modules`
Expected: nenhum resultado.

- [ ] **Step 3: Checar tipos, lint e suíte de testes**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npm run lint`
Expected: sem erros.

Run: `npm run test`
Expected: todos os testes existentes continuam passando (nenhum teste cobre `dashboard.ts` hoje, então isso só garante que nada mais quebrou).

- [ ] **Step 4: Commit**

```bash
git add lib/queries/dashboard.ts
git commit -m "refactor: remove cálculo morto e com bug de duplicidade em dadosDashboard"
```

---

## Ordem recomendada de execução

1. Task 1 (crítico, só TS/React, sem dependência de migração)
2. Task 2 (alto, só TS, sem dependência de migração)
3. Task 5 (baixo, trivial, isolado)
4. Task 3 (médio, precisa de aprovação + acesso ao Supabase certo para aplicar)
5. Task 4 (médio, precisa de aprovação + acesso ao Supabase certo para aplicar — deixe por último porque é a única que **quebra o app em produção** se o código for enviado sem a migração aplicada antes)
