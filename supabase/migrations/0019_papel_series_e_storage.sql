-- A migração 0009 separou leitura de escrita em 9 tabelas: qualquer perfil lê,
-- só dono/gerente grava. `series_lancamentos` nasceu depois disso, na 0014, e
-- trouxe de volta o `for all` que a 0009 tinha acabado de eliminar — ficou de
-- fora do padrão por ser mais nova que ele, não por decisão.
--
-- Isso era inalcançável enquanto todo usuário virava 'dono' no cadastro. A
-- migração 0016 fez 'viewer' existir de verdade, e com ela a brecha: um viewer
-- podia apagar ou alterar pelo PostgREST as regras das contas fixas, que é de
-- onde nascem os lançamentos futuros. Não é escalação de privilégio (as RPCs
-- são SECURITY INVOKER e continuam esbarrando na 0009), é escrita e destruição
-- não autorizada de regra de negócio.

drop policy if exists "series_lancamentos: acesso completo para usuário com perfil" on public.series_lancamentos;

drop policy if exists "series_lancamentos: leitura para qualquer perfil" on public.series_lancamentos;
create policy "series_lancamentos: leitura para qualquer perfil"
  on public.series_lancamentos for select
  using (exists (select 1 from profiles where id = auth.uid()));

drop policy if exists "series_lancamentos: inclusão para dono ou gerente" on public.series_lancamentos;
create policy "series_lancamentos: inclusão para dono ou gerente"
  on public.series_lancamentos for insert
  with check (exists (select 1 from profiles where id = auth.uid() and papel in ('dono','gerente')));

drop policy if exists "series_lancamentos: atualização para dono ou gerente" on public.series_lancamentos;
create policy "series_lancamentos: atualização para dono ou gerente"
  on public.series_lancamentos for update
  using (exists (select 1 from profiles where id = auth.uid() and papel in ('dono','gerente')))
  with check (exists (select 1 from profiles where id = auth.uid() and papel in ('dono','gerente')));

drop policy if exists "series_lancamentos: exclusão para dono ou gerente" on public.series_lancamentos;
create policy "series_lancamentos: exclusão para dono ou gerente"
  on public.series_lancamentos for delete
  using (exists (select 1 from profiles where id = auth.uid() and papel in ('dono','gerente')));

-- Mesmo caso na 0005: o bucket de comprovantes aceitava upload de qualquer
-- perfil, inclusive viewer. Ler continua liberado para qualquer perfil — quem
-- enxerga o lançamento precisa enxergar o comprovante dele.
drop policy if exists "comprovantes: upload para usuário com perfil" on storage.objects;
create policy "comprovantes: upload para dono ou gerente"
  on storage.objects for insert
  with check (
    bucket_id = 'comprovantes'
    and exists (select 1 from profiles where id = auth.uid() and papel in ('dono','gerente'))
  );
