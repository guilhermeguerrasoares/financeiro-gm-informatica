# Recorrência e Parcelamento de Lançamentos — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir lançar contas parceladas (N vezes, semanal/quinzenal/mensal) e contas fixas mensais que se repetem sozinhas, com edição e exclusão em escopo de série.

**Architecture:** Uma tabela `series_lancamentos` guarda a regra; cada lançamento gerado aponta para ela via `serie_id` + `parcela_numero`. A aritmética de datas e divisão de valores fica em `lib/series.ts` (funções puras, testadas em vitest); a escrita passa por RPCs no Postgres que inserem/alteram/apagam a série inteira numa transação só. Contas fixas são mantidas com 12 meses de antecedência por uma RPC idempotente disparada ao abrir a tela de Entradas e Saídas.

**Tech Stack:** Next.js 15 (App Router, server actions), React 19, TypeScript, Supabase (Postgres + RLS), vitest.

**Spec:** `docs/superpowers/specs/2026-09-01-recorrencia-parcelamento-design.md`

## Global Constraints

- Textos de interface em **português do Brasil**, no vocabulário da loja: "Entrada"/"Saída", não "receita"/"despesa"; "conta fixa", "parcelado".
- Dinheiro sempre via `round2()` de `lib/calculations.ts`. Nunca comparar dinheiro com `=== 0`; o projeto usa a tolerância de meio centavo (`> 0.004`).
- Datas são strings `"YYYY-MM-DD"`. Nunca usar `new Date()` cru para aritmética de calendário — usar os helpers de `lib/format.ts` (`hoje`, `addDias`, `ultimoDiaDoMes`), que são ancorados em `America/Sao_Paulo` / meio-dia UTC.
- Toda tabela nova recebe RLS no padrão de `supabase/migrations/0002_rls.sql`: acesso completo para usuário com perfil.
- Operações que gravam mais de uma linha dependente vão para RPC no Postgres, como `registrar_ajuste_saldo` (migração 0013) já faz.
- Migrações são numeradas em sequência e comentadas explicando **por que**, não o quê — seguir o tom de `0013_ajuste_saldo.sql`.
- Após qualquer mutação, chamar `revalidarPaginasFinanceiras()` de `app/lancamentos/revalidate.ts`.
- **Fixa é sempre mensal** nesta entrega (restrição de banco). Semanal/quinzenal existem apenas para parcelado.

---

### Task 1: Aritmética das séries (`lib/series.ts`)

Funções puras, sem banco. Tudo que o resto do plano usa para calcular datas e valores nasce aqui.

**Files:**
- Create: `lib/series.ts`
- Test: `lib/series.test.ts`

**Interfaces:**
- Consumes: `round2` de `lib/calculations.ts`; `ultimoDiaDoMes` de `lib/format.ts`
- Produces:
  - `type Frequencia = "semanal" | "quinzenal" | "mensal"`
  - `type TipoSerie = "parcelada" | "fixa"`
  - `type ModoValor = "total" | "parcela"`
  - `type Ocorrencia = { parcela_numero: number; vencimento: string; valor: number; custo: number | null }`
  - `proximaData(dataInicio: string, frequencia: Frequencia, ordinal: number): string`
  - `dividirValor(total: number, parcelas: number): number[]`
  - `valoresDaSerie(valor: number, parcelas: number, modo: ModoValor): number[]`
  - `montarOcorrencias(params: { dataInicio: string; frequencia: Frequencia; parcelas: number; valor: number; custo: number | null; modo: ModoValor }): Ocorrencia[]`
  - `ocorrenciasFaltantes(params: { dataInicio: string; frequencia: Frequencia; ultimoOrdinal: number; hoje: string; horizonteMeses?: number }): { parcela_numero: number; vencimento: string }[]`

- [ ] **Step 1: Escrever os testes que falham**

Criar `lib/series.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { round2 } from "./calculations";
import {
  proximaData,
  dividirValor,
  valoresDaSerie,
  montarOcorrencias,
  ocorrenciasFaltantes,
} from "./series";

describe("proximaData", () => {
  it("ordinal 0 é a própria data inicial", () => {
    expect(proximaData("2026-09-10", "mensal", 0)).toBe("2026-09-10");
  });

  it("avança 7 dias na semanal", () => {
    expect(proximaData("2026-09-10", "semanal", 1)).toBe("2026-09-17");
    expect(proximaData("2026-09-10", "semanal", 3)).toBe("2026-10-01");
  });

  it("avança 14 dias na quinzenal", () => {
    expect(proximaData("2026-09-10", "quinzenal", 2)).toBe("2026-10-08");
  });

  it("mantém o dia na mensal, atravessando o ano", () => {
    expect(proximaData("2026-09-10", "mensal", 1)).toBe("2026-10-10");
    expect(proximaData("2026-09-10", "mensal", 4)).toBe("2027-01-10");
  });

  it("trava no último dia quando o dia não existe no mês de destino", () => {
    expect(proximaData("2026-01-31", "mensal", 1)).toBe("2026-02-28");
    expect(proximaData("2026-01-31", "mensal", 3)).toBe("2026-04-30");
  });

  it("ancora na data inicial, não na ocorrência anterior", () => {
    // Vindo de 31/jan, fevereiro trava em 28. Março precisa voltar para 31 -
    // se ancorasse na data anterior, a série inteira viraria "dia 28".
    expect(proximaData("2026-01-31", "mensal", 2)).toBe("2026-03-31");
  });

  it("respeita ano bissexto", () => {
    expect(proximaData("2028-01-31", "mensal", 1)).toBe("2028-02-29");
  });
});

describe("dividirValor", () => {
  it("divide exato quando dá", () => {
    expect(dividirValor(1200, 3)).toEqual([400, 400, 400]);
  });

  it("joga os centavos na última parcela", () => {
    expect(dividirValor(1000, 3)).toEqual([333.33, 333.33, 333.34]);
  });

  it("a soma das parcelas sempre bate com o total", () => {
    const parcelas = dividirValor(99.99, 7);
    expect(round2(parcelas.reduce((a, b) => a + b, 0))).toBe(99.99);
  });
});

describe("valoresDaSerie", () => {
  it("modo total divide o valor entre as parcelas", () => {
    expect(valoresDaSerie(1200, 3, "total")).toEqual([400, 400, 400]);
  });

  it("modo parcela repete o valor em cada uma", () => {
    expect(valoresDaSerie(400, 3, "parcela")).toEqual([400, 400, 400]);
  });
});

describe("montarOcorrencias", () => {
  it("numera de 1 a N e casa data com valor", () => {
    const ocorrencias = montarOcorrencias({
      dataInicio: "2026-09-10",
      frequencia: "mensal",
      parcelas: 3,
      valor: 1200,
      custo: null,
      modo: "total",
    });

    expect(ocorrencias).toEqual([
      { parcela_numero: 1, vencimento: "2026-09-10", valor: 400, custo: null },
      { parcela_numero: 2, vencimento: "2026-10-10", valor: 400, custo: null },
      { parcela_numero: 3, vencimento: "2026-11-10", valor: 400, custo: null },
    ]);
  });

  it("divide o custo do mesmo jeito que o valor, para a margem do DRE bater mês a mês", () => {
    const ocorrencias = montarOcorrencias({
      dataInicio: "2026-09-10",
      frequencia: "mensal",
      parcelas: 2,
      valor: 1000,
      custo: 600,
      modo: "total",
    });

    expect(ocorrencias.map((o) => o.custo)).toEqual([300, 300]);
  });
});

describe("ocorrenciasFaltantes", () => {
  const regra = {
    dataInicio: "2026-01-10",
    frequencia: "mensal" as const,
    hoje: "2026-09-01",
    horizonteMeses: 12,
  };

  it("completa a série até 12 meses à frente", () => {
    // Ordinais 0..7 (jan..ago) já existem; a próxima é set/2026.
    const faltantes = ocorrenciasFaltantes({ ...regra, ultimoOrdinal: 7 });

    expect(faltantes[0]).toEqual({ parcela_numero: 9, vencimento: "2026-09-10" });
    // Horizonte é 01/09/2027, então 10/09/2027 já fica de fora.
    expect(faltantes[faltantes.length - 1]).toEqual({
      parcela_numero: 20,
      vencimento: "2027-08-10",
    });
  });

  it("é idempotente: rodar de novo com o horizonte coberto não gera nada", () => {
    const primeira = ocorrenciasFaltantes({ ...regra, ultimoOrdinal: 7 });
    const ultimoOrdinal = primeira[primeira.length - 1].parcela_numero - 1;

    expect(ocorrenciasFaltantes({ ...regra, ultimoOrdinal })).toEqual([]);
  });

  it("não ressuscita o passado quando a série ficou sem nenhum lançamento", () => {
    const faltantes = ocorrenciasFaltantes({ ...regra, ultimoOrdinal: -1 });

    expect(faltantes.length).toBeGreaterThan(0);
    expect(faltantes.every((o) => o.vencimento >= "2026-09-01")).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- lib/series.test.ts`
Expected: FAIL — `Failed to resolve import "./series"`

- [ ] **Step 3: Implementar `lib/series.ts`**

```ts
import { round2 } from "./calculations";
import { ultimoDiaDoMes } from "./format";

export type Frequencia = "semanal" | "quinzenal" | "mensal";
export type TipoSerie = "parcelada" | "fixa";
export type ModoValor = "total" | "parcela";

export type Ocorrencia = {
  parcela_numero: number;
  vencimento: string;
  valor: number;
  custo: number | null;
};

// Horizonte padrão de uma conta fixa: um ano à frente. Ver o spec, seção 5.
const HORIZONTE_MESES_PADRAO = 12;

// Trava de segurança do laço de reabastecimento. Nenhuma frequência real
// chega perto disso; existe só para uma regra corrompida não travar a tela.
const MAX_OCORRENCIAS = 1000;

// Soma meses a uma data "YYYY-MM-DD" grudando no último dia do mês de
// destino quando o dia não existe lá (31 de janeiro + 1 mês = 28/29 de
// fevereiro).
function addMeses(iso: string, meses: number): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const indiceMes = ano * 12 + (mes - 1) + meses;
  const mesAlvo = `${Math.floor(indiceMes / 12)}-${String((indiceMes % 12) + 1).padStart(2, "0")}`;
  const ultimoDia = Number(ultimoDiaDoMes(mesAlvo).slice(8, 10));
  return `${mesAlvo}-${String(Math.min(dia, ultimoDia)).padStart(2, "0")}`;
}

// Sempre calculada a partir de `dataInicio`, nunca da ocorrência anterior.
// Encadear a partir da anterior faria uma série que começa em 31/jan travar
// em "dia 28" para sempre, depois de passar por fevereiro.
export function proximaData(dataInicio: string, frequencia: Frequencia, ordinal: number): string {
  if (frequencia === "mensal") return addMeses(dataInicio, ordinal);
  const dias = frequencia === "semanal" ? 7 : 14;
  const d = new Date(`${dataInicio}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias * ordinal);
  return d.toISOString().slice(0, 10);
}

// A última parcela absorve a sobra de centavos, para a soma bater com o
// total exatamente. R$ 1.000 em 3x = 333,33 + 333,33 + 333,34.
export function dividirValor(total: number, parcelas: number): number[] {
  const base = round2(total / parcelas);
  const valores = Array.from({ length: parcelas }, () => base);
  valores[parcelas - 1] = round2(total - round2(base * (parcelas - 1)));
  return valores;
}

export function valoresDaSerie(valor: number, parcelas: number, modo: ModoValor): number[] {
  return modo === "total"
    ? dividirValor(valor, parcelas)
    : Array.from({ length: parcelas }, () => round2(valor));
}

export function montarOcorrencias({
  dataInicio,
  frequencia,
  parcelas,
  valor,
  custo,
  modo,
}: {
  dataInicio: string;
  frequencia: Frequencia;
  parcelas: number;
  valor: number;
  custo: number | null;
  modo: ModoValor;
}): Ocorrencia[] {
  const valores = valoresDaSerie(valor, parcelas, modo);
  // O custo segue o mesmo modo do valor: rateado quando o usuário informou o
  // total, repetido quando informou o de cada parcela. É o que mantém a
  // margem do DRE correta em cada mês, em vez de concentrar o CMV no primeiro.
  const custos = custo === null ? null : valoresDaSerie(custo, parcelas, modo);

  return valores.map((v, i) => ({
    parcela_numero: i + 1,
    vencimento: proximaData(dataInicio, frequencia, i),
    valor: v,
    custo: custos ? custos[i] : null,
  }));
}

// Só acrescenta ocorrências DEPOIS da última existente. Preencher buracos no
// meio recriaria justamente as parcelas que o usuário apagou à mão.
export function ocorrenciasFaltantes({
  dataInicio,
  frequencia,
  ultimoOrdinal,
  hoje,
  horizonteMeses = HORIZONTE_MESES_PADRAO,
}: {
  dataInicio: string;
  frequencia: Frequencia;
  ultimoOrdinal: number;
  hoje: string;
  horizonteMeses?: number;
}): { parcela_numero: number; vencimento: string }[] {
  const limite = addMeses(hoje, horizonteMeses);
  const faltantes: { parcela_numero: number; vencimento: string }[] = [];

  for (let ordinal = ultimoOrdinal + 1; faltantes.length < MAX_OCORRENCIAS; ordinal++) {
    const vencimento = proximaData(dataInicio, frequencia, ordinal);
    if (vencimento > limite) break;
    // Série que ficou sem nenhum lançamento recomeça de hoje: repovoar o
    // passado criaria contas vencidas que ninguém pediu.
    if (ultimoOrdinal < 0 && vencimento < hoje) continue;
    faltantes.push({ parcela_numero: ordinal + 1, vencimento });
  }

  return faltantes;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- lib/series.test.ts`
Expected: PASS — todos os testes verdes.

- [ ] **Step 5: Commit**

```bash
git add lib/series.ts lib/series.test.ts
git commit -m "feat: aritmética de datas e valores das séries de lançamentos"
```

---

### Task 2: Migração de banco (tabela, colunas, RLS e RPCs)

**Files:**
- Create: `supabase/migrations/0014_series_lancamentos.sql`

**Interfaces:**
- Consumes: enums `tipo_lancamento` (0001), padrão de RLS (0002), estilo de RPC (0013)
- Produces (chamadas via `supabase.rpc(...)` na Task 3):
  - `criar_serie_lancamentos(p_serie jsonb, p_ocorrencias jsonb) returns uuid`
  - `inserir_ocorrencias_serie(p_serie_id uuid, p_ocorrencias jsonb) returns int`
  - `atualizar_serie_lancamentos(p_lancamento_id uuid, p_alcance text, p_campos jsonb) returns jsonb` — `{"alterados": int, "pulados_pagos": int}`
  - `excluir_serie_lancamentos(p_lancamento_id uuid, p_alcance text) returns jsonb` — `{"excluidos": int, "pulados_pagos": int}`
- Colunas novas em `lancamentos`: `serie_id uuid`, `parcela_numero int`. Coluna `recorrencia` removida.

- [ ] **Step 1: Escrever a migração**

Criar `supabase/migrations/0014_series_lancamentos.sql`:

```sql
-- Séries de lançamentos: contas parceladas (N vezes) e contas fixas mensais.
--
-- A regra da série mora numa linha própria, e não replicada em cada
-- lançamento gerado, porque a conta fixa precisa continuar se reabastecendo
-- mesmo que todos os lançamentos dela sejam apagados. Guardar a regra dentro
-- das linhas geradas significaria perdê-la junto com elas.

create type tipo_serie_lancamento as enum ('parcelada', 'fixa');
create type frequencia_serie as enum ('semanal', 'quinzenal', 'mensal');

create table series_lancamentos (
  id uuid primary key default gen_random_uuid(),
  tipo_serie tipo_serie_lancamento not null,
  frequencia frequencia_serie not null,
  data_inicio date not null,
  total_parcelas int,
  -- Encerrar a recorrência é desligar esta flag, não apagar a linha: o
  -- histórico dos lançamentos já gerados continua apontando para ela.
  ativa boolean not null default true,

  -- Campos-modelo: é a partir daqui que as próximas ocorrências de uma conta
  -- fixa nascem, meses depois de a série ter sido criada.
  descricao text not null,
  tipo tipo_lancamento not null,
  categoria_id uuid references categorias(id) on delete set null,
  cliente_id uuid references clientes(id) on delete set null,
  fornecedor_id uuid references fornecedores(id) on delete set null,
  valor numeric(12,2) not null check (valor >= 0),
  custo numeric(12,2),
  observacao text,

  created_at timestamptz not null default now(),

  constraint parcelada_tem_total check (
    (tipo_serie = 'parcelada' and total_parcelas >= 2)
    or (tipo_serie = 'fixa' and total_parcelas is null)
  ),
  -- Fixa semanal/quinzenal está fora de escopo nesta entrega. A coluna
  -- `frequencia` já comporta: liberar depois é derrubar este check.
  constraint fixa_e_mensal check (
    tipo_serie <> 'fixa' or frequencia = 'mensal'
  )
);

-- `on delete set null`, nunca cascade: apagar a regra de uma série não pode
-- levar junto lançamentos que já foram pagos e já entraram no saldo.
alter table lancamentos
  add column serie_id uuid references series_lancamentos(id) on delete set null,
  add column parcela_numero int;

-- A coluna `recorrencia` (migração 0001) fica onde está, de propósito. O
-- código nunca a escreveu, mas 14 lançamentos importados do sistema antigo
-- trazem ali a marcação de quais contas da loja são fixas. Derrubá-la
-- apagaria justamente a informação que este recurso existe para tratar.
-- Quem passa a cumprir esse papel daqui em diante é `serie_id`; a coluna
-- antiga fica congelada como registro, até essas contas serem convertidas
-- em séries de verdade, uma a uma.

create index idx_lancamentos_serie on lancamentos(serie_id) where serie_id is not null;

alter table series_lancamentos enable row level security;

create policy "series_lancamentos: acesso completo para usuário com perfil"
  on series_lancamentos for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));


-- Série + todas as ocorrências numa transação só. Sem isso, uma falha no meio
-- deixaria um "4x" com 2 parcelas gravadas, e reenviar o formulário (que não
-- tem id para reaproveitar) criaria tudo de novo, duplicado.
create or replace function criar_serie_lancamentos(p_serie jsonb, p_ocorrencias jsonb)
returns uuid
language plpgsql
as $$
declare
  v_serie_id uuid;
begin
  if p_ocorrencias is null or jsonb_array_length(p_ocorrencias) = 0 then
    raise exception 'Uma série precisa de pelo menos uma ocorrência.';
  end if;

  insert into series_lancamentos (
    tipo_serie, frequencia, data_inicio, total_parcelas,
    descricao, tipo, categoria_id, cliente_id, fornecedor_id, valor, custo, observacao
  ) values (
    (p_serie->>'tipo_serie')::tipo_serie_lancamento,
    (p_serie->>'frequencia')::frequencia_serie,
    (p_serie->>'data_inicio')::date,
    nullif(p_serie->>'total_parcelas', '')::int,
    p_serie->>'descricao',
    (p_serie->>'tipo')::tipo_lancamento,
    nullif(p_serie->>'categoria_id', '')::uuid,
    nullif(p_serie->>'cliente_id', '')::uuid,
    nullif(p_serie->>'fornecedor_id', '')::uuid,
    (p_serie->>'valor')::numeric,
    nullif(p_serie->>'custo', '')::numeric,
    nullif(p_serie->>'observacao', '')
  ) returning id into v_serie_id;

  perform inserir_ocorrencias_serie(v_serie_id, p_ocorrencias);

  return v_serie_id;
end;
$$;


-- Insere ocorrências numa série existente, copiando os campos-modelo dela.
-- Usada tanto na criação quanto no reabastecimento da conta fixa.
create or replace function inserir_ocorrencias_serie(p_serie_id uuid, p_ocorrencias jsonb)
returns int
language plpgsql
as $$
declare
  v_serie series_lancamentos;
  v_inseridos int;
begin
  select * into v_serie from series_lancamentos where id = p_serie_id;
  if not found then
    raise exception 'Série % não encontrada.', p_serie_id;
  end if;

  if p_ocorrencias is null or jsonb_array_length(p_ocorrencias) = 0 then
    return 0;
  end if;

  insert into lancamentos (
    descricao, tipo, categoria_id, cliente_id, fornecedor_id,
    valor, custo, vencimento, competencia, observacao, serie_id, parcela_numero
  )
  select
    v_serie.descricao,
    v_serie.tipo,
    v_serie.categoria_id,
    v_serie.cliente_id,
    v_serie.fornecedor_id,
    -- O reabastecimento manda só data e número; nesse caso o valor vem do
    -- modelo da série, que é o valor "corrente" da conta fixa.
    coalesce(o.valor, v_serie.valor),
    coalesce(o.custo, v_serie.custo),
    o.vencimento,
    to_char(o.vencimento, 'YYYY-MM'),
    v_serie.observacao,
    p_serie_id,
    o.parcela_numero
  from jsonb_to_recordset(p_ocorrencias)
    as o(parcela_numero int, vencimento date, valor numeric, custo numeric);

  get diagnostics v_inseridos = row_count;
  return v_inseridos;
end;
$$;


-- Propaga uma edição para os outros lançamentos da série.
--
-- Lançamentos com pagamento registrado NUNCA são alterados: mexer no valor de
-- algo já baixado mudaria retroativamente saldo de conta, DRE e conciliação -
-- exatamente os números que precisam continuar batendo com o extrato.
create or replace function atualizar_serie_lancamentos(
  p_lancamento_id uuid,
  p_alcance text,
  p_campos jsonb
) returns jsonb
language plpgsql
as $$
declare
  v_serie_id uuid;
  v_parcela int;
  v_alcancados int;
  v_alterados int;
begin
  if p_alcance not in ('proximos', 'todos') then
    raise exception 'Alcance inválido: %. Use "proximos" ou "todos".', p_alcance;
  end if;

  select serie_id, parcela_numero into v_serie_id, v_parcela
  from lancamentos where id = p_lancamento_id;

  if v_serie_id is null then
    raise exception 'Este lançamento não faz parte de uma série.';
  end if;

  -- "Os próximos" é definido pela ordem da série, não pela data: o vencimento
  -- de uma ocorrência pode ter sido editado à mão e não serve de referência.
  with alvo as (
    select l.id, exists (
      select 1 from pagamentos p where p.lancamento_id = l.id
    ) as tem_pagamento
    from lancamentos l
    where l.serie_id = v_serie_id
      and (p_alcance = 'todos' or l.parcela_numero >= v_parcela)
  ),
  alterados as (
    update lancamentos l set
      descricao      = coalesce(nullif(p_campos->>'descricao', ''), l.descricao),
      categoria_id   = nullif(p_campos->>'categoria_id', '')::uuid,
      cliente_id     = nullif(p_campos->>'cliente_id', '')::uuid,
      fornecedor_id  = nullif(p_campos->>'fornecedor_id', '')::uuid,
      valor          = coalesce((p_campos->>'valor')::numeric, l.valor),
      custo          = nullif(p_campos->>'custo', '')::numeric,
      observacao     = nullif(p_campos->>'observacao', '')
    from alvo
    where l.id = alvo.id and not alvo.tem_pagamento
    returning l.id
  )
  select
    (select count(*) from alvo),
    (select count(*) from alterados)
  into v_alcancados, v_alterados;

  -- "Toda a série" também atualiza o modelo: sem isso os próximos 12 meses da
  -- conta fixa continuariam nascendo com o valor antigo.
  if p_alcance = 'todos' then
    update series_lancamentos set
      descricao     = coalesce(nullif(p_campos->>'descricao', ''), descricao),
      categoria_id  = nullif(p_campos->>'categoria_id', '')::uuid,
      cliente_id    = nullif(p_campos->>'cliente_id', '')::uuid,
      fornecedor_id = nullif(p_campos->>'fornecedor_id', '')::uuid,
      valor         = coalesce((p_campos->>'valor')::numeric, valor),
      custo         = nullif(p_campos->>'custo', '')::numeric,
      observacao    = nullif(p_campos->>'observacao', '')
    where id = v_serie_id;
  end if;

  return jsonb_build_object(
    'alterados', v_alterados,
    'pulados_pagos', v_alcancados - v_alterados
  );
end;
$$;


-- Exclui os lançamentos em aberto da série no alcance escolhido e encerra a
-- recorrência.
--
-- Encerrar é obrigatório: sem `ativa = false`, o reabastecimento recriaria na
-- próxima abertura da tela exatamente os lançamentos que acabaram de sumir.
create or replace function excluir_serie_lancamentos(
  p_lancamento_id uuid,
  p_alcance text
) returns jsonb
language plpgsql
as $$
declare
  v_serie_id uuid;
  v_parcela int;
  v_alcancados int;
  v_excluidos int;
begin
  if p_alcance not in ('proximos', 'todos') then
    raise exception 'Alcance inválido: %. Use "proximos" ou "todos".', p_alcance;
  end if;

  select serie_id, parcela_numero into v_serie_id, v_parcela
  from lancamentos where id = p_lancamento_id;

  if v_serie_id is null then
    raise exception 'Este lançamento não faz parte de uma série.';
  end if;

  with alvo as (
    select l.id, exists (
      select 1 from pagamentos p where p.lancamento_id = l.id
    ) as tem_pagamento
    from lancamentos l
    where l.serie_id = v_serie_id
      and (p_alcance = 'todos' or l.parcela_numero >= v_parcela)
  ),
  excluidos as (
    delete from lancamentos l
    using alvo
    where l.id = alvo.id and not alvo.tem_pagamento
    returning l.id
  )
  select
    (select count(*) from alvo),
    (select count(*) from excluidos)
  into v_alcancados, v_excluidos;

  update series_lancamentos set ativa = false where id = v_serie_id;

  return jsonb_build_object(
    'excluidos', v_excluidos,
    'pulados_pagos', v_alcancados - v_excluidos
  );
end;
$$;
```

- [ ] **Step 2: Aplicar a migração no Supabase**

Aplicar o conteúdo do arquivo no projeto Supabase (via SQL Editor do painel, ou `supabase db push` se a CLI estiver ligada ao projeto).

Expected: executa sem erro. `series_lancamentos` passa a existir e `lancamentos` não tem mais a coluna `recorrencia`.

- [ ] **Step 3: Conferir o resultado no banco**

Rodar no SQL Editor:

```sql
select column_name from information_schema.columns
where table_name = 'lancamentos' and column_name in ('serie_id', 'parcela_numero', 'recorrencia');

select count(recorrencia) as marcacoes_preservadas from lancamentos;
```

Expected: três linhas na primeira consulta (`serie_id`, `parcela_numero` e
`recorrencia`, que continua existindo), e `marcacoes_preservadas = 14` na
segunda — nenhuma marcação do sistema antigo pode ter se perdido.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0014_series_lancamentos.sql
git commit -m "feat: tabela e RPCs de séries de lançamentos"
```

---

### Task 3: Tipos e camada de consulta

**Files:**
- Create: `lib/queries/series.ts`
- Modify: `lib/types.ts`
- Modify: `lib/queries/lancamentos.ts`
- Modify: `lib/ltv.test.ts`, `lib/relatorios.test.ts`, `lib/metas-calc.test.ts` (fixtures)

**Interfaces:**
- Consumes: `Frequencia`, `TipoSerie`, `Ocorrencia` de `lib/series.ts` (Task 1); as RPCs da Task 2
- Produces:
  - `type SerieLancamento` em `lib/types.ts`
  - `LancamentoRow` sem `recorrencia`, com `serie_id: string | null` e `parcela_numero: number | null`
  - `listarSeries(): Promise<SerieLancamento[]>`
  - `criarSerie(serie, ocorrencias): Promise<string>`
  - `inserirOcorrencias(serieId, ocorrencias): Promise<number>`
  - `atualizarSerie(lancamentoId, alcance, campos): Promise<{ alterados: number; pulados_pagos: number }>`
  - `excluirSerie(lancamentoId, alcance): Promise<{ excluidos: number; pulados_pagos: number }>`

- [ ] **Step 1: Acrescentar os campos em `lib/types.ts`**

Em `LancamentoRow`, manter `recorrencia: string | null;` (a coluna continua no
banco, com a marcação importada do sistema antigo) e acrescentar logo abaixo:

```ts
  // Série a que este lançamento pertence (parcelamento ou conta fixa), e a
  // posição dele dentro dela. Null nos lançamentos avulsos, que são a maioria.
  serie_id: string | null;
  parcela_numero: number | null;
```

Ao final do arquivo, acrescentar:

```ts
export type SerieLancamento = {
  id: string;
  tipo_serie: "parcelada" | "fixa";
  frequencia: "semanal" | "quinzenal" | "mensal";
  data_inicio: string;
  total_parcelas: number | null;
  ativa: boolean;
  descricao: string;
  tipo: "despesa" | "receita";
  categoria_id: string | null;
  cliente_id: string | null;
  fornecedor_id: string | null;
  valor: number;
  custo: number | null;
  observacao: string | null;
};
```

- [ ] **Step 2: Rodar os testes e ver as fixtures quebrarem**

Run: `npx tsc --noEmit`
Expected: FAIL — erros em `lib/ltv.test.ts`, `lib/relatorios.test.ts` e `lib/metas-calc.test.ts`, que montam `LancamentoRow` completo à mão e ainda passam `recorrencia`.

- [ ] **Step 3: Corrigir as fixtures dos testes**

Nos três arquivos, acrescentar os dois campos novos logo depois de cada
`recorrencia: null,` (que permanece):

```ts
recorrencia: null, serie_id: null, parcela_numero: null,
```

- [ ] **Step 4: Criar `lib/queries/series.ts`**

```ts
import { createClient } from "@/lib/supabase/server";
import type { SerieLancamento } from "@/lib/types";
import type { Ocorrencia } from "@/lib/series";

export type CamposSerie = {
  tipo_serie: "parcelada" | "fixa";
  frequencia: "semanal" | "quinzenal" | "mensal";
  data_inicio: string;
  total_parcelas: number | null;
  descricao: string;
  tipo: "despesa" | "receita";
  categoria_id: string | null;
  cliente_id: string | null;
  fornecedor_id: string | null;
  valor: number;
  custo: number | null;
  observacao: string | null;
};

export async function listarSeries() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("series_lancamentos").select("*");
  if (error) throw error;
  return data as SerieLancamento[];
}

export async function listarSeriesFixasAtivas() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("series_lancamentos")
    .select("*")
    .eq("tipo_serie", "fixa")
    .eq("ativa", true);
  if (error) throw error;
  return data as SerieLancamento[];
}

// Maior `parcela_numero` já gravado em cada série fixa ativa. É o ponto de
// partida do reabastecimento: ele só acrescenta ocorrências depois da última.
export async function ultimoOrdinalPorSerie(serieIds: string[]) {
  if (serieIds.length === 0) return new Map<string, number>();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lancamentos")
    .select("serie_id, parcela_numero")
    .in("serie_id", serieIds);
  if (error) throw error;

  const ultimos = new Map<string, number>();
  for (const linha of data as { serie_id: string; parcela_numero: number | null }[]) {
    const ordinal = (linha.parcela_numero ?? 0) - 1;
    ultimos.set(linha.serie_id, Math.max(ultimos.get(linha.serie_id) ?? -1, ordinal));
  }
  return ultimos;
}

export async function criarSerie(serie: CamposSerie, ocorrencias: Ocorrencia[]) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("criar_serie_lancamentos", {
    p_serie: serie,
    p_ocorrencias: ocorrencias,
  });
  if (error) throw error;
  return data as string;
}

export async function inserirOcorrencias(
  serieId: string,
  ocorrencias: { parcela_numero: number; vencimento: string }[]
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("inserir_ocorrencias_serie", {
    p_serie_id: serieId,
    p_ocorrencias: ocorrencias,
  });
  if (error) throw error;
  return data as number;
}

export type ResultadoPropagacao = { alterados: number; pulados_pagos: number };

export async function atualizarSerie(
  lancamentoId: string,
  alcance: "proximos" | "todos",
  campos: Partial<CamposSerie>
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("atualizar_serie_lancamentos", {
    p_lancamento_id: lancamentoId,
    p_alcance: alcance,
    p_campos: campos,
  });
  if (error) throw error;
  return data as ResultadoPropagacao;
}

export async function excluirSerie(lancamentoId: string, alcance: "proximos" | "todos") {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("excluir_serie_lancamentos", {
    p_lancamento_id: lancamentoId,
    p_alcance: alcance,
  });
  if (error) throw error;
  return data as { excluidos: number; pulados_pagos: number };
}
```

- [ ] **Step 5: Proteger `serie_id` na atualização de lançamento**

Em `lib/queries/lancamentos.ts`, o comentário acima de `criarLancamento` já explica quais colunas ficam de fora de propósito. Acrescentar `serie_id`/`parcela_numero` a essa lista e ao `Omit`:

```ts
// `conta_financeira_id` fica de fora de propósito: a conta é escolhida na
// baixa (pagamentos.conta_financeira_id), não no lançamento. Incluí-la aqui
// era o que zerava a conta de um lançamento a cada edição.
// `ajuste_saldo` também: quem marca é a RPC registrar_ajuste_saldo, e um
// lançamento criado à mão nunca é uma conciliação.
// `serie_id`/`parcela_numero` idem: quem preenche é criar_serie_lancamentos.
// Um lançamento avulso nunca pertence a uma série, e uma edição normal não
// pode arrancar uma parcela da série dela.
// `recorrencia` é a marcação herdada do sistema antigo, congelada: o
// formulário não a escreve, para não apagá-la a cada edição.
export async function criarLancamento(
  input: Omit<
    LancamentoRow,
    | "id"
    | "conta_financeira_id"
    | "ajuste_saldo"
    | "recorrencia"
    | "serie_id"
    | "parcela_numero"
    | "created_at"
  >
) {
```

- [ ] **Step 6: Rodar testes e typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS nos dois — sem erros de tipo e todos os testes verdes.

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts lib/queries/series.ts lib/queries/lancamentos.ts lib/ltv.test.ts lib/relatorios.test.ts lib/metas-calc.test.ts
git commit -m "feat: tipos e consultas de séries de lançamentos"
```

---

### Task 4: Server actions

**Files:**
- Create: `app/lancamentos/serieActions.ts`
- Modify: `app/lancamentos/actions.ts`

**Interfaces:**
- Consumes: `montarOcorrencias`, `ocorrenciasFaltantes` (Task 1); `lib/queries/series.ts` (Task 3); `revalidarPaginasFinanceiras` de `app/lancamentos/revalidate.ts`
- Produces:
  - `reabastecerSeriesFixasAction(): Promise<number>` — total de ocorrências criadas
  - `salvarLancamentoAction(formData)` passa a ler os campos `repeticao`, `frequencia`, `total_parcelas`, `modo_valor` e `alcance`, e a devolver `{ lancamento, aviso }` onde `aviso: string | null`
  - `excluirLancamentoAction(id: string, alcance?: "este" | "proximos" | "todos"): Promise<string | null>` — devolve aviso ou null

- [ ] **Step 1: Criar `app/lancamentos/serieActions.ts`**

```ts
"use server";

import { hoje } from "@/lib/format";
import { ocorrenciasFaltantes } from "@/lib/series";
import {
  listarSeriesFixasAtivas,
  ultimoOrdinalPorSerie,
  inserirOcorrencias,
} from "@/lib/queries/series";
import { revalidarPaginasFinanceiras } from "./revalidate";

// Mantém toda conta fixa ativa com 12 meses de lançamentos à frente.
//
// Idempotente de propósito: `ocorrenciasFaltantes` só acrescenta o que vem
// depois da última ocorrência existente, então chamar isto a cada abertura da
// tela não duplica nada. É o que permite dispensar um agendador no servidor.
export async function reabastecerSeriesFixasAction(): Promise<number> {
  const series = await listarSeriesFixasAtivas();
  if (series.length === 0) return 0;

  const ultimos = await ultimoOrdinalPorSerie(series.map((s) => s.id));
  const hojeStr = hoje();
  let criadas = 0;

  for (const serie of series) {
    const faltantes = ocorrenciasFaltantes({
      dataInicio: serie.data_inicio,
      frequencia: serie.frequencia,
      ultimoOrdinal: ultimos.get(serie.id) ?? -1,
      hoje: hojeStr,
    });
    if (faltantes.length === 0) continue;
    criadas += await inserirOcorrencias(serie.id, faltantes);
  }

  if (criadas > 0) revalidarPaginasFinanceiras();
  return criadas;
}
```

- [ ] **Step 2: Tirar `recorrencia` do input (correção de bug)**

Em `app/lancamentos/actions.ts`, dentro do objeto `input` de `salvarLancamentoAction`,
apagar a linha:

```ts
    recorrencia: null,
```

O mesmo `input` alimenta `criarLancamento` e `atualizarLancamento`. Como está,
toda edição de lançamento grava `recorrencia = null` — ou seja, abrir a Energia
e mudar qualquer coisa apagaria a marcação `mensal` que veio do sistema antigo.
Tirando a chave daqui, um lançamento novo continua nascendo com null (o default
da coluna) e uma edição deixa o valor existente em paz.

E acrescentar `recorrencia` ao `Omit` de `criarLancamento`, em
`lib/queries/lancamentos.ts`, junto das outras colunas que o formulário não
controla.

- [ ] **Step 3: Ensinar `salvarLancamentoAction` a criar séries e a propagar edições**

Em `app/lancamentos/actions.ts`, acrescentar os imports:

```ts
import { montarOcorrencias, type Frequencia, type ModoValor } from "@/lib/series";
import { criarSerie, atualizarSerie, excluirSerie } from "@/lib/queries/series";
```

Logo depois de `const registrandoPagamento = ...`, inserir o desvio para a criação de série:

```ts
  const repeticao = (formData.get("repeticao") as string) || "nenhuma";

  // Criação de série é um caminho próprio: em vez de um lançamento, nascem N.
  // Só vale na criação - editar uma parcela nunca reconstrói a série.
  if (!id && repeticao !== "nenhuma") {
    return criarSerieDoFormulario(formData, repeticao as "parcelada" | "fixa");
  }
```

Antes de `export async function salvarLancamentoAction`, acrescentar a função auxiliar:

```ts
// 12 meses à frente numa conta fixa mensal. A parcelada usa o número de
// parcelas que o usuário digitou.
const MESES_CONTA_FIXA = 12;

async function criarSerieDoFormulario(formData: FormData, tipoSerie: "parcelada" | "fixa") {
  const vencimento = (formData.get("vencimento") as string) || "";
  if (!vencimento) {
    throw new Error("Informe o vencimento da primeira ocorrência para poder repetir o lançamento.");
  }

  const frequencia: Frequencia = tipoSerie === "fixa" ? "mensal" : ((formData.get("frequencia") as Frequencia) || "mensal");
  const totalParcelas = tipoSerie === "parcelada" ? Number(formData.get("total_parcelas")) : null;

  if (tipoSerie === "parcelada" && (!totalParcelas || totalParcelas < 2)) {
    throw new Error("Um lançamento parcelado precisa de pelo menos 2 parcelas.");
  }

  const valor = Number(formData.get("valor"));
  const custo = formData.get("custo") ? Number(formData.get("custo")) : null;
  // Na conta fixa o valor digitado é sempre o de cada mês - não há total a
  // dividir, porque a série não tem fim.
  const modo: ModoValor = tipoSerie === "fixa" ? "parcela" : ((formData.get("modo_valor") as ModoValor) || "total");

  const serie = {
    tipo_serie: tipoSerie,
    frequencia,
    data_inicio: vencimento,
    total_parcelas: totalParcelas,
    descricao: formData.get("descricao") as string,
    tipo: formData.get("tipo") as "despesa" | "receita",
    categoria_id: (formData.get("categoria_id") as string) || null,
    cliente_id: (formData.get("cliente_id") as string) || null,
    fornecedor_id: (formData.get("fornecedor_id") as string) || null,
    // O modelo guarda o valor de UMA ocorrência: é dele que as próximas
    // nascem. Guardar o total faria a conta fixa gerar meses de R$ 1.200 onde
    // deveriam ser R$ 400.
    valor: modo === "total" && totalParcelas ? round2(valor / totalParcelas) : valor,
    custo: modo === "total" && totalParcelas && custo !== null ? round2(custo / totalParcelas) : custo,
    observacao: (formData.get("observacao") as string) || null,
  };

  const ocorrencias = montarOcorrencias({
    dataInicio: vencimento,
    frequencia,
    parcelas: totalParcelas ?? MESES_CONTA_FIXA,
    valor,
    custo,
    modo,
  });

  await criarSerie(serie, ocorrencias);
  revalidarPaginasFinanceiras();
  return { lancamento: null, aviso: null };
}
```

Ainda em `salvarLancamentoAction`, logo após a linha que grava o lançamento, acrescentar a propagação:

```ts
  const lancamento = id ? await atualizarLancamento(id, input) : await criarLancamento(input);

  // Propagação para o resto da série. `vencimento` e `tipo` ficam de fora de
  // propósito: cada ocorrência tem a data dela, e trocar entrada por saída no
  // meio de uma série é erro de digitação, não intenção.
  const alcance = (formData.get("alcance") as string) || "este";
  let aviso: string | null = null;

  if (id && (alcance === "proximos" || alcance === "todos")) {
    const { alterados, pulados_pagos } = await atualizarSerie(id, alcance, {
      descricao: input.descricao,
      categoria_id: input.categoria_id,
      cliente_id: input.cliente_id,
      fornecedor_id: input.fornecedor_id,
      valor: input.valor,
      custo: input.custo,
      observacao: input.observacao,
    });
    if (pulados_pagos > 0) {
      aviso = `${alterados} lançamento(s) atualizado(s). ${pulados_pagos} já pago(s) não foram alterados.`;
    }
  }
```

Trocar o `return lancamento;` do final por `return { lancamento, aviso };`.

Acrescentar `round2` ao import que já existe de `@/lib/calculations` (já está importado no arquivo).

- [ ] **Step 4: Dar alcance à exclusão**

Ainda em `app/lancamentos/actions.ts`, trocar a assinatura de `excluirLancamentoAction`:

```ts
export async function excluirLancamentoAction(
  id: string,
  alcance: "este" | "proximos" | "todos" = "este"
): Promise<string | null> {
```

Logo depois das travas de permuta que já existem (`itemJaMovimentado` e `reverterItemPermutaPorLancamento`), antes do `await excluirLancamento(id)`, inserir:

```ts
  if (alcance === "proximos" || alcance === "todos") {
    const { excluidos, pulados_pagos } = await excluirSerie(id, alcance);
    revalidatePath("/permutas");
    revalidarPaginasFinanceiras();
    return pulados_pagos > 0
      ? `${excluidos} lançamento(s) excluído(s). ${pulados_pagos} já pago(s) foram mantidos.`
      : null;
  }
```

E fazer o caminho normal terminar com `return null;`.

- [ ] **Step 5: Typecheck e build**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS nos dois. `LancamentoModal.tsx` ainda não passa `alcance` nem lê o retorno novo — isso é resolvido nas Tasks 5 e 6; se o tsc reclamar do `return` mudado, é exatamente o ponto que a Task 6 conserta.

- [ ] **Step 6: Commit**

```bash
git add app/lancamentos/serieActions.ts app/lancamentos/actions.ts
git commit -m "feat: server actions de criação, propagação e reabastecimento de séries"
```

---

### Task 5: Bloco "Repetição" no modal de lançamento

**Files:**
- Create: `app/lancamentos/RepeticaoFields.tsx`
- Modify: `app/lancamentos/LancamentoModal.tsx`

**Interfaces:**
- Consumes: `montarOcorrencias`, tipos `Frequencia`/`ModoValor` de `lib/series.ts`; `money`, `formatDataBR` de `lib/format.ts`
- Produces: componente `<RepeticaoFields valor={number} vencimento={string} onRepeticaoChange={(r: "nenhuma" | "parcelada" | "fixa") => void} />`, que emite os campos de formulário `repeticao`, `frequencia`, `total_parcelas` e `modo_valor`. A prévia usa só o valor; o rateio do custo acontece no servidor, em `criarSerieDoFormulario`.

- [ ] **Step 1: Criar `app/lancamentos/RepeticaoFields.tsx`**

```tsx
"use client";

import { useState } from "react";
import { montarOcorrencias, type Frequencia, type ModoValor } from "@/lib/series";
import { money, formatDataBR } from "@/lib/format";

export type Repeticao = "nenhuma" | "parcelada" | "fixa";

// Quantos meses de uma conta fixa o sistema mantém sempre criados à frente.
const MESES_CONTA_FIXA = 12;

export function RepeticaoFields({
  valor,
  vencimento,
  onRepeticaoChange,
}: {
  valor: number;
  vencimento: string;
  onRepeticaoChange: (r: Repeticao) => void;
}) {
  const [repeticao, setRepeticao] = useState<Repeticao>("nenhuma");
  const [frequencia, setFrequencia] = useState<Frequencia>("mensal");
  const [parcelas, setParcelas] = useState(2);
  const [modo, setModo] = useState<ModoValor>("total");

  const previa =
    repeticao === "nenhuma" || !vencimento || valor <= 0
      ? []
      : montarOcorrencias({
          dataInicio: vencimento,
          frequencia: repeticao === "fixa" ? "mensal" : frequencia,
          parcelas: repeticao === "fixa" ? MESES_CONTA_FIXA : Math.max(parcelas, 2),
          valor,
          custo: null,
          modo: repeticao === "fixa" ? "parcela" : modo,
        });

  return (
    <div className="col-span-2 grid grid-cols-2 gap-3">
      <input type="hidden" name="repeticao" value={repeticao} />

      <div className={repeticao === "parcelada" ? "" : "col-span-2"}>
        <label className="block text-xs text-[var(--text-dim)] mb-1">Repetição</label>
        <select
          value={repeticao}
          onChange={(e) => {
            const nova = e.target.value as Repeticao;
            setRepeticao(nova);
            onRepeticaoChange(nova);
          }}
          className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
        >
          <option value="nenhuma">Não se repete</option>
          <option value="parcelada">Parcelado</option>
          <option value="fixa">Fixo mensal</option>
        </select>
      </div>

      {repeticao === "parcelada" && (
        <>
          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1">Nº de parcelas</label>
            <input
              type="number"
              min={2}
              name="total_parcelas"
              value={parcelas}
              onChange={(e) => setParcelas(Number(e.target.value) || 2)}
              className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1">Frequência</label>
            <select
              name="frequencia"
              value={frequencia}
              onChange={(e) => setFrequencia(e.target.value as Frequencia)}
              className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
            >
              <option value="mensal">Mensal</option>
              <option value="quinzenal">Quinzenal</option>
              <option value="semanal">Semanal</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1">O valor digitado é</label>
            <select
              name="modo_valor"
              value={modo}
              onChange={(e) => setModo(e.target.value as ModoValor)}
              className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
            >
              <option value="total">O total da compra</option>
              <option value="parcela">O valor de cada parcela</option>
            </select>
          </div>
        </>
      )}

      {previa.length > 0 && (
        <p className="col-span-2 text-xs text-[var(--text-dim)]">
          {repeticao === "fixa"
            ? `Todo dia ${vencimento.slice(8, 10)} — ${MESES_CONTA_FIXA} meses já criados (${formatDataBR(
                previa[0].vencimento
              )} a ${formatDataBR(previa[previa.length - 1].vencimento)}), renovando sozinho depois.`
            : `${previa.length} parcelas de ${money(previa[0].valor)}${
                previa[previa.length - 1].valor !== previa[0].valor
                  ? ` (a última de ${money(previa[previa.length - 1].valor)})`
                  : ""
              } — vencimentos ${previa.slice(0, 3).map((o) => formatDataBR(o.vencimento)).join(", ")}${
                previa.length > 3 ? "…" : ""
              }`}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Encaixar no `LancamentoModal`**

Em `app/lancamentos/LancamentoModal.tsx`:

Acrescentar o import e o estado:

```tsx
import { RepeticaoFields, type Repeticao } from "./RepeticaoFields";
```

```tsx
  const [vencimento, setVencimento] = useState(lancamento?.vencimento ?? "");
  const [repeticao, setRepeticao] = useState<Repeticao>("nenhuma");
```

No campo de vencimento, passar a controlar o valor e exigir preenchimento quando houver repetição:

```tsx
          <input
            type="date"
            name="vencimento"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
            required={repeticao !== "nenhuma"}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
```

Logo depois do bloco de Observação, e só na criação, inserir:

```tsx
        {!lancamento && (
          <RepeticaoFields
            valor={valorLancamento}
            vencimento={vencimento}
            onRepeticaoChange={setRepeticao}
          />
        )}
```

Trocar as duas condições que mostram o bloco de pagamento inline, de `{!lancamento && (` e `{!lancamento && pago && (` para:

```tsx
        {!lancamento && repeticao === "nenhuma" && (
```
```tsx
        {!lancamento && repeticao === "nenhuma" && pago && (
```

Esse é o ponto do spec em que "Já foi pago?" some quando há repetição: em uma compra de 3x, "já foi pago" não diz qual parcela foi quitada. A baixa é feita parcela a parcela, no botão "Pagar" da tabela.

- [ ] **Step 3: Ajustar o retorno da action no modal**

`salvarLancamentoAction` agora devolve `{ lancamento, aviso }`. No `action` do formulário, trocar a chamada por:

```tsx
            const { aviso } = await salvarLancamentoAction(formData);
            if (aviso) alert(aviso);
            onClose();
```

- [ ] **Step 4: Typecheck, lint e build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS nos três.

- [ ] **Step 5: Commit**

```bash
git add app/lancamentos/RepeticaoFields.tsx app/lancamentos/LancamentoModal.tsx
git commit -m "feat: bloco de repetição no modal de lançamento"
```

---

### Task 6: Diálogo de alcance ao editar e excluir

**Files:**
- Create: `app/lancamentos/AlcanceSerieDialog.tsx`
- Modify: `app/lancamentos/LancamentoModal.tsx`

**Interfaces:**
- Consumes: `LancamentoRow` (com `serie_id`), `SerieLancamento` de `lib/types.ts`
- Produces: componente `<AlcanceSerieDialog acao="editar" | "excluir" onEscolher={(a: "este" | "proximos" | "todos") => void} onCancelar={() => void} />`

- [ ] **Step 1: Criar `app/lancamentos/AlcanceSerieDialog.tsx`**

```tsx
"use client";

const OPCOES = [
  { valor: "este" as const, rotulo: "Só este lançamento" },
  { valor: "proximos" as const, rotulo: "Este e os próximos da série" },
  { valor: "todos" as const, rotulo: "Toda a série" },
];

export function AlcanceSerieDialog({
  acao,
  onEscolher,
  onCancelar,
}: {
  acao: "editar" | "excluir";
  onEscolher: (alcance: "este" | "proximos" | "todos") => void;
  onCancelar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={acao === "editar" ? "Alcance da edição" : "Alcance da exclusão"}
        className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <p className="text-sm font-semibold mb-1">
          Este lançamento faz parte de uma série.
        </p>
        <p className="text-xs text-[var(--text-dim)] mb-4">
          {acao === "editar" ? "Aplicar a alteração a:" : "Excluir:"} lançamentos já pagos não são
          afetados.
        </p>

        <div className="grid gap-2">
          {OPCOES.map((o) => (
            <button
              key={o.valor}
              type="button"
              onClick={() => onEscolher(o.valor)}
              className="w-full px-3 py-2 text-left text-sm rounded border border-[var(--border)] hover:bg-[var(--surface-2)]"
            >
              {o.rotulo}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCancelar}
          className="mt-3 w-full px-3 py-2 text-sm text-[var(--text-dim)]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Interceptar o salvar no `LancamentoModal`**

Acrescentar o import e o estado:

```tsx
import { AlcanceSerieDialog } from "./AlcanceSerieDialog";
```

```tsx
  const [perguntandoAlcance, setPerguntandoAlcance] = useState<"editar" | "excluir" | null>(null);
  // Segura o formulário já preenchido enquanto o diálogo de alcance está na
  // tela: a escolha do alcance vem depois do submit, mas antes de gravar.
  const [dadosPendentes, setDadosPendentes] = useState<FormData | null>(null);
  const ehSerie = Boolean(lancamento?.serie_id);
```

Extrair o corpo do `action` do formulário para uma função que aceita o alcance:

```tsx
  async function salvar(formData: FormData, alcance: "este" | "proximos" | "todos") {
    setErro(null);
    setEnviando(true);
    try {
      formData.set("alcance", alcance);
      const { aviso } = await salvarLancamentoAction(formData);
      if (aviso) alert(aviso);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o lançamento. Tente novamente.");
    } finally {
      setEnviando(false);
      setPerguntandoAlcance(null);
    }
  }
```

Trocar o `action` do `<form>` por:

```tsx
        action={async (formData) => {
          // Numa série, o alcance decide o que a edição atinge - por isso a
          // pergunta vem antes de gravar, não depois.
          if (ehSerie) {
            setDadosPendentes(formData);
            setPerguntandoAlcance("editar");
            return;
          }
          await salvar(formData, "este");
        }}
```

- [ ] **Step 3: Interceptar a exclusão**

Trocar o `onClick` do botão "Excluir lançamento" por:

```tsx
              onClick={async () => {
                if (ehSerie) {
                  setPerguntandoAlcance("excluir");
                  return;
                }
                if (!confirm(`Excluir "${lancamento.descricao}"? Essa ação não pode ser desfeita.`)) return;
                try {
                  await excluirLancamentoAction(lancamento.id);
                  onClose();
                } catch (e) {
                  setErro(e instanceof Error ? e.message : "Não foi possível excluir o lançamento. Tente novamente.");
                }
              }}
```

- [ ] **Step 4: Renderizar o diálogo**

Antes do `</Modal>` de fechamento, acrescentar:

```tsx
      {perguntandoAlcance && lancamento && (
        <AlcanceSerieDialog
          acao={perguntandoAlcance}
          onCancelar={() => {
            setPerguntandoAlcance(null);
            setDadosPendentes(null);
          }}
          onEscolher={async (alcance) => {
            if (perguntandoAlcance === "editar") {
              if (dadosPendentes) await salvar(dadosPendentes, alcance);
              setDadosPendentes(null);
              return;
            }
            try {
              const aviso = await excluirLancamentoAction(lancamento.id, alcance);
              if (aviso) alert(aviso);
              onClose();
            } catch (e) {
              setErro(e instanceof Error ? e.message : "Não foi possível excluir o lançamento. Tente novamente.");
            } finally {
              setPerguntandoAlcance(null);
            }
          }}
        />
      )}
```

- [ ] **Step 5: Typecheck, lint e build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS nos três.

- [ ] **Step 6: Commit**

```bash
git add app/lancamentos/AlcanceSerieDialog.tsx app/lancamentos/LancamentoModal.tsx
git commit -m "feat: diálogo de alcance ao editar e excluir uma série"
```

---

### Task 7: Tabela — sufixo "(2/4)", selo de recorrente e reabastecimento

**Files:**
- Modify: `app/lancamentos/page.tsx`
- Modify: `app/lancamentos/LancamentosTable.tsx`

**Interfaces:**
- Consumes: `listarSeries()` (Task 3), `reabastecerSeriesFixasAction()` (Task 4), `SerieLancamento` de `lib/types.ts`
- Produces: `LancamentosTable` passa a receber a prop `series: SerieLancamento[]`

- [ ] **Step 1: Carregar as séries na página**

Em `app/lancamentos/page.tsx`, acrescentar o import e a consulta ao `Promise.all` que já existe:

```ts
import { listarSeries } from "@/lib/queries/series";
```

```ts
  const [lancamentos, pagamentos, categorias, clientes, fornecedores, contas, series] = await Promise.all([
    listarLancamentos(),
    listarPagamentos(),
    listarCategorias(),
    listarClientes(),
    listarFornecedores(),
    listarContasFinanceiras(),
    listarSeries(),
  ]);
```

E repassar `series={series}` para `<LancamentosTable />`.

- [ ] **Step 2: Receber a prop e montar o índice de séries**

Em `app/lancamentos/LancamentosTable.tsx`, acrescentar `SerieLancamento` ao import
de `@/lib/types`, e `series` **nos dois lugares** da assinatura — na
desestruturação e no tipo das props:

```tsx
export function LancamentosTable({
  lancamentos,
  pagamentos,
  categorias,
  clientes,
  fornecedores,
  contas,
  series,
}: {
  lancamentos: LancamentoRow[];
  pagamentos: PagamentoRow[];
  categorias: Categoria[];
  clientes: Cliente[];
  fornecedores: Fornecedor[];
  contas: ContaFinanceira[];
  series: SerieLancamento[];
}) {
```

E, junto de `nomeCategoria`:

```tsx
  const serieDo = (l: LancamentoRow) =>
    l.serie_id ? series.find((s) => s.id === l.serie_id) ?? null : null;
```

- [ ] **Step 3: Exibir o sufixo e o selo**

Na célula de descrição, logo depois de `{lancamento.descricao}` e antes do selo de `ajuste_saldo`, inserir:

```tsx
                    {/* "(2/4)" é montado na hora a partir da série, não gravado
                        na descrição: assim editar o texto de uma parcela não
                        quebra a numeração das outras. */}
                    {(() => {
                      const serie = serieDo(lancamento);
                      if (!serie) return null;
                      if (serie.tipo_serie === "parcelada") {
                        return (
                          <span className="ml-2 text-xs text-[var(--text-dim)]">
                            ({lancamento.parcela_numero}/{serie.total_parcelas})
                          </span>
                        );
                      }
                      return (
                        <span
                          className="ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide border border-[var(--border)] text-[var(--text-dim)]"
                          title="Conta fixa mensal: o sistema mantém 12 meses criados à frente."
                        >
                          fixa
                        </span>
                      );
                    })()}
```

- [ ] **Step 4: Disparar o reabastecimento ao abrir a tela**

Acrescentar `useEffect` ao import de react que **já existe** no topo do arquivo —
uma segunda linha `import ... from "react"` quebraria o lint:

```tsx
import { Fragment, useEffect, useMemo, useState } from "react";
```

E acrescentar o import da action:

```tsx
import { reabastecerSeriesFixasAction } from "./serieActions";
```

Junto dos outros hooks do componente:

```tsx
  // Mantém as contas fixas com 12 meses à frente. Roda aqui, e não no
  // carregamento do server component, porque renderizar uma página não deve
  // gravar no banco - e uma escrita ali brigaria com o cache do App Router.
  // A action é idempotente, então rodar a cada abertura não duplica nada.
  useEffect(() => {
    reabastecerSeriesFixasAction().catch(() => {
      // Falhar aqui não pode derrubar a tela: os lançamentos já criados
      // continuam visíveis, e a próxima abertura tenta de novo.
    });
  }, []);
```

- [ ] **Step 5: Typecheck, lint e build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS nos três.

- [ ] **Step 6: Verificar no navegador**

Subir o dev server e, na tela de Entradas e Saídas:

1. Criar uma saída "Compra de peças", R$ 1.000, vencimento hoje, **Parcelado**, 3x, mensal, "o total da compra". Conferir a prévia mostrando 333,33 / 333,33 / 333,34 e, após salvar, três linhas `(1/3)`, `(2/3)`, `(3/3)` com esses valores.
2. Criar uma saída "Energia", R$ 450, vencimento dia 10, **Fixo mensal**. Conferir que aparecem 12 linhas com o selo "fixa".
3. Pagar a parcela `(1/3)` pelo botão "Pagar". Depois abrir a `(1/3)`, mudar o valor e escolher **Toda a série**: o aviso deve informar que 1 lançamento já pago não foi alterado, e as parcelas 2 e 3 devem exibir o valor novo.
4. Abrir uma linha da energia e excluir com **Este e os próximos**: as futuras somem e, ao recarregar a página, **não voltam** (a série foi encerrada).

- [ ] **Step 7: Commit**

```bash
git add app/lancamentos/page.tsx app/lancamentos/LancamentosTable.tsx
git commit -m "feat: identificação de parcelas e reabastecimento das contas fixas na tabela"
```
