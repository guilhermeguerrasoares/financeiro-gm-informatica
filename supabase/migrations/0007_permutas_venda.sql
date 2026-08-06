alter table itens_permuta
  add column data_venda date,
  add column valor_venda numeric(12,2),
  add column lancamento_venda_id uuid references lancamentos(id) on delete set null;
