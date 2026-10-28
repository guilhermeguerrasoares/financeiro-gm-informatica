-- O fornecedor passa a funcionar como uma conta: dá para ver quanto se deve a
-- ele, há quanto tempo, e pagar por ali. O saldo devedor é uma soma só, feita
-- de três tipos de linha que moram todas em `lancamentos`:
--
--   saldo devedor = compras em aberto + ajustes - quitações
--
-- Nada disso em tabela paralela de propósito: um saldo de fornecedor mantido à
-- parte diverge dos lançamentos em algumas semanas, e aí nenhum dos dois
-- números serve para decidir pagamento.
--
-- ATENÇÃO: aplique esta migração ANTES do deploy do código que a usa. Ela só
-- adiciona, e a coluna nova já nasce com o valor certo para tudo que existe.

create type movimento_fornecedor as enum ('compra', 'ajuste', 'quitacao');

-- `not null default 'compra'` de propósito: todos os ~418 lançamentos que já
-- existem são compras - é o que eles são - e entram no saldo devedor como
-- tais, sem backfill nenhum.
alter table lancamentos
  add column if not exists movimento_fornecedor movimento_fornecedor not null default 'compra';

comment on column lancamentos.movimento_fornecedor is
  'Papel da linha na dívida com o fornecedor. compra: soma pelo que falta pagar. ajuste: dívida informada sem compra lançada, nunca tem pagamento, fica fora de caixa, DRE, metas, fluxo e dos cards do dashboard. quitacao: pagamento de dívida informada, abate sem somar e conta como despesa do mês.';

-- Ajuste e quitação sem fornecedor não querem dizer nada: as duas só existem
-- em relação a alguém a quem se deve.
alter table lancamentos
  add constraint movimento_fornecedor_exige_fornecedor
  check (movimento_fornecedor = 'compra' or fornecedor_id is not null);

create index if not exists idx_lancamentos_movimento_fornecedor
  on lancamentos(fornecedor_id, movimento_fornecedor) where fornecedor_id is not null;

-- Conciliação da dívida: o dono informa quanto deve de verdade e o sistema
-- grava a diferença entre o que achava e o que foi informado, com data. O
-- número não pula sozinho - fica registrado quando e quanto mudou. Mesmo
-- desenho de registrar_ajuste_saldo (0013), que faz isso com o saldo de conta.
--
-- Sem pagamento nenhum, e esse é o ponto: reconhecer que se deve R$ 6.500 não
-- é gastar R$ 6.500. Não houve entrada nem saída, então nada disso pode tocar
-- em saldo de conta, faturamento, DRE, metas ou fluxo.
--
-- Vencimento nulo também é decisão, não descuido: ajuste não vence. É o que o
-- mantém fora de "atrasado" e, portanto, dos cards do dashboard - senão o
-- card de atraso do dono mudaria de valor no dia em que ele informasse a
-- dívida, sem nada ter vencido.
create function registrar_ajuste_divida_fornecedor(
  p_fornecedor_id uuid,
  p_data date,
  p_diferenca numeric,
  p_observacao text,
  p_idempotency_key uuid
) returns uuid
language plpgsql
as $$
declare
  v_lancamento_id uuid;
begin
  if p_fornecedor_id is null then
    raise exception 'Informe o fornecedor cuja dívida está sendo ajustada.';
  end if;

  -- Meio centavo: abaixo disso não há diferença real a registrar, e gravar um
  -- ajuste de zero só sujaria o histórico.
  if abs(coalesce(p_diferenca, 0)) < 0.005 then
    raise exception 'A dívida informada já é igual à dívida do sistema: não há nada para ajustar.';
  end if;

  -- created_at carrega a data escolhida, ancorada ao meio-dia UTC: é dela que
  -- saem a posição do ajuste no histórico e a contagem de dias da tela, que
  -- leem created_at com dataLocal() em America/Sao_Paulo. Meia-noite UTC
  -- cairia na véspera lá - mesma escolha da migração 0020.
  insert into lancamentos (
    descricao, tipo, fornecedor_id, valor, vencimento, competencia,
    observacao, movimento_fornecedor, idempotency_key, created_at
  ) values (
    'Ajuste de dívida',
    -- Cast explícito: o `case` devolve text e a coluna é do enum
    -- tipo_lancamento. Diferença negativa vira receita, que é como o ajuste
    -- diminui a dívida - mesmo uso de sinal da 0013.
    (case when p_diferenca > 0 then 'despesa' else 'receita' end)::tipo_lancamento,
    p_fornecedor_id,
    abs(p_diferenca),
    null,
    to_char(p_data, 'YYYY-MM'),
    nullif(trim(coalesce(p_observacao, '')), ''),
    'ajuste',
    p_idempotency_key,
    p_data::timestamp + interval '12 hours'
  ) returning id into v_lancamento_id;

  return v_lancamento_id;
end;
$$;

-- Pagamento de dívida informada: "paguei R$ 2.000 pro Carlos" quando a dívida
-- dele não está lançada compra a compra. Sai dinheiro de uma conta, conta
-- como despesa do mês - porque aquela compra nunca foi lançada e portanto
-- nunca bateu no DRE - e abate o saldo devedor sem somar nele.
--
-- Lançamento e pagamento numa função só, que é a transação: uma quitação sem
-- o pagamento seria uma despesa que não abateu dívida nenhuma, e um pagamento
-- sem o lançamento tiraria dinheiro da conta sem explicação.
create function registrar_quitacao_divida_fornecedor(
  p_fornecedor_id uuid,
  p_data date,
  p_valor numeric,
  p_conta_financeira_id uuid,
  p_categoria_id uuid,
  p_forma_pagamento forma_pagamento,
  p_observacao text,
  p_idempotency_key uuid
) returns uuid
language plpgsql
as $$
declare
  v_lancamento_id uuid;
begin
  if p_fornecedor_id is null then
    raise exception 'Informe o fornecedor que está sendo pago.';
  end if;
  if coalesce(p_valor, 0) < 0.005 then
    raise exception 'Informe um valor maior que zero.';
  end if;
  if p_conta_financeira_id is null then
    raise exception 'Escolha a conta de onde saiu o dinheiro.';
  end if;

  -- A trava que impede a dupla contagem. Se existe compra lançada e ainda em
  -- aberto com este fornecedor, o pagamento tem que ser baixa NELA: a compra
  -- já bateu no DRE no mês dela, pelo valor cheio, paga ou não. Uma quitação
  -- por cima contaria a mesma despesa duas vezes - e deixaria a compra
  -- envelhecendo na lista "em aberto" enquanto o "quanto devo" do topo já
  -- teria descido, a tela discordando dela mesma.
  if exists (
    select 1
    from lancamentos l
    where l.fornecedor_id = p_fornecedor_id
      and l.movimento_fornecedor = 'compra'
      and l.valor - coalesce((select sum(p.valor) from pagamentos p where p.lancamento_id = l.id), 0) > 0.004
  ) then
    raise exception 'Este fornecedor tem compras lançadas ainda em aberto. Dê baixa nelas em vez de registrar um pagamento solto, senão a mesma despesa conta duas vezes.';
  end if;

  insert into lancamentos (
    descricao, tipo, fornecedor_id, categoria_id, valor, vencimento, competencia,
    observacao, movimento_fornecedor, idempotency_key, created_at
  ) values (
    'Pagamento de dívida',
    'despesa',
    p_fornecedor_id,
    p_categoria_id,
    p_valor,
    p_data,
    to_char(p_data, 'YYYY-MM'),
    nullif(trim(coalesce(p_observacao, '')), ''),
    'quitacao',
    p_idempotency_key,
    p_data::timestamp + interval '12 hours'
  ) returning id into v_lancamento_id;

  insert into pagamentos (lancamento_id, valor, forma_pagamento, data_pagamento, conta_financeira_id)
  values (v_lancamento_id, p_valor, p_forma_pagamento, p_data, p_conta_financeira_id);

  return v_lancamento_id;
end;
$$;

-- O ajuste não é conta a pagar: ele AFIRMA a dívida, e quem a paga é uma
-- quitação. Um pagamento registrado direto nele tiraria o dinheiro do saldo
-- da conta - lib/saldos.ts conta qualquer pagamento, sem olhar o tipo da
-- linha - sem abater um centavo da dívida, porque o ajuste entra no saldo
-- devedor pelo valor, não pelo que foi pago. Dinheiro sumiria do caixa e a
-- dívida ficaria igual.
--
-- E converter um ajuste em compra pela edição comum transforma um ajuste que
-- DIMINUIU a dívida - gravado como receita - em faturamento que nunca
-- existiu, entrando no DRE e no denominador de toda meta percentual.
--
-- As telas já escondem os dois caminhos, mas quem precisa recusar é o banco,
-- porque é o único ponto por onde todos eles passam - mesmo raciocínio da
-- 0021 e da 0022.
create function proteger_ajuste_divida() returns trigger
language plpgsql
as $$
declare
  v_movimento movimento_fornecedor;
begin
  if tg_table_name = 'pagamentos' then
    select movimento_fornecedor into v_movimento
    from lancamentos where id = new.lancamento_id;

    if v_movimento = 'ajuste' then
      raise exception 'Ajuste de dívida não recebe pagamento: ele apenas informa quanto você deve. Registre o pagamento pela tela do fornecedor, que abate a dívida e lança a despesa do mês.';
    end if;
    return new;
  end if;

  -- lancamentos
  if old.movimento_fornecedor = 'ajuste' and new.movimento_fornecedor <> 'ajuste' then
    raise exception 'Esta linha é um ajuste de dívida com fornecedor e não pode virar compra: ela não representa dinheiro que entrou ou saiu. Exclua-a e informe a dívida de novo, se for o caso.';
  end if;
  return new;
end;
$$;

create trigger trg_pagamentos_ajuste_protegido
  before insert or update on pagamentos
  for each row execute function proteger_ajuste_divida();

create trigger trg_lancamentos_ajuste_protegido
  before update on lancamentos
  for each row execute function proteger_ajuste_divida();

alter function proteger_ajuste_divida() set search_path = public, pg_temp;
alter function registrar_ajuste_divida_fornecedor(uuid, date, numeric, text, uuid)
  set search_path = public, pg_temp;
alter function registrar_quitacao_divida_fornecedor(uuid, date, numeric, uuid, uuid, forma_pagamento, text, uuid)
  set search_path = public, pg_temp;

-- Sem `security definer`, como as demais: roda como quem chamou, então as
-- policies da 0009 continuam valendo e viewer não grava.
