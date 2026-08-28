-- A conta financeira estava só em `lancamentos`, mas o saldo de uma conta é
-- calculado somando os PAGAMENTOS dela. Como o formulário de lançamento
-- nunca teve o campo de conta, todo lançamento era gravado com
-- conta_financeira_id nulo e nenhum pagamento casava com nenhuma conta - o
-- saldo ficava congelado no saldo_inicial para sempre.
--
-- A conta passa a viver no pagamento, que é onde o dinheiro de fato entra ou
-- sai: dá para quitar uma conta metade em dinheiro e metade no banco, e cada
-- conta é debitada pela sua parte. `lancamentos.conta_financeira_id` deixa de
-- alimentar o saldo (a coluna fica, sem uso, para não perder o histórico).

alter table pagamentos
  add column if not exists conta_financeira_id uuid references contas_financeiras(id) on delete set null;

create index if not exists idx_pagamentos_conta_financeira on pagamentos(conta_financeira_id);

-- Backfill do histórico. Pagamento em permuta fica de fora de propósito: é
-- mercadoria entrando no estoque, não dinheiro em conta (só vira saldo
-- quando o item é revendido, e aí a venda gera o pagamento dela).
-- Prioridade: a conta que o lançamento já indicava; senão, a única conta
-- ativa cadastrada. Com duas ou mais contas ativas não há como adivinhar,
-- então o backfill não roda e a vinculação fica manual.
update pagamentos p
set conta_financeira_id = coalesce(
  l.conta_financeira_id,
  (select c.id from contas_financeiras c where c.ativo order by c.nome limit 1)
)
from lancamentos l
where l.id = p.lancamento_id
  and p.conta_financeira_id is null
  and coalesce(p.forma_pagamento::text, '') <> 'permuta'
  and (
    l.conta_financeira_id is not null
    or (select count(*) from contas_financeiras c where c.ativo) = 1
  );

-- A assinatura ganha p_conta_financeira_id. Precisa de drop em vez de
-- "create or replace" porque mudar a lista de parâmetros cria uma sobrecarga
-- nova, e duas versões deixariam a chamada do PostgREST ambígua.
drop function if exists registrar_pagamento_com_permuta(uuid, date, numeric, numeric, forma_pagamento, text, text, numeric);

create function registrar_pagamento_com_permuta(
  p_lancamento_id uuid,
  p_data_pagamento date,
  p_valor_caixa numeric,
  p_taxa numeric,
  p_forma_pagamento forma_pagamento,
  p_comprovante_url text,
  p_permuta_descricao text,
  p_valor_permuta numeric,
  p_conta_financeira_id uuid
) returns void
language plpgsql
as $$
declare
  v_pagamento_permuta_id uuid;
begin
  if p_valor_caixa > 0.004 then
    insert into pagamentos (
      lancamento_id, valor, taxa, forma_pagamento, data_pagamento, comprovante_url, conta_financeira_id
    )
    values (
      p_lancamento_id, p_valor_caixa, p_taxa, p_forma_pagamento, p_data_pagamento, p_comprovante_url,
      p_conta_financeira_id
    );
  end if;

  if p_valor_permuta > 0.004 and coalesce(p_permuta_descricao, '') <> '' then
    -- Sem conta: a parte em permuta não passa por conta nenhuma.
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

-- Mesma mudança na venda de permuta: a conta escolhida vai para o pagamento
-- (onde o dinheiro da venda cai), não mais para o lançamento.
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
    descricao, tipo, categoria_id, valor, custo, vencimento, competencia
  ) values (
    p_descricao, 'receita', p_categoria_id, p_valor, p_custo, p_data, to_char(p_data, 'YYYY-MM')
  ) returning id into v_lancamento_id;

  insert into pagamentos (
    lancamento_id, valor, forma_pagamento, data_pagamento, conta_financeira_id
  ) values (
    v_lancamento_id, p_valor, p_forma, p_data, p_conta_financeira_id
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

-- Ponte temporária para a janela de deploy: esta migração roda no banco antes
-- do código novo subir, e o código antigo ainda chama a RPC com 8 argumentos
-- (sem conta). Sem esta sobrecarga, TODO registro de pagamento em produção
-- quebraria até o deploy terminar. O PostgREST escolhe a versão pelo conjunto
-- de nomes enviados no corpo, então as duas convivem sem ambiguidade.
-- A versão antiga assume a única conta ativa, para que um pagamento feito
-- nessa janela ainda caia no saldo em vez de ficar solto.
-- Pode ser removida depois que o deploy do código novo estiver no ar.
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
begin
  perform registrar_pagamento_com_permuta(
    p_lancamento_id,
    p_data_pagamento,
    p_valor_caixa,
    p_taxa,
    p_forma_pagamento,
    p_comprovante_url,
    p_permuta_descricao,
    p_valor_permuta,
    (select c.id from contas_financeiras c where c.ativo order by c.nome limit 1)
  );
end;
$$;
