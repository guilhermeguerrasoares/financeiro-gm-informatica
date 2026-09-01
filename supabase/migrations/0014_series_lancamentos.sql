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
