-- Conciliação de conta: quando o saldo do sistema não bate com o extrato
-- real, o usuário informa o saldo verdadeiro e o sistema grava a diferença
-- como um lançamento datado. Assim dá para ver depois quando e quanto foi
-- ajustado, em vez de o número simplesmente mudar sozinho.
--
-- A flag fica no lançamento, e não numa categoria própria, porque todos os
-- cálculos já recebem os lançamentos - marcar aqui evita ter que carregar
-- categorias em cada um deles só para descobrir o que é ajuste.
alter table lancamentos
  add column if not exists ajuste_saldo boolean not null default false;

-- Um ajuste mexe no saldo da conta, mas NÃO é faturamento nem despesa
-- operacional: contá-lo no DRE, nas metas ou nas entradas/saídas do período
-- distorceria justamente os números que o ajuste deveria deixar confiáveis.
comment on column lancamentos.ajuste_saldo is
  'Lançamento de conciliação de conta: entra no saldo, fica fora de faturamento, metas, DRE e fluxo.';

create index if not exists idx_lancamentos_ajuste_saldo on lancamentos(ajuste_saldo) where ajuste_saldo;

-- Lançamento + pagamento numa transação só: um ajuste gravado pela metade
-- seria uma mentira sobre o saldo, exatamente o que ele existe para corrigir.
create or replace function registrar_ajuste_saldo(
  p_conta_financeira_id uuid,
  p_data date,
  p_diferenca numeric,
  p_observacao text
) returns uuid
language plpgsql
as $$
declare
  v_lancamento_id uuid;
begin
  if p_conta_financeira_id is null then
    raise exception 'Informe a conta que está sendo ajustada.';
  end if;

  -- Meio centavo: abaixo disso não há diferença real a registrar, e gravar
  -- um ajuste de zero só sujaria o extrato.
  if abs(coalesce(p_diferenca, 0)) < 0.005 then
    raise exception 'O saldo informado já é igual ao saldo do sistema: não há nada para ajustar.';
  end if;

  insert into lancamentos (
    descricao, tipo, valor, vencimento, competencia, observacao, ajuste_saldo
  ) values (
    'Ajuste de saldo',
    -- Cast explícito: o `case` devolve text, e a coluna é do enum
    -- tipo_lancamento - sem isso o insert falha em tempo de execução.
    (case when p_diferenca > 0 then 'receita' else 'despesa' end)::tipo_lancamento,
    abs(p_diferenca),
    p_data,
    to_char(p_data, 'YYYY-MM'),
    p_observacao,
    true
  ) returning id into v_lancamento_id;

  -- Sem forma de pagamento: não houve pix, dinheiro nem cartão - é uma
  -- correção contábil. O que importa é a conta e a data.
  insert into pagamentos (lancamento_id, valor, data_pagamento, conta_financeira_id)
  values (v_lancamento_id, abs(p_diferenca), p_data, p_conta_financeira_id);

  return v_lancamento_id;
end;
$$;
