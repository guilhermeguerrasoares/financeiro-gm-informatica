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
  p_observacao text
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
    observacao, movimento_fornecedor, created_at
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
    p_data::timestamp + interval '12 hours'
  ) returning id into v_lancamento_id;

  return v_lancamento_id;
end;
$$;

alter function registrar_ajuste_divida_fornecedor(uuid, date, numeric, text)
  set search_path = public, pg_temp;

-- Sem `security definer`, como as demais: roda como quem chamou, então as
-- policies da 0009 continuam valendo e viewer não grava.
