-- A policy de 0002 ("profiles: usuário vê e edita o próprio perfil") é
-- `for all using (id = auth.uid())`. `for all` inclui UPDATE, e a checagem só
-- olha o id — então qualquer usuário logado, inclusive um 'viewer', podia
-- rodar do próprio navegador:
--
--   supabase.from('profiles').update({ papel: 'dono' }).eq('id', <seu id>)
--
-- ...e passar nas duas condições. Isso anulava inteiramente a migração 0009,
-- que separou leitura de escrita justamente para o 'viewer' não escrever nada.
--
-- RLS não consegue barrar isso sozinho: numa policy de UPDATE, `using` vê a
-- linha antiga e `with check` a nova, e não existe forma de comparar as duas.
-- Quem barra é o GRANT por coluna, que o PostgREST aplica antes da policy.
-- Trocar `papel` passa a exigir service_role (SQL Editor do painel).

revoke update on public.profiles from anon, authenticated;
grant update (nome) on public.profiles to authenticated;

-- Ninguém cria nem apaga perfil pela API: quem cria é o trigger
-- handle_new_user (SECURITY DEFINER, roda como owner e ignora isto), e apagar
-- o próprio perfil só serviria para o usuário se trancar para fora — as
-- policies de 0009 exigem uma linha em profiles para qualquer leitura.
revoke insert, delete on public.profiles from anon, authenticated;

-- Substitui o `for all` por policies explícitas. Sem policy de insert/delete,
-- o RLS nega as duas por padrão — cinto e suspensório junto com o revoke.
drop policy if exists "profiles: usuário vê e edita o próprio perfil" on public.profiles;

drop policy if exists "profiles: leitura do próprio perfil" on public.profiles;
create policy "profiles: leitura do próprio perfil"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profiles: atualização do próprio nome" on public.profiles;
create policy "profiles: atualização do próprio nome"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());
