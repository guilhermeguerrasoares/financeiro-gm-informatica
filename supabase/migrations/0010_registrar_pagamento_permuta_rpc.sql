-- ATENÇÃO: aplique esta migração ANTES de fazer deploy do código que a
-- chama (lib/queries/pagamentos.ts) - sem ela, TODO registro de pagamento
-- (não só em permuta) quebra, porque o app sempre chama esta RPC.
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
