-- A migração 0004 dava 'dono' a todo mundo que se cadastrasse, e o default da
-- coluna (0001) também era 'dono'. Combinado com cadastro público aberto, isso
-- significava acesso total ao financeiro para qualquer pessoa que criasse uma
-- conta. O cadastro público foi desligado no painel, mas o padrão continua
-- errado: privilégio se concede, não se herda.
--
-- Perfil novo passa a nascer 'viewer' (só leitura). Promover é ato explícito
-- do dono, via SQL Editor — a coluna `papel` não é mais gravável pela API
-- desde a migração 0015.

alter table public.profiles alter column papel set default 'viewer';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, nome, papel)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), 'viewer');
  return new;
end;
$$;

-- A função só existe para ser chamada pelo trigger on_auth_user_created.
-- Estando no schema `public`, o PostgREST a expunha em /rest/v1/rpc/ para os
-- roles anon e authenticated — foi o que o linter do Supabase acusou. Não há
-- motivo para ninguém chamá-la pela API.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
