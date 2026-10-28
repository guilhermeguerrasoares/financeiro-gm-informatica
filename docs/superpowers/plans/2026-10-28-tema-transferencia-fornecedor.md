# Tema claro, transferência entre contas e fornecedor como conta — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao sistema um tema claro alternável, transferência entre contas que não polui os relatórios, e uma tela de fornecedor que funciona como conta de dívida.

**Architecture:** Tudo se apoia no modelo que já existe — `lancamentos` + `pagamentos`, com o saldo saindo da baixa, não do lançamento. Transferência e dívida de fornecedor são marcações novas em `lancamentos`, não tabelas paralelas, e as exclusões de relatório passam por **um único predicado** compartilhado, para que esquecer um ponto de chamada vire erro de tipo em vez de número errado.

**Tech Stack:** Next.js 15 (App Router, Server Actions), React 19, Supabase (Postgres + RLS), Tailwind 3, vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-28-tema-transferencia-fornecedor-design.md`

**Nota de escopo:** as quatro entregas compartilham `lancamentos`, as listas de exclusão de relatório e as mesmas telas (`LancamentosTable`, `/contas`, `/fornecedores`), então vivem num plano só. Cada tarefa, ainda assim, termina em algo que funciona e pode ser revisado sozinho.

## Global Constraints

Valem para toda tarefa; não se repetem dentro delas.

- **Migrações:** próximos números livres são `0022` e `0023`. **Nunca editar migração já aplicada**, nem para corrigir comentário.
- **Ordem de deploy:** a migração é aplicada ao banco **antes** do deploy do código que a usa. Só adiciona; nenhum fluxo existente passa a depender dela.
- **RLS:** policies separadas por comando, **nunca `for all`**; leitura para qualquer perfil, escrita só para `dono`/`gerente` (padrão da `0009`).
- **Funções SQL novas:** `set search_path = public, pg_temp` e **sem `security definer`**.
- **`profiles`:** `authenticated` continua com UPDATE só na coluna `nome`. Nenhum `grant` novo amplo.
- **Idempotência:** formulário novo que cria lançamento carrega `idempotency_key` (migração `0021`). `idx_lancamentos_idempotency` é único por linha — **as duas pernas de uma transferência não podem compartilhar a chave**.
- **Dinheiro:** `numeric(12,2)` no banco, `round2` no JS. Limiar de "diferença real": `0.005`. Limiar de "ainda falta": `0.004`.
- **Datas:** strings ISO `YYYY-MM-DD` comparadas como texto. Nunca `new Date()` para aritmética de dias — usar `addDias`/`diffDias`/`dataLocal` de `lib/format.ts`.
- **Verificação:** **nenhum dado de teste é criado no banco da loja**, nem pelo preview. O que prova correção é vitest sobre funções puras (`npm test`) mais `npm run build`.
- **Tema claro:** tom suave, não branco puro. Degradê da marca preservado.

## Review Focus

Classes de entrada que a spec implica e que mordem o usuário se ninguém testar. Cada uma tem um teste na tarefa dona.

1. **Transferência com origem igual ao destino, ou valor ≤ 0** — a RPC recusa; sem isso o saldo "some" de uma conta sem ir para lugar nenhum. (Tarefa 4)
2. **Uma perna de transferência editada, excluída ou estornada sozinha** — três caminhos existentes (`excluirLancamentoAction`, edição pelo modal, `estornarPagamentoAction`) tiram dinheiro do saldo em silêncio. O banco recusa. (Tarefa 4)
3. **Ajuste de dívida que diminui** gera `receita` sem pagamento, e receita sem pagamento parece "a receber" — não pode aparecer no dashboard nem em `/dividas`. (Tarefa 6)
4. **Quitação registrada com compras em aberto do mesmo fornecedor** — a tela recusa e oferece quitar as compras; sem isso o topo e a lista discordam. (Tarefa 8)
5. **Antiguidade de lançamento criado à noite no Brasil** — `created_at` cru em UTC cai na véspera; tem que passar por `dataLocal`. (Tarefa 5)

---

## File Structure

**Criar:**
- `lib/exclusoes.ts` — o predicado único "esta linha conta nos relatórios?"
- `lib/tema.ts` — resolução pura do tema guardado
- `lib/corSituacao.ts` — classe CSS da coluna "Falta" por situação
- `lib/fornecedores.ts` — saldo devedor e movimentos do fornecedor (puro)
- `lib/transferencias.ts` — validação pura da transferência
- `lib/queries/transferencias.ts` — chamada da RPC
- `components/TemaToggle.tsx` — botão sol/lua
- `app/contas/TransferenciaModal.tsx`
- `app/fornecedores/[id]/FornecedorConta.tsx` — a tela como conta (client)
- `app/fornecedores/[id]/AjusteDividaModal.tsx`
- `app/fornecedores/[id]/PagamentoFornecedorModal.tsx`
- `app/fornecedores/[id]/actions.ts`
- `supabase/migrations/0022_transferencia_entre_contas.sql`
- `supabase/migrations/0023_divida_fornecedor.sql`
- Testes: `lib/exclusoes.test.ts`, `lib/tema.test.ts`, `lib/corSituacao.test.ts`, `lib/fornecedores.test.ts`

**Modificar:**
- `app/globals.css`, `app/layout.tsx`, `components/Sidebar.tsx`, `components/StatusTag.tsx`
- `lib/types.ts` — colunas novas em `LancamentoRow`
- `lib/relatorios-calc.ts:20,63`, `lib/metas-calc.ts:19`, `lib/queries/dashboard.ts:65,130,150`
- `app/lancamentos/LancamentosTable.tsx` — cor da "Falta", etiqueta de transferência
- `app/dividas/page.tsx` — cor da "Falta"
- `app/contas/ContasList.tsx`, `app/contas/actions.ts`
- `app/fornecedores/page.tsx`, `app/fornecedores/FornecedoresList.tsx`, `lib/queries/fornecedores.ts`
- `app/fornecedores/[id]/page.tsx`
- `app/lancamentos/LancamentoModal.tsx`, `app/lancamentos/actions.ts`

---

### Task 1: Tema claro/escuro

**Files:**
- Create: `lib/tema.ts`, `components/TemaToggle.tsx`
- Test: `lib/tema.test.ts`
- Modify: `app/globals.css`, `app/layout.tsx`, `components/Sidebar.tsx`, `components/StatusTag.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `type Tema = "claro" | "escuro"`; `temaInicial(armazenado: string | null): Tema`; `CHAVE_TEMA = "tema"`.

- [ ] **Step 1: Write the failing test** — `lib/tema.test.ts`

```ts
describe("temaInicial", () => {
  it("usa escuro quando não há nada guardado", () => {
    expect(temaInicial(null)).toBe("escuro");
  });
  it("usa escuro quando o valor guardado é lixo", () => {
    expect(temaInicial("roxo")).toBe("escuro");
  });
  it("respeita o tema guardado", () => {
    expect(temaInicial("claro")).toBe("claro");
    expect(temaInicial("escuro")).toBe("escuro");
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run lib/tema.test.ts`. Esperado: FAIL, `temaInicial` não existe.

- [ ] **Step 3: Implement `temaInicial(armazenado: string | null): Tema` e `export const CHAVE_TEMA = "tema"` em `lib/tema.ts`**

Escuro é o padrão porque é o tema atual do sistema — quem nunca escolheu nada não pode ver a tela mudar.

- [ ] **Step 4: Run test to verify it passes** — `npx vitest run lib/tema.test.ts`. Esperado: PASS.

- [ ] **Step 5: Paleta clara em `app/globals.css`**

Redefinir as mesmas variáveis de `:root` sob `[data-theme="claro"]`: `--bg` em tom suave (faixa de `#F1F3F7`, nunca `#FFFFFF`), `--surface`/`--surface-2`/`--surface-modal` claras com a mesma ideia de camada, `--text` escuro de alto contraste, `--text-dim` legível sobre `--bg`, `--border` mais presente que no escuro (borda clara sobre fundo claro some). Os quatro `--accent-*` precisam de versão escurecida: `#34D399` sobre fundo claro não se lê. O `--brand-gradient` **não muda**. No `body`, os dois degradês radiais vão para opacidade bem menor no claro — no escuro eles são brilho, no claro viram mancha.

- [ ] **Step 6: Aplicar o tema antes da primeira pintura em `app/layout.tsx`**

Script inline no `<head>` que lê `localStorage[CHAVE_TEMA]`, passa por `temaInicial` e escreve `data-theme` no `<html>`. Inline e síncrono: qualquer coisa que rode depois da hidratação faz a tela piscar escura a cada carregamento para quem escolheu claro. Envolver em `try/catch` — `localStorage` lança em janela privada.

- [ ] **Step 7: Criar `components/TemaToggle.tsx` e montá-lo na `Sidebar`**

`"use client"`, ícones `Sun`/`Moon` de `lucide-react` (já é dependência). Alterna `data-theme` no `<html>` e grava em `localStorage`. Fica no bloco do rodapé da `Sidebar`, junto de "Alterar senha" e "Sair". `aria-label` dizendo para qual tema vai.

- [ ] **Step 8: Varrer as cores fixas**

Run: `grep -rn "bg-\(red\|blue\|amber\|emerald\|slate\|gray\|zinc\)-[0-9]\|text-white\|bg-white\|bg-black" app components`

`StatusTag.tsx` usa `bg-red-950`, `bg-blue-950`, `bg-amber-950`, `bg-emerald-950` — ilegíveis no claro; trocar por variáveis novas (ex.: `--tag-atrasado-bg`) definidas nos dois temas. `text-[var(--bg)]` sobre botão de fundo `--accent-blue` continua funcionando nos dois, mas conferir. Decidir caso a caso; o critério é contraste legível nos dois temas, não fidelidade ao tom atual.

- [ ] **Step 9: Verificar**

Run: `npm test && npm run build`. Esperado: testes PASS, build sem erro. Abrir `/dashboard`, `/lancamentos` e `/fornecedores` nos dois temas e conferir que nenhum texto some no fundo.

- [ ] **Step 10: Commit**

```bash
git add lib/tema.ts lib/tema.test.ts components/TemaToggle.tsx components/Sidebar.tsx components/StatusTag.tsx app/globals.css app/layout.tsx
git commit -m "feat(tema): alternar entre tema claro e escuro"
```

---

### Task 2: Cor da coluna "Falta" por situação

**Files:**
- Create: `lib/corSituacao.ts`
- Test: `lib/corSituacao.test.ts`
- Modify: `app/lancamentos/LancamentosTable.tsx:481`, `app/dividas/page.tsx` (as duas colunas "Falta")

**Interfaces:**
- Consumes: `StatusLancamento` de `lib/calculations.ts`.
- Produces: `classeDoSaldo(status: StatusLancamento): string`.

- [ ] **Step 1: Write the failing test** — `lib/corSituacao.test.ts`

```ts
describe("classeDoSaldo", () => {
  it("vermelho só quando atrasado", () => {
    expect(classeDoSaldo("atrasado")).toContain("--accent-red");
  });
  it("âmbar quando parcial", () => {
    expect(classeDoSaldo("parcial")).toContain("--accent-amber");
  });
  it("não usa vermelho em aberto nem quitado", () => {
    expect(classeDoSaldo("aberto")).not.toContain("--accent-red");
    expect(classeDoSaldo("quitado")).not.toContain("--accent-red");
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run lib/corSituacao.test.ts`. Esperado: FAIL.

- [ ] **Step 3: Implement `classeDoSaldo(status: StatusLancamento): string` em `lib/corSituacao.ts`**

Devolve a classe Tailwind de cor do texto. `quitado` usa `--text-dim` (o "R$ 0,00" não precisa de destaque); `aberto` usa a cor normal do texto.

- [ ] **Step 4: Run test to verify it passes** — `npx vitest run lib/corSituacao.test.ts`. Esperado: PASS.

- [ ] **Step 5: Usar nas duas telas**

Em `LancamentosTable.tsx` a célula da coluna "Falta" hoje é `className="text-right font-semibold text-[var(--accent-red)]"` fixo; passa a compor com `classeDoSaldo(status)`. Em `app/dividas/page.tsx`, as duas tabelas ("Clientes devendo" e "Dívidas da loja") têm a mesma classe fixa e já calculam `calcStatus`.

- [ ] **Step 6: Verificar** — `npm test && npm run build`. Esperado: PASS e build limpo.

- [ ] **Step 7: Commit**

```bash
git add lib/corSituacao.ts lib/corSituacao.test.ts app/lancamentos/LancamentosTable.tsx app/dividas/page.tsx
git commit -m "feat(lancamentos): colorir a coluna Falta pela situação"
```

---

### Task 3: Predicado único de exclusão dos relatórios

Hoje seis pontos repetem `!l.ajuste_saldo`. Transferência e ajuste de dívida precisam entrar nessa mesma lista, e uma lista repetida seis vezes é uma lista que vai ficar com cinco itens certos e um errado.

**Files:**
- Create: `lib/exclusoes.ts`
- Test: `lib/exclusoes.test.ts`
- Modify: `lib/types.ts`, `lib/relatorios-calc.ts:20,63`, `lib/metas-calc.ts:19`, `lib/queries/dashboard.ts:65,130,150`

**Interfaces:**
- Consumes: `LancamentoRow`.
- Produces: `type LinhaClassificavel = { ajuste_saldo: boolean; transferencia_id: string | null }`; `entraNosRelatorios(l: LinhaClassificavel): boolean`. A Tarefa 5 estende este tipo e esta função com `movimento_fornecedor`.

- [ ] **Step 1: Write the failing test** — `lib/exclusoes.test.ts`

```ts
describe("entraNosRelatorios", () => {
  it("lançamento comum entra", () => {
    expect(entraNosRelatorios({ ajuste_saldo: false, transferencia_id: null })).toBe(true);
  });
  it("ajuste de conciliação fica de fora", () => {
    expect(entraNosRelatorios({ ajuste_saldo: true, transferencia_id: null })).toBe(false);
  });
  it("perna de transferência fica de fora", () => {
    expect(entraNosRelatorios({ ajuste_saldo: false, transferencia_id: "t1" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run lib/exclusoes.test.ts`. Esperado: FAIL.

- [ ] **Step 3: Adicionar `transferencia_id: string | null` a `LancamentoRow` em `lib/types.ts`**

Com comentário explicando o papel, no estilo dos campos vizinhos: liga as duas pernas de uma transferência; nulo em todo lançamento comum.

- [ ] **Step 4: Pôr `transferencia_id` na lista de omissões de `criarLancamento`**

Em `lib/queries/lancamentos.ts`, `criarLancamento` recebe `Omit<LancamentoRow, ...>`. Sem acrescentar `transferencia_id` a essa lista, o campo novo vira obrigatório no `input` e `app/lancamentos/actions.ts` deixa de compilar. Quem preenche é a RPC da Tarefa 4, nunca o formulário — mesmo motivo de `ajuste_saldo`, e o comentário existente ali explica o padrão.

- [ ] **Step 5: Implement `entraNosRelatorios` em `lib/exclusoes.ts`**

- [ ] **Step 6: Run test to verify it passes** — `npx vitest run lib/exclusoes.test.ts`. Esperado: PASS.

- [ ] **Step 7: Trocar os seis pontos de chamada pelo predicado**

`lib/relatorios-calc.ts` nas duas funções de agrupamento; `lib/metas-calc.ts` em `somaFaturamento`; `lib/queries/dashboard.ts` em `despesas`, no filtro de `pagamentosPeriodo` (que olha `x.lancamento`) e em `lancamentosFluxo`. Depois da troca, `grep -rn "ajuste_saldo" lib/` só pode sobrar em `lib/types.ts`, `lib/exclusoes.ts` e nos testes.

- [ ] **Step 8: Cobrir transferência nos testes existentes**

Em `lib/relatorios.test.ts` e `lib/metas-calc.test.ts`, acrescentar uma linha com `transferencia_id` preenchido e afirmar que ela não aparece no agrupamento nem no faturamento. Os objetos literais desses testes precisam do campo novo.

- [ ] **Step 9: Verificar** — `npm test && npm run build`. Esperado: PASS e build limpo.

- [ ] **Step 10: Commit**

```bash
git add lib/exclusoes.ts lib/exclusoes.test.ts lib/types.ts lib/queries/lancamentos.ts lib/relatorios-calc.ts lib/metas-calc.ts lib/queries/dashboard.ts lib/relatorios.test.ts lib/metas-calc.test.ts lib/ltv.test.ts
git commit -m "refactor(relatorios): centralizar a exclusão de lançamentos não operacionais"
```

---

### Task 4: Transferência entre contas

**Files:**
- Create: `supabase/migrations/0022_transferencia_entre_contas.sql`, `lib/transferencias.ts`, `lib/queries/transferencias.ts`, `app/contas/TransferenciaModal.tsx`
- Test: `lib/transferencias.test.ts`
- Modify: `app/contas/actions.ts`, `app/contas/ContasList.tsx`, `app/contas/page.tsx`, `app/lancamentos/LancamentosTable.tsx`

**Interfaces:**
- Consumes: `entraNosRelatorios` (Tarefa 3); `registrarAjusteSaldo` de `lib/queries/contasFinanceiras.ts` como molde de chamada de RPC.
- Produces: `registrarTransferencia(input: { conta_origem_id: string; conta_destino_id: string; valor: number; data: string; observacao: string | null; idempotency_key: string | null }): Promise<void>`; `transferirAction(formData: FormData)`; `estornarTransferenciaAction(transferenciaId: string)`.

- [ ] **Step 1: Escrever a migração `0022_transferencia_entre_contas.sql`**

Conteúdo, no estilo comentado das migrações existentes (a `0013` é o molde mais próximo):

- `alter table lancamentos add column transferencia_id uuid;` com `comment on column` explicando que liga as duas pernas e que elas ficam fora de faturamento, metas, DRE e fluxo.
- Índice em `transferencia_id` onde não for nulo.
- `create function registrar_transferencia(p_conta_origem_id uuid, p_conta_destino_id uuid, p_valor numeric, p_data date, p_observacao text, p_idempotency_key uuid) returns uuid` — gera um `transferencia_id`, insere a despesa na origem e a receita no destino (ambas com `competencia = to_char(p_data,'YYYY-MM')`), insere um `pagamentos` para cada uma na conta respectiva, devolve o `transferencia_id`. **Tudo numa função só**, que é a transação. `p_idempotency_key` vai em **uma perna só** — o índice único da `0021` é por linha.
- Recusa, com `raise exception` em português: contas iguais; `p_valor` abaixo de `0.005`; conta inexistente ou inativa.
- **Trigger que protege o par**: `before delete` e `before update` em `lancamentos` recusando quando `transferencia_id is not null` e a operação não vem da função de estorno; e `before delete` em `pagamentos` recusando o estorno isolado de uma perna. A mensagem diz o que fazer em vez disso ("estorne a transferência inteira"). Trigger comum, sem `security definer`.
- `create function estornar_transferencia(p_transferencia_id uuid) returns void` — apaga as duas pernas juntas, única porta de saída.
- `set search_path = public, pg_temp` nas três funções.

- [ ] **Step 2: Revisar a migração contra as Global Constraints**

Checklist: sem `security definer`; `search_path` nas três funções; nenhuma policy `for all` nova; a coluna é anulável (as ~418 linhas existentes ficam nulas, que é o certo); `grep -n "for all" supabase/migrations/0022_*.sql` não retorna nada.

- [ ] **Step 3: Implement `registrarTransferencia` em `lib/queries/transferencias.ts`**

Chama `supabase.rpc("registrar_transferencia", { ... })`, no formato de `registrarAjusteSaldo`. Um `estornarTransferencia(id)` chamando `estornar_transferencia`.

- [ ] **Step 4: Validação pura, com teste — `lib/transferencias.ts` e `lib/transferencias.test.ts`**

```ts
describe("validarTransferencia", () => {
  it("recusa origem igual ao destino", () => {
    expect(validarTransferencia({ origemId: "c1", destinoId: "c1", valor: 100 })).toMatch(/mesma conta/i);
  });
  it("recusa valor zero ou negativo", () => {
    expect(validarTransferencia({ origemId: "c1", destinoId: "c2", valor: 0 })).not.toBeNull();
    expect(validarTransferencia({ origemId: "c1", destinoId: "c2", valor: -50 })).not.toBeNull();
  });
  it("aceita transferência válida", () => {
    expect(validarTransferencia({ origemId: "c1", destinoId: "c2", valor: 1000 })).toBeNull();
  });
});
```

`validarTransferencia(input): string | null` devolve a mensagem em português ou `null`. Pura de propósito: é a única parte das recusas do Review Focus 1 que dá para provar com teste, já que o banco não é exercido.

- [ ] **Step 5: Implement `transferirAction` e `estornarTransferenciaAction` em `app/contas/actions.ts`**

Usam `validarTransferencia` antes de chamar a RPC — a mesma recusa dos dois lados, porque em produção o Next troca o texto de erro de server action por um genérico e a mensagem que o usuário lê é a que acontece antes. `revalidarPaginasFinanceiras()` no fim.

- [ ] **Step 6: Criar `app/contas/TransferenciaModal.tsx` e o botão em `ContasList`**

Quatro campos: conta de origem (`ContaSelect`), conta de destino, valor, data (`defaultValue={hoje()}`), mais observação opcional. Mostra o saldo atual da conta de origem — `ContasList` já recebe `saldoPorConta`. Desabilita o envio enquanto origem e destino forem iguais. Gera `idempotency_key` com `crypto.randomUUID()` na abertura do modal, como os formulários da `0021`. Botão "Transferir" ao lado de "+ Nova conta".

- [ ] **Step 7: Etiqueta e estorno em `LancamentosTable.tsx`**

Onde já existe a etiqueta de `ajuste_saldo` (perto da linha 467), acrescentar "Transferência" quando `transferencia_id` não for nulo. Nessas linhas, esconder editar e excluir e oferecer "Estornar transferência", que chama `estornarTransferenciaAction` — a trava real está no banco, isto é só para o usuário não bater nela.

- [ ] **Step 8: Teste do Review Focus 1 e 2**

Em `lib/exclusoes.test.ts`, afirmar que as duas pernas (despesa e receita com o mesmo `transferencia_id`) ficam fora dos relatórios. As recusas do trigger (Review Focus 2) são SQL e, por decisão do dono, **não são exercidas contra o banco**: ficam cobertas pela revisão do Step 2 e por esconder os botões no Step 7. O Review Focus 1 está provado pelo teste do Step 4.

- [ ] **Step 9: Verificar** — `npm test && npm run build`. Esperado: PASS e build limpo.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/0022_transferencia_entre_contas.sql lib/transferencias.ts lib/transferencias.test.ts lib/queries/transferencias.ts app/contas/TransferenciaModal.tsx app/contas/actions.ts app/contas/ContasList.tsx app/contas/page.tsx app/lancamentos/LancamentosTable.tsx lib/exclusoes.test.ts
git commit -m "feat(contas): transferência entre contas"
```

---

### Task 5: Saldo devedor e movimentos do fornecedor (cálculo puro)

**Files:**
- Create: `lib/fornecedores.ts`
- Test: `lib/fornecedores.test.ts`
- Modify: `lib/types.ts`, `lib/exclusoes.ts`, `lib/exclusoes.test.ts`

**Interfaces:**
- Consumes: `saldo`, `totalPago`, `status`, `round2` de `lib/calculations.ts`; `dataLocal`, `diffDias` de `lib/format.ts`; `entraNosRelatorios` (Tarefa 3).
- Produces:
  - `type MovimentoFornecedor = "compra" | "ajuste" | "quitacao"` (coluna `movimento_fornecedor` em `LancamentoRow`)
  - `saldoDevedor(fornecedorId: string, lancamentos: LancamentoRow[], pagamentos: PagamentoRow[]): number`
  - `type LinhaFornecedor = { lancamento: LancamentoRow; falta: number; status: StatusLancamento; diasEmAberto: number }`
  - `movimentosDoFornecedor(fornecedorId: string, lancamentos: LancamentoRow[], pagamentos: PagamentoRow[], hoje: string, periodo?: { de: string; ate: string }): LinhaFornecedor[]`

- [ ] **Step 1: Write the failing test** — `lib/fornecedores.test.ts`

Com um helper local `lanc(partial)` no estilo de `lib/relatorios.test.ts`:

```ts
describe("saldoDevedor", () => {
  it("soma o que falta das compras", () => {
    // compra 1000 com pagamento de 400 => devo 600
    expect(saldoDevedor("f1", [compra1000], [pag400])).toBe(600);
  });
  it("soma ajuste de despesa e subtrai ajuste de receita", () => {
    // ajuste despesa 6500 + ajuste receita 500 => devo 6000
    expect(saldoDevedor("f1", [ajusteDespesa6500, ajusteReceita500], [])).toBe(6000);
  });
  it("quitação abate sem somar", () => {
    // ajuste 6500 + quitação de 2000 já paga => devo 4500
    expect(saldoDevedor("f1", [ajuste6500, quitacao2000], [pagQuitacao2000])).toBe(4500);
  });
  it("quitação abate só o que foi pago de verdade", () => {
    // quitação de 2000 com pagamento de 500 => abate 500
    expect(saldoDevedor("f1", [ajuste6500, quitacao2000], [pag500])).toBe(6000);
  });
  it("ignora lançamentos de outro fornecedor", () => {
    expect(saldoDevedor("f1", [compraDeF2], [])).toBe(0);
  });
  it("fornecedor sem movimento nenhum deve zero", () => {
    expect(saldoDevedor("f1", [], [])).toBe(0);
  });
});

describe("movimentosDoFornecedor", () => {
  it("conta a antiguidade pelo dia local de created_at, não pelo UTC cru", () => {
    // created_at 2026-10-27T23:30:00-03:00 === 2026-10-28T02:30:00Z
    const linha = movimentosDoFornecedor("f1", [compraCriadaANoite], [], "2026-10-28")[0];
    expect(linha.diasEmAberto).toBe(1);
  });
  it("ordena os em aberto do mais antigo para o mais novo, quitados por último", () => {
    const ordem = movimentosDoFornecedor("f1", [quitadaAntiga, abertaNova, abertaAntiga], pagamentos, hoje)
      .map((l) => l.lancamento.id);
    expect(ordem).toEqual(["abertaAntiga", "abertaNova", "quitadaAntiga"]);
  });
  it("filtra por período usando a data de criação", () => {
    expect(movimentosDoFornecedor("f1", todas, [], hoje, { de: "2026-10-01", ate: "2026-10-31" }))
      .toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run lib/fornecedores.test.ts`. Esperado: FAIL.

- [ ] **Step 3: Adicionar `movimento_fornecedor: MovimentoFornecedor` a `LancamentoRow` em `lib/types.ts`**

Com comentário: `'compra'` é o padrão e o que todo lançamento existente é; `'ajuste'` é dívida informada sem compra lançada, nunca tem pagamento; `'quitacao'` é pagamento de dívida informada — abate sem somar.

- [ ] **Step 4: Implement `saldoDevedor` e `movimentosDoFornecedor` em `lib/fornecedores.ts`**

`saldoDevedor` = Σ `saldo()` das compras + Σ valor dos ajustes de despesa − Σ valor dos ajustes de receita − Σ `totalPago()` das quitações. Quitação abate pelo que foi **pago**, não pelo valor lançado: uma quitação ainda não paga não tirou dinheiro de lugar nenhum.

`diasEmAberto` = `diffDias(dataLocal(l.created_at), hoje)`. Ordenação: em aberto antes de quitado, e dentro de cada grupo o `created_at` mais antigo primeiro. O filtro de período compara `dataLocal(l.created_at)` com `de`/`ate` — `dentroDoPeriodo` de `lib/calculations.ts` já faz a comparação, basta passar a data certa.

- [ ] **Step 5: Run test to verify it passes** — `npx vitest run lib/fornecedores.test.ts`. Esperado: PASS.

- [ ] **Step 6: Fazer `app/lancamentos/actions.ts` gravar `movimento_fornecedor: "compra"`**

A coluna é obrigatória em `LancamentoRow` e **não** entra na lista de omissões de `criarLancamento` — ao contrário de `ajuste_saldo` e `transferencia_id`, quem a preenche é o formulário. Até a Tarefa 8 colocar a pergunta na tela, `salvarLancamentoAction` grava `"compra"` fixo. Sem este passo, a Tarefa 5 não compila.

- [ ] **Step 7: Estender `entraNosRelatorios` para excluir o ajuste de dívida**

`LinhaClassificavel` ganha `movimento_fornecedor`. Teste novo em `lib/exclusoes.test.ts`: `movimento_fornecedor: "ajuste"` fica de fora; `"compra"` e `"quitacao"` entram (a quitação **é** despesa do mês, por decisão do dono). Atualizar os objetos literais dos testes existentes que montam `LancamentoRow` à mão.

- [ ] **Step 8: Verificar** — `npm test && npm run build`. Esperado: PASS e build limpo.

- [ ] **Step 9: Commit**

```bash
git add lib/fornecedores.ts lib/fornecedores.test.ts lib/types.ts lib/exclusoes.ts lib/exclusoes.test.ts app/lancamentos/actions.ts lib/relatorios.test.ts lib/metas-calc.test.ts lib/ltv.test.ts
git commit -m "feat(fornecedores): cálculo do saldo devedor e dos movimentos"
```

---

### Task 6: Migração 0023 e ajuste de dívida

**Files:**
- Create: `supabase/migrations/0023_divida_fornecedor.sql`, `app/fornecedores/[id]/AjusteDividaModal.tsx`, `app/fornecedores/[id]/actions.ts`
- Modify: `lib/queries/fornecedores.ts`

**Interfaces:**
- Consumes: `saldoDevedor` (Tarefa 5); `AjusteSaldoModal` de `app/contas/` como molde de tela.
- Produces: `registrarAjusteDivida(input: { fornecedor_id: string; data: string; diferenca: number; observacao: string | null }): Promise<void>`; `ajustarDividaAction(formData: FormData)`.

- [ ] **Step 1: Escrever a migração `0023_divida_fornecedor.sql`**

- `create type movimento_fornecedor as enum ('compra','ajuste','quitacao');`
- `alter table lancamentos add column movimento_fornecedor movimento_fornecedor not null default 'compra';` — `not null default 'compra'` de propósito: **todos os lançamentos existentes são compras**, que é o que eles são.
- `check (movimento_fornecedor = 'compra' or fornecedor_id is not null)` — ajuste e quitação sem fornecedor não querem dizer nada.
- `create function registrar_ajuste_divida_fornecedor(p_fornecedor_id uuid, p_data date, p_diferenca numeric, p_observacao text) returns uuid` — insere **um lançamento sem pagamento nenhum**, `despesa` quando `p_diferenca > 0` e `receita` quando negativa (cast explícito para o enum `tipo_lancamento`, como a `0013` faz), `movimento_fornecedor = 'ajuste'`, `categoria_id` nulo, `vencimento` nulo. **Vencimento nulo é a decisão**: ajuste não vence, e é isso que o mantém fora de "atrasado". Recusa diferença abaixo de `0.005`.
- `set search_path = public, pg_temp`, sem `security definer`.
- Comentário explicando por que não há pagamento: reconhecer dívida não é gastar.

- [ ] **Step 2: Revisar contra as Global Constraints** — mesmo checklist do Step 2 da Tarefa 4.

- [ ] **Step 3: Conferir que o ajuste não vaza para as telas de dívida**

`listarDividasClientes` exige `cliente_id not null` — ajuste tem `fornecedor_id`, então não aparece. `listarDividasLoja` filtra por categorias do grupo "Despesas Financeiras" — ajuste tem `categoria_id` nulo, então não aparece. O dashboard é coberto pelo `entraNosRelatorios` da Tarefa 5. Escrever esse raciocínio como comentário em `lib/fornecedores.ts`, junto da função de ajuste.

- [ ] **Step 4: Teste do Review Focus 3** — em `lib/exclusoes.test.ts`

```ts
it("ajuste que diminui a dívida é receita, mas não entra nos relatórios", () => {
  expect(entraNosRelatorios({
    ajuste_saldo: false, transferencia_id: null, movimento_fornecedor: "ajuste",
  })).toBe(false);
});
```

E em `lib/fornecedores.test.ts`, afirmar que um ajuste de receita não aparece como valor a receber em `movimentosDoFornecedor` — ele é abatimento de dívida, não cobrança.

- [ ] **Step 5: Implement `registrarAjusteDivida` em `lib/queries/fornecedores.ts` e `ajustarDividaAction` em `app/fornecedores/[id]/actions.ts`**

A action recebe o saldo do sistema e o saldo real, calcula a diferença com `round2` e recusa abaixo de `0.005` com mensagem em português — mesmo desenho de `ajustarSaldoAction`.

- [ ] **Step 6: Criar `AjusteDividaModal.tsx`**

Cópia de desenho do `AjusteSaldoModal`: mostra "Dívida no sistema" num bloco, pede "Dívida real (R$)", data e motivo opcional, e antecipa a diferença em texto antes de enviar. Texto de rodapé dizendo que o ajuste não entra em caixa, DRE, metas nem fluxo, **e que ele é para dívida que não está lançada compra a compra** — é o aviso que previne a dupla contagem.

- [ ] **Step 7: Verificar** — `npm test && npm run build`. Esperado: PASS e build limpo.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0023_divida_fornecedor.sql app/fornecedores/[id]/AjusteDividaModal.tsx app/fornecedores/[id]/actions.ts lib/queries/fornecedores.ts lib/fornecedores.ts lib/fornecedores.test.ts lib/exclusoes.test.ts
git commit -m "feat(fornecedores): ajustar o saldo da dívida"
```

---

### Task 7: A tela do fornecedor como conta

**Files:**
- Create: `app/fornecedores/[id]/FornecedorConta.tsx`
- Modify: `app/fornecedores/[id]/page.tsx`, `app/fornecedores/page.tsx`, `app/fornecedores/FornecedoresList.tsx`

**Interfaces:**
- Consumes: `saldoDevedor`, `movimentosDoFornecedor` (Tarefa 5); `AjusteDividaModal` (Tarefa 6).
- Produces: nada que outra tarefa consuma, fora o ponto de montagem dos modais da Tarefa 8.

- [ ] **Step 1: Reescrever `app/fornecedores/[id]/page.tsx` como server component magro**

Continua buscando fornecedor, lançamentos e pagamentos em paralelo e tratando `PGRST116` com `notFound()`. Passa tudo para `<FornecedorConta>`, que é client (precisa de estado para filtro e modais). Também precisa de `listarCategorias` e `listarContasFinanceiras` para os modais da Tarefa 8.

- [ ] **Step 2: Criar `FornecedorConta.tsx` — quatro cartões no topo**

"Devo" (de `saldoDevedor`, em `--accent-red` quando acima de `0.004`, senão `--accent-green`), "Mais antiga em aberto" (`diasEmAberto` da primeira linha em aberto, em dias), "Última compra" (data de criação da compra mais recente) e "Próximo vencimento" (o menor `vencimento` não quitado — a tela já calcula isso hoje). No estilo do cartão que já existe na tela.

- [ ] **Step 3: A lista de movimentos**

Tabela com: Descrição · Adicionada (`formatDataBR` da data local + "há N dias") · Vencimento · Valor · Falta · Situação (`StatusTag`). Ordem vem pronta de `movimentosDoFornecedor`. A coluna "Falta" usa `classeDoSaldo` da Tarefa 2. Ajustes aparecem com uma etiqueta "Ajuste de dívida" e sem vencimento.

- [ ] **Step 4: Filtro de período**

Dois campos de data acima da tabela, no estilo dos filtros de `LancamentosTable`. Passa `{ de, ate }` para `movimentosDoFornecedor`. **Os cartões do topo não são filtrados** — "quanto devo" é sempre o total atual; dívida filtrada por mês é um número sem significado. Deixar isso como comentário no componente, senão alguém "conserta" depois.

- [ ] **Step 5: Coluna "Devo" na lista de fornecedores**

`app/fornecedores/page.tsx` hoje soma `l.valor` e `saldo(l, pagamentos)` por fornecedor. Trocar o "Falta pagar" por `saldoDevedor(f.id, ...)`, que é a mesma pergunta respondida certo: inclui ajuste e desconta quitação.

- [ ] **Step 6: Botão "+ Adicionar compra"**

Reaproveita o `LancamentoModal` de `app/lancamentos/`, já com o fornecedor preenchido e o tipo em "despesa" — é o mesmo formulário de Entradas e Saídas, como a spec pede ("é tudo o mesmo lançamento, visto por dois lugares"). Por isso o Step 1 carrega categorias, clientes e contas: o modal precisa delas. O botão fica ao lado de "Registrar pagamento" e "Ajustar dívida", no topo da tela.

- [ ] **Step 7: Verificar** — `npm test && npm run build`, e abrir `/fornecedores` e um fornecedor nos dois temas. Esperado: PASS, build limpo, nenhuma coluna ilegível.

- [ ] **Step 8: Commit**

```bash
git add app/fornecedores
git commit -m "feat(fornecedores): tela do fornecedor como conta de dívida"
```

---

### Task 8: Pagamento ao fornecedor e a trava do pagamento solto

**Files:**
- Create: `app/fornecedores/[id]/PagamentoFornecedorModal.tsx`
- Modify: `app/fornecedores/[id]/actions.ts`, `app/fornecedores/[id]/FornecedorConta.tsx`, `app/lancamentos/LancamentoModal.tsx`, `app/lancamentos/actions.ts`, `lib/fornecedores.ts`, `lib/fornecedores.test.ts`

**Interfaces:**
- Consumes: `movimentosDoFornecedor`, `saldoDevedor` (Tarefa 5); `registrarPagamentoAction` e `PagamentoModal` de `app/lancamentos/` como molde.
- Produces: `temCompraEmAberto(fornecedorId: string, lancamentos: LancamentoRow[], pagamentos: PagamentoRow[]): boolean`; `registrarQuitacaoAction(formData: FormData)`.

- [ ] **Step 1: Write the failing test** — em `lib/fornecedores.test.ts`

```ts
describe("temCompraEmAberto", () => {
  it("é verdadeiro quando há compra com saldo", () => {
    expect(temCompraEmAberto("f1", [compra1000], [pag400])).toBe(true);
  });
  it("é falso quando todas as compras estão quitadas", () => {
    expect(temCompraEmAberto("f1", [compra1000], [pag1000])).toBe(false);
  });
  it("ajuste em aberto não conta como compra em aberto", () => {
    expect(temCompraEmAberto("f1", [ajuste6500], [])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run lib/fornecedores.test.ts`. Esperado: FAIL.

- [ ] **Step 3: Implement `temCompraEmAberto` em `lib/fornecedores.ts`**

- [ ] **Step 4: Run test to verify it passes** — `npx vitest run lib/fornecedores.test.ts`. Esperado: PASS.

- [ ] **Step 5: Criar `PagamentoFornecedorModal.tsx`**

Lista os itens em aberto do fornecedor — compras e a dívida informada por ajuste — **do mais antigo para o mais novo**, com o quanto falta de cada um, e o usuário escolhe o que está quitando (pré-seleciona o mais antigo). Depois, os campos de sempre: valor, data, conta (`ContaSelect`), forma de pagamento.

O que o envio faz depende da escolha:
- **Compra escolhida** → chama `registrarPagamentoAction` de `app/lancamentos/pagamentoActions.ts`, que já existe e grava em `pagamentos`. **Não cria despesa nova** — a compra já contou no DRE no mês dela.
- **Dívida informada escolhida** → chama `registrarQuitacaoAction`, que cria um lançamento `despesa` com `movimento_fornecedor = 'quitacao'` e seu pagamento, pedindo também a categoria (é despesa do mês e precisa cair em algum lugar do DRE).

Texto curto no modal explicando a diferença, porque é ela que impede a dupla contagem.

- [ ] **Step 6: Implement `registrarQuitacaoAction` em `app/fornecedores/[id]/actions.ts`**

Cria lançamento e pagamento. Recusa, com mensagem em português, quando `temCompraEmAberto` for verdadeiro e a quitação não estiver quitando uma compra — é a trava do Review Focus 4. `idempotency_key` no lançamento. `revalidarPaginasFinanceiras()` no fim.

- [ ] **Step 7: A pergunta "compra ou pagamento" em `LancamentoModal.tsx`**

Quando `tipo === "despesa"` e um fornecedor estiver escolhido, aparece um par de opções: **compra nova** (padrão) ou **pagamento de dívida**. O campo vai no `formData` como `movimento_fornecedor`. Não aparece em série (parcelada ou fixa): série é sempre compra — ninguém parcela a quitação de uma dívida que já existe.

- [ ] **Step 8: Levar a marcação até o banco em `app/lancamentos/actions.ts`**

`salvarLancamentoAction` acrescenta `movimento_fornecedor` ao `input` (padrão `"compra"` quando não houver fornecedor). Antes de criar, se a marcação for `"quitacao"` e `temCompraEmAberto` for verdadeiro, devolver erro de validação **como valor, não como exceção** — o Next redige mensagem de server action em produção, e esta precisa ser lida: dizer quantas compras estão em aberto e mandar quitá-las pela tela do fornecedor.

- [ ] **Step 9: Verificar** — `npm test && npm run build`. Esperado: PASS e build limpo.

- [ ] **Step 10: Commit**

```bash
git add app/fornecedores app/lancamentos lib/fornecedores.ts lib/fornecedores.test.ts
git commit -m "feat(fornecedores): pagar dívida pela tela do fornecedor"
```

---

## Ordem e dependências

1 e 2 são independentes de tudo. 3 habilita 4. 3 e 5 habilitam 6, 7 e 8. A ordem natural é 3 → 4 → 5 → 6 → 7 → 8, com 1 e 2 em qualquer ponto.

As migrações `0022` e `0023` precisam estar aplicadas ao banco antes do deploy do código das Tarefas 4 e 6 em diante.
