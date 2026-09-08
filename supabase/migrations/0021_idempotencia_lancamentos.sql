-- Trava contra lançamento duplicado por envio repetido do formulário.
--
-- O que aconteceu na prática: três pares de registros nasceram com 0,82s,
-- 0,97s e 1,02s de diferença — inclusive duas séries "Pro-labore" inteiras,
-- 24 lançamentos de R$ 15.000. Uma delas foi paga duas vezes e inflou o saldo
-- da conta em R$ 4.382,87, que depois virou ajuste de conciliação à mão.
--
-- O `disabled` do botão no formulário não fecha o caso: Enter dentro de
-- qualquer campo reenvia o form com o botão desabilitado, e uma reconexão do
-- navegador pode repetir o POST sem clique nenhum. Quem precisa recusar o
-- segundo envio é o banco, porque é o único ponto por onde todos os caminhos
-- passam.
--
-- A chave nasce no cliente quando o modal abre e morre quando ele fecha, então
-- ela identifica "este preenchimento do formulário", não a linha. Reenviar o
-- mesmo preenchimento é no-op; preencher de novo, de propósito, gera chave
-- nova e cria o segundo lançamento — que é o certo, porque duas vendas iguais
-- no mesmo dia existem de verdade.

alter table lancamentos add column if not exists idempotency_key uuid;
alter table series_lancamentos add column if not exists idempotency_key uuid;

comment on column lancamentos.idempotency_key is
  'Identifica o preenchimento do formulário que criou esta linha. Único: o segundo envio do mesmo preenchimento é recusado pelo banco.';

-- Parcial: as 418 linhas que já existem ficam com a coluna nula, e nulo não
-- colide com nulo num índice único.
create unique index if not exists idx_lancamentos_idempotency
  on lancamentos(idempotency_key) where idempotency_key is not null;

create unique index if not exists idx_series_idempotency
  on series_lancamentos(idempotency_key) where idempotency_key is not null;

-- Rede de segurança independente da chave acima: dentro de uma série, o par
-- (série, ordinal) é único por definição. Pega qualquer caminho que tente
-- gravar a mesma parcela duas vezes — inclusive duas execuções simultâneas do
-- reabastecimento, que hoje leem o último ordinal antes de qualquer uma
-- gravar (`ultimoOrdinalPorSerie` + `inserirOcorrencias` não são atômicos).
create unique index if not exists idx_lancamentos_serie_parcela
  on lancamentos(serie_id, parcela_numero) where serie_id is not null;


-- `criar_serie_lancamentos` passa a carimbar a chave na série.
--
-- Drop antes de recriar porque a assinatura muda: `create or replace` com
-- parâmetro novo criaria uma sobrecarga, e aí a chamada de 2 argumentos ficaria
-- ambígua. Com o `default null`, quem ainda chamar com 2 argumentos continua
-- funcionando.
drop function if exists criar_serie_lancamentos(jsonb, jsonb);

create function criar_serie_lancamentos(
  p_serie jsonb,
  p_ocorrencias jsonb,
  p_idempotency_key uuid default null
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_serie_id uuid;
begin
  if p_ocorrencias is null or jsonb_array_length(p_ocorrencias) = 0 then
    raise exception 'Uma série precisa de pelo menos uma ocorrência.';
  end if;

  -- Reenvio do mesmo formulário: devolve a série que já nasceu, sem criar as
  -- 12 ocorrências de novo. Silencioso de propósito — para quem está na tela,
  -- o pedido foi atendido; era só a segunda cópia do mesmo pedido.
  if p_idempotency_key is not null then
    select id into v_serie_id
    from series_lancamentos where idempotency_key = p_idempotency_key;
    if found then
      return v_serie_id;
    end if;
  end if;

  insert into series_lancamentos (
    tipo_serie, frequencia, data_inicio, total_parcelas,
    descricao, tipo, categoria_id, cliente_id, fornecedor_id, valor, custo, observacao,
    idempotency_key
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
    nullif(p_serie->>'observacao', ''),
    p_idempotency_key
  )
  -- Dois envios simultâneos passam os dois pelo select acima antes de qualquer
  -- insert; aqui o índice único decide, e o perdedor não cria nada.
  on conflict (idempotency_key) where idempotency_key is not null do nothing
  returning id into v_serie_id;

  if v_serie_id is null then
    select id into v_serie_id
    from series_lancamentos where idempotency_key = p_idempotency_key;
    return v_serie_id;
  end if;

  perform inserir_ocorrencias_serie(v_serie_id, p_ocorrencias);

  return v_serie_id;
end;
$$;
