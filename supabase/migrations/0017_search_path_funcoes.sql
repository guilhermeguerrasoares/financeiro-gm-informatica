-- Função sem `search_path` fixo resolve nomes pelo search_path de quem chama.
-- O linter do Supabase (0011_function_search_path_mutable) acusou as 8 funções
-- abaixo. Fixar é gratuito e tira a classe inteira de ataque de mesa.
--
-- Loop em vez de 8 ALTERs escritos à mão porque várias delas têm sobrecarga
-- (registrar_pagamento_com_permuta foi recriada em 0010 e 0011 com assinaturas
-- diferentes) — `oid::regprocedure` acerta a assinatura sozinho, sem depender
-- de eu transcrever a lista de tipos corretamente.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'set_updated_at',
        'vender_item_permuta',
        'registrar_pagamento_com_permuta',
        'registrar_ajuste_saldo',
        'criar_serie_lancamentos',
        'inserir_ocorrencias_serie',
        'atualizar_serie_lancamentos',
        'excluir_serie_lancamentos'
      )
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.assinatura);
  end loop;
end $$;
