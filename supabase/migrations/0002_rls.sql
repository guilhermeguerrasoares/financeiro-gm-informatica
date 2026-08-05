alter table profiles enable row level security;
alter table contas_financeiras enable row level security;
alter table categorias enable row level security;
alter table clientes enable row level security;
alter table equipamentos_cliente enable row level security;
alter table fornecedores enable row level security;
alter table lancamentos enable row level security;
alter table pagamentos enable row level security;
alter table itens_permuta enable row level security;

create policy "profiles: usuário vê e edita o próprio perfil"
  on profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "contas_financeiras: acesso completo para usuário com perfil"
  on contas_financeiras for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy "categorias: acesso completo para usuário com perfil"
  on categorias for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy "clientes: acesso completo para usuário com perfil"
  on clientes for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy "equipamentos_cliente: acesso completo para usuário com perfil"
  on equipamentos_cliente for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy "fornecedores: acesso completo para usuário com perfil"
  on fornecedores for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy "lancamentos: acesso completo para usuário com perfil"
  on lancamentos for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy "pagamentos: acesso completo para usuário com perfil"
  on pagamentos for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy "itens_permuta: acesso completo para usuário com perfil"
  on itens_permuta for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));
