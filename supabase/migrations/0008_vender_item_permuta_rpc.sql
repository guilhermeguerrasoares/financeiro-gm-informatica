-- Agrupa a venda de um item de permuta (criar lançamento + registrar
-- pagamento + dar baixa no estoque) numa única transação, para que uma
-- falha parcial não deixe registros financeiros órfãos nem permita vender
-- o mesmo item duas vezes. A checagem `status = 'em_estoque'` no update
-- funciona como trava contra duplo clique / duas abas.
create or replace function vender_item_permuta(
  p_item_id uuid,
  p_descricao text,
  p_valor numeric,
  p_custo numeric,
  p_data date,
  p_forma forma_pagamento,
  p_conta_financeira_id uuid,
  p_categoria_id uuid
) returns uuid
language plpgsql
as $$
declare
  v_lancamento_id uuid;
  v_linhas int;
begin
  -- custo = o que a peça valia quando entrou (valor_estimado) - assim a
  -- margem no /relatorios bate com o "Lucro em permutas" do dashboard.
  insert into lancamentos (
    descricao, tipo, categoria_id, conta_financeira_id, valor, custo, vencimento, competencia
  ) values (
    p_descricao, 'receita', p_categoria_id, p_conta_financeira_id, p_valor, p_custo, p_data, to_char(p_data, 'YYYY-MM')
  ) returning id into v_lancamento_id;

  insert into pagamentos (
    lancamento_id, valor, forma_pagamento, data_pagamento
  ) values (
    v_lancamento_id, p_valor, p_forma, p_data
  );

  update itens_permuta
  set status = 'revendido',
      data_venda = p_data,
      valor_venda = p_valor,
      lancamento_venda_id = v_lancamento_id
  where id = p_item_id and status = 'em_estoque';

  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    raise exception 'Item de permuta já foi vendido ou não existe mais em estoque.';
  end if;

  return v_lancamento_id;
end;
$$;
