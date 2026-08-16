-- Até aqui, toda policy usava "for all" liberando qualquer perfil
-- autenticado (dono/gerente/viewer) a ler E escrever. Isso torna a coluna
-- profiles.papel decorativa. Separa leitura (qualquer perfil) de escrita
-- (só dono/gerente) nas tabelas de dados - profiles fica de fora, ela já
-- tem sua própria policy de "só o próprio perfil".
do $$
declare
  t text;
begin
  foreach t in array array[
    'contas_financeiras',
    'categorias',
    'clientes',
    'equipamentos_cliente',
    'fornecedores',
    'lancamentos',
    'pagamentos',
    'itens_permuta'
  ]
  loop
    execute format('drop policy if exists %I on %I', t || ': acesso completo para usuário com perfil', t);

    execute format('drop policy if exists %I on %I', t || ': leitura para qualquer perfil', t);
    execute format(
      'create policy %I on %I for select using (exists (select 1 from profiles where id = auth.uid()))',
      t || ': leitura para qualquer perfil', t
    );

    execute format('drop policy if exists %I on %I', t || ': inclusão para dono ou gerente', t);
    execute format(
      'create policy %I on %I for insert with check (exists (select 1 from profiles where id = auth.uid() and papel in (''dono'',''gerente'')))',
      t || ': inclusão para dono ou gerente', t
    );

    execute format('drop policy if exists %I on %I', t || ': atualização para dono ou gerente', t);
    execute format(
      'create policy %I on %I for update using (exists (select 1 from profiles where id = auth.uid() and papel in (''dono'',''gerente''))) with check (exists (select 1 from profiles where id = auth.uid() and papel in (''dono'',''gerente'')))',
      t || ': atualização para dono ou gerente', t
    );

    execute format('drop policy if exists %I on %I', t || ': exclusão para dono ou gerente', t);
    execute format(
      'create policy %I on %I for delete using (exists (select 1 from profiles where id = auth.uid() and papel in (''dono'',''gerente'')))',
      t || ': exclusão para dono ou gerente', t
    );
  end loop;
end $$;
