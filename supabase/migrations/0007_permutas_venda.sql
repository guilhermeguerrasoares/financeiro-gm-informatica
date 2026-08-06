alter table itens_permuta
  add column if not exists data_venda date,
  add column if not exists valor_venda numeric(12,2),
  add column if not exists lancamento_venda_id uuid references lancamentos(id) on delete set null;
