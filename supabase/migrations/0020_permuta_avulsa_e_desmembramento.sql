-- Duas lacunas da tela /permutas, que até aqui só sabia vender item que já
-- existia:
--
-- 1) Uma venda paga em permuta com DOIS aparelhos entrava como um item só
--    ("Notebook + Monitor"), porque o formulário de pagamento tem um campo de
--    descrição apenas. Depois não dava para vender um e segurar o outro.
-- 2) Item que entrou fora de uma venda (peguei em troca de algo, com ou sem
--    dinheiro por cima) não tinha por onde ser cadastrado.
--
-- ATENÇÃO: aplique esta migração ANTES do deploy do código que a chama
-- (lib/queries/itensPermuta.ts). Ela só adiciona - nenhum fluxo existente
-- passa a depender dela, então o código antigo continua funcionando.

-- Item avulso não nasce de pagamento nenhum: não houve venda por trás dele.
-- A coluna continua sendo a origem de todo item vindo de venda, e o
-- "on delete cascade" segue valendo para esses.
alter table itens_permuta alter column pagamento_id drop not null;

-- Separa um item de estoque em dois, sem mexer no total recebido em permuta:
-- o valor do item novo é subtraído do original, e os dois ficam pendurados no
-- MESMO pagamento, com a mesma data de entrada. Numa transação só, senão uma
-- falha no meio duplicaria ou sumiria com valor de estoque.
create function desmembrar_item_permuta(
  p_item_id uuid,
  p_descricao_original text,
  p_nova_descricao text,
  p_novo_valor numeric
) returns uuid
language plpgsql
as $$
declare
  v_original itens_permuta%rowtype;
  v_novo_id uuid;
begin
  if coalesce(trim(p_descricao_original), '') = '' or coalesce(trim(p_nova_descricao), '') = '' then
    raise exception 'Informe a descrição dos dois itens.';
  end if;

  -- Todas as travas no WHERE do próprio update: assim duas abas desmembrando
  -- o mesmo item não conseguem passar as duas pela checagem antes de gravar.
  -- O `returning` traz a linha JÁ atualizada, de onde saem o pagamento de
  -- origem e a data de entrada que o item novo herda.
  update itens_permuta
  set descricao = p_descricao_original,
      valor_estimado = valor_estimado - p_novo_valor
  where id = p_item_id
    and status = 'em_estoque'
    and valor_estimado is not null
    and p_novo_valor > 0.004
    and valor_estimado - p_novo_valor > 0.004
  returning * into v_original;

  if not found then
    raise exception 'Não foi possível desmembrar: o item precisa estar em estoque e o valor separado precisa ser maior que zero e menor que o valor estimado do item.';
  end if;

  insert into itens_permuta (pagamento_id, descricao, valor_estimado, status, created_at)
  values (v_original.pagamento_id, p_nova_descricao, p_novo_valor, 'em_estoque', v_original.created_at)
  returning id into v_novo_id;

  return v_novo_id;
end;
$$;

-- Cadastra item de permuta que não veio de venda. Se saiu dinheiro por ele,
-- cria junto a despesa quitada na conta escolhida - na mesma transação, para
-- não existir item pago cujo dinheiro nunca saiu do saldo (nem o contrário).
create function criar_item_permuta_avulso(
  p_descricao text,
  p_valor_estimado numeric,
  p_data_entrada date,
  p_observacao text,
  p_valor_pago numeric,
  p_conta_financeira_id uuid,
  p_categoria_id uuid,
  p_forma_pagamento forma_pagamento
) returns uuid
language plpgsql
as $$
declare
  v_item_id uuid;
  v_lancamento_id uuid;
begin
  if coalesce(trim(p_descricao), '') = '' then
    raise exception 'Informe a descrição do item.';
  end if;
  -- Valor estimado zero é válido de propósito: item que entrou sem custo
  -- nenhum revende com lucro cheio, e é isso que o /permutas deve mostrar.
  if coalesce(p_valor_estimado, 0) < 0 or coalesce(p_valor_pago, 0) < 0 then
    raise exception 'Valores não podem ser negativos.';
  end if;
  if coalesce(p_valor_pago, 0) > 0.004 and p_conta_financeira_id is null then
    raise exception 'Escolha a conta de onde saiu o dinheiro pago pelo item.';
  end if;

  -- created_at é timestamptz e a tela lê ele com dataLocal() em
  -- America/Sao_Paulo (lib/format.ts). Meia-noite UTC cairia na véspera lá,
  -- então a data de entrada é ancorada ao meio-dia UTC - mesma escolha que
  -- addDias()/diffDias() fazem do lado do app.
  insert into itens_permuta (pagamento_id, descricao, valor_estimado, status, observacao, created_at)
  values (
    null,
    p_descricao,
    coalesce(p_valor_estimado, 0),
    'em_estoque',
    nullif(trim(coalesce(p_observacao, '')), ''),
    p_data_entrada::timestamp + interval '12 hours'
  )
  returning id into v_item_id;

  if coalesce(p_valor_pago, 0) > 0.004 then
    insert into lancamentos (descricao, tipo, categoria_id, valor, vencimento, competencia)
    values (
      'Compra de item de permuta: ' || p_descricao,
      'despesa',
      p_categoria_id,
      p_valor_pago,
      p_data_entrada,
      to_char(p_data_entrada, 'YYYY-MM')
    )
    returning id into v_lancamento_id;

    insert into pagamentos (lancamento_id, valor, forma_pagamento, data_pagamento, conta_financeira_id)
    values (v_lancamento_id, p_valor_pago, p_forma_pagamento, p_data_entrada, p_conta_financeira_id);
  end if;

  return v_item_id;
end;
$$;

-- Mesmo motivo da migração 0017: função sem search_path fixo resolve nomes
-- pelo search_path de quem chama, e o linter da Supabase acusa.
alter function desmembrar_item_permuta(uuid, text, text, numeric) set search_path = public, pg_temp;
alter function criar_item_permuta_avulso(text, numeric, date, text, numeric, uuid, uuid, forma_pagamento) set search_path = public, pg_temp;

-- Sem `security definer` de propósito: as duas rodam como o usuário que
-- chamou, então as policies da 0009 continuam valendo e só dono/gerente
-- conseguem gravar. Viewer bate na policy de insert/update e recebe erro.
