insert into storage.buckets (id, name, public) values ('comprovantes', 'comprovantes', false)
on conflict (id) do nothing;

create policy "comprovantes: leitura para usuário com perfil"
  on storage.objects for select
  using (bucket_id = 'comprovantes' and exists (select 1 from profiles where id = auth.uid()));

create policy "comprovantes: upload para usuário com perfil"
  on storage.objects for insert
  with check (bucket_id = 'comprovantes' and exists (select 1 from profiles where id = auth.uid()));
