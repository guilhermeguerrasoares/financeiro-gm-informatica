create type tipo_meta as enum ('limite', 'meta');
create type unidade_meta as enum ('percentual', 'valor');
create type metrica_meta as enum ('faturamento', 'permutas', 'categoria');

create table metas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo tipo_meta not null,
  metrica metrica_meta not null,
  categoria_id uuid references categorias(id) on delete cascade,
  unidade unidade_meta not null,
  valor_alvo numeric(12,2) not null check (valor_alvo > 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint categoria_obrigatoria_quando_metrica_categoria
    check ((metrica = 'categoria') = (categoria_id is not null))
);

create index idx_metas_categoria on metas(categoria_id);

alter table metas enable row level security;

create policy "metas: acesso completo para usuário com perfil"
  on metas for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));
