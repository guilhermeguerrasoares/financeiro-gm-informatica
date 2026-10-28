-- Transferência entre contas: dinheiro que sai de um lugar da loja e entra em
-- outro - depósito do caixa no banco, envio de um banco para outro.
--
-- Ela não é receita nem despesa. Os R$ 1.000 não são faturamento quando chegam
-- no banco, nem prejuízo quando saem do caixa. Por isso as duas pernas carregam
-- `transferencia_id` e são excluídas de faturamento, metas, DRE e fluxo pelo
-- lado do app (lib/exclusoes.ts). Sem isso, cada depósito inflaria o
-- faturamento do mês.
--
-- ATENÇÃO: aplique esta migração ANTES do deploy do código que a chama
-- (lib/queries/transferencias.ts). Ela só adiciona - nenhum fluxo existente
-- passa a depender dela, então o código antigo continua funcionando.

-- Anulável de propósito: os lançamentos que já existem não são transferência,
-- e nulo é exatamente o que eles devem dizer.
alter table lancamentos add column if not exists transferencia_id uuid;

comment on column lancamentos.transferencia_id is
  'Liga as duas pernas de uma transferência entre contas (saída na origem, entrada no destino). As duas mexem em saldo e ficam fora de faturamento, metas, DRE e fluxo.';

create index if not exists idx_lancamentos_transferencia
  on lancamentos(transferencia_id) where transferencia_id is not null;

-- Marca de "estorno em andamento". É assim que o trigger abaixo distingue a
-- única porta de saída legítima (estornar_transferencia) de qualquer outro
-- caminho que tente apagar meia transferência. `set_config(..., true)` é local
-- à transação, então a marca morre junto com ela - não há como ficar ligada.
create function estorno_de_transferencia_em_andamento() returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.estornando_transferencia', true), '') = 'sim';
$$;

-- As duas pernas nascem e morrem juntas. Hoje existem três caminhos que
-- quebrariam o par sem nenhum aviso - editar o lançamento, excluí-lo e
-- estornar o pagamento de um lado só - e qualquer um deles tiraria dinheiro de
-- um saldo sem devolver no outro. Esconder botão resolve a tela, não os
-- caminhos; quem precisa recusar é o banco, porque é por onde todos passam
-- (mesmo raciocínio da 0021).
create function proteger_lancamento_de_transferencia() returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.transferencia_id is null then
      return old;
    end if;
    if estorno_de_transferencia_em_andamento() then
      return old;
    end if;
    raise exception 'Esta linha é uma das duas pernas de uma transferência entre contas. Excluir só uma delas tiraria dinheiro de um saldo sem devolver no outro. Use "Estornar transferência", que desfaz as duas de uma vez.';
  end if;

  -- UPDATE. A segunda condição também recusa carimbar `transferencia_id` num
  -- lançamento comum: isso o faria sumir dos relatórios sem que nada tivesse
  -- sido transferido.
  if old.transferencia_id is null and new.transferencia_id is null then
    return new;
  end if;
  if estorno_de_transferencia_em_andamento() then
    return new;
  end if;
  raise exception 'Esta linha é uma das duas pernas de uma transferência entre contas e não pode ser editada sozinha. Estorne a transferência inteira e registre de novo.';
end;
$$;

create trigger trg_lancamentos_transferencia_protegida
  before update or delete on lancamentos
  for each row execute function proteger_lancamento_de_transferencia();

-- Mesma proteção do lado do pagamento: é ele que move o saldo, então estornar
-- ou remanejar a baixa de uma perna só desequilibra a transferência mesmo com
-- os dois lançamentos de pé.
create function proteger_pagamento_de_transferencia() returns trigger
language plpgsql
as $$
declare
  v_transferencia uuid;
begin
  select transferencia_id into v_transferencia
  from lancamentos
  where id = (case tg_op when 'DELETE' then old.lancamento_id else new.lancamento_id end);

  if v_transferencia is null then
    return case tg_op when 'DELETE' then old else new end;
  end if;
  if estorno_de_transferencia_em_andamento() then
    return case tg_op when 'DELETE' then old else new end;
  end if;

  raise exception 'Este pagamento é uma das pernas de uma transferência entre contas. Mexer nele sozinho desequilibraria os saldos. Use "Estornar transferência".';
end;
$$;

create trigger trg_pagamentos_transferencia_protegida
  before update or delete on pagamentos
  for each row execute function proteger_pagamento_de_transferencia();

-- As duas pernas e as duas baixas numa função só, que é a transação: uma
-- transferência gravada pela metade sumiria com o dinheiro do saldo
-- consolidado. Mesmo cuidado que registrar_ajuste_saldo (0013) já toma.
create function registrar_transferencia(
  p_conta_origem_id uuid,
  p_conta_destino_id uuid,
  p_valor numeric,
  p_data date,
  p_observacao text,
  p_idempotency_key uuid
) returns uuid
language plpgsql
as $$
declare
  v_transferencia_id uuid := gen_random_uuid();
  v_origem contas_financeiras%rowtype;
  v_destino contas_financeiras%rowtype;
  v_descricao text;
  v_observacao text;
  v_saida uuid;
  v_entrada uuid;
begin
  if p_conta_origem_id is null or p_conta_destino_id is null then
    raise exception 'Escolha a conta de origem e a conta de destino.';
  end if;
  if p_conta_origem_id = p_conta_destino_id then
    raise exception 'Origem e destino são a mesma conta: não há transferência a registrar.';
  end if;
  -- Mesmo limiar do ajuste de saldo: abaixo de meio centavo não há movimento
  -- real a registrar.
  if coalesce(p_valor, 0) < 0.005 then
    raise exception 'Informe um valor maior que zero.';
  end if;

  select * into v_origem from contas_financeiras where id = p_conta_origem_id and ativo;
  if not found then
    raise exception 'A conta de origem não existe ou está inativa.';
  end if;
  select * into v_destino from contas_financeiras where id = p_conta_destino_id and ativo;
  if not found then
    raise exception 'A conta de destino não existe ou está inativa.';
  end if;

  v_descricao := 'Transferência: ' || v_origem.nome || ' → ' || v_destino.nome;
  v_observacao := nullif(trim(coalesce(p_observacao, '')), '');

  -- A chave de idempotência vai numa perna só: idx_lancamentos_idempotency
  -- (0021) é único por linha, então as duas pernas com a mesma chave fariam a
  -- própria transferência colidir consigo mesma. Na perna de saída porque é a
  -- que o formulário "manda fazer"; o reenvio do mesmo preenchimento bate no
  -- índice e aborta a transação inteira, sem deixar meia transferência.
  insert into lancamentos (
    descricao, tipo, valor, vencimento, competencia, observacao, transferencia_id, idempotency_key
  ) values (
    v_descricao, 'despesa', p_valor, p_data, to_char(p_data, 'YYYY-MM'),
    v_observacao, v_transferencia_id, p_idempotency_key
  ) returning id into v_saida;

  insert into lancamentos (
    descricao, tipo, valor, vencimento, competencia, observacao, transferencia_id
  ) values (
    v_descricao, 'receita', p_valor, p_data, to_char(p_data, 'YYYY-MM'),
    v_observacao, v_transferencia_id
  ) returning id into v_entrada;

  -- Sem forma de pagamento: não houve pix nem cartão, o dinheiro só mudou de
  -- lugar. O que importa é a conta e a data - é o pagamento que move o saldo
  -- (lib/saldos.ts), e as duas baixas se encaixam sozinhas lá: receita soma no
  -- destino, despesa subtrai na origem.
  insert into pagamentos (lancamento_id, valor, data_pagamento, conta_financeira_id)
  values (v_saida, p_valor, p_data, p_conta_origem_id);

  insert into pagamentos (lancamento_id, valor, data_pagamento, conta_financeira_id)
  values (v_entrada, p_valor, p_data, p_conta_destino_id);

  return v_transferencia_id;
end;
$$;

-- Única porta de saída: apaga as duas pernas de uma vez, com a marca ligada
-- para os triggers deixarem passar. Os pagamentos vão junto pelo
-- "on delete cascade" da FK.
create function estornar_transferencia(p_transferencia_id uuid) returns void
language plpgsql
as $$
declare
  v_apagados integer;
begin
  if p_transferencia_id is null then
    raise exception 'Informe a transferência a estornar.';
  end if;

  perform set_config('app.estornando_transferencia', 'sim', true);
  delete from lancamentos where transferencia_id = p_transferencia_id;
  get diagnostics v_apagados = row_count;
  perform set_config('app.estornando_transferencia', '', true);

  -- Zero linhas quer dizer transferência inexistente OU policy da 0009
  -- filtrando a linha para um viewer - que não recebe erro do delete, só não
  -- apaga nada.
  if v_apagados = 0 then
    raise exception 'Transferência não encontrada, ou seu usuário não tem permissão para estorná-la.';
  end if;
end;
$$;

-- Mesmo motivo da migração 0017: função sem search_path fixo resolve nomes
-- pelo search_path de quem chama, e o linter da Supabase acusa.
alter function estorno_de_transferencia_em_andamento() set search_path = public, pg_temp;
alter function proteger_lancamento_de_transferencia() set search_path = public, pg_temp;
alter function proteger_pagamento_de_transferencia() set search_path = public, pg_temp;
alter function registrar_transferencia(uuid, uuid, numeric, date, text, uuid) set search_path = public, pg_temp;
alter function estornar_transferencia(uuid) set search_path = public, pg_temp;

-- Sem `security definer` em nenhuma delas, de propósito: rodam como o usuário
-- que chamou, então as policies da 0009 continuam valendo e só dono/gerente
-- grava. Viewer bate na policy de insert/delete e recebe erro.
