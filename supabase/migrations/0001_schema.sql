create extension if not exists "pgcrypto";

create type papel_usuario as enum ('dono', 'gerente', 'viewer');
create type tipo_lancamento as enum ('despesa', 'receita');
create type frente_negocio as enum ('pecas_acessorios', 'computadores', 'assistencia_tecnica', 'outros');
create type forma_pagamento as enum ('pix','dinheiro','boleto','transferencia','cartao_credito','cartao_debito','permuta');
create type status_item_permuta as enum ('em_estoque','revendido','usado_em_conserto','descartado');
create type classificacao_cliente as enum ('padrao','vip','recorrente','inadimplente');
create type tipo_conta_financeira as enum ('caixa','banco','cartao');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  papel papel_usuario not null default 'dono',
  created_at timestamptz not null default now()
);

create table contas_financeiras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo tipo_conta_financeira not null default 'caixa',
  saldo_inicial numeric(12,2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  grupo_dre text not null,
  frente_negocio frente_negocio,
  created_at timestamptz not null default now()
);

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  contato text,
  documento text,
  classificacao classificacao_cliente not null default 'padrao',
  observacao text,
  created_at timestamptz not null default now()
);

create table equipamentos_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  tipo text not null,
  marca_modelo text,
  numero_serie text,
  observacao text,
  created_at timestamptz not null default now()
);

create table fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  contato text,
  documento text,
  tipo text,
  observacao text,
  created_at timestamptz not null default now()
);

create table lancamentos (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  tipo tipo_lancamento not null default 'despesa',
  categoria_id uuid references categorias(id) on delete set null,
  cliente_id uuid references clientes(id) on delete set null,
  fornecedor_id uuid references fornecedores(id) on delete set null,
  conta_financeira_id uuid references contas_financeiras(id) on delete set null,
  equipamento_id uuid references equipamentos_cliente(id) on delete set null,
  valor numeric(12,2) not null default 0,
  custo numeric(12,2),
  vencimento date,
  competencia text,
  recorrencia text,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid not null references lancamentos(id) on delete cascade,
  valor numeric(12,2) not null check (valor > 0),
  taxa numeric(12,2),
  valor_liquido numeric(12,2) generated always as (valor - coalesce(taxa,0)) stored,
  forma_pagamento forma_pagamento,
  data_pagamento date not null,
  comprovante_url text,
  observacao text,
  created_at timestamptz not null default now()
);

create table itens_permuta (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid not null references pagamentos(id) on delete cascade,
  descricao text not null,
  valor_estimado numeric(12,2),
  status status_item_permuta not null default 'em_estoque',
  observacao text,
  created_at timestamptz not null default now()
);

create index idx_lancamentos_vencimento on lancamentos(vencimento);
create index idx_lancamentos_cliente on lancamentos(cliente_id);
create index idx_lancamentos_fornecedor on lancamentos(fornecedor_id);
create index idx_lancamentos_categoria on lancamentos(categoria_id);
create index idx_pagamentos_lancamento on pagamentos(lancamento_id);
create index idx_pagamentos_data on pagamentos(data_pagamento);
create index idx_equipamentos_cliente on equipamentos_cliente(cliente_id);
