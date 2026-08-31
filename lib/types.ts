export type Categoria = {
  id: string;
  nome: string;
  grupo_dre: string;
  frente_negocio: "pecas_acessorios" | "computadores" | "assistencia_tecnica" | "outros" | null;
};

export type Cliente = {
  id: string;
  nome: string;
  contato: string | null;
  documento: string | null;
  classificacao: "padrao" | "vip" | "recorrente" | "inadimplente";
  observacao: string | null;
};

export type Fornecedor = {
  id: string;
  nome: string;
  contato: string | null;
  documento: string | null;
  tipo: string | null;
};

export type ContaFinanceira = {
  id: string;
  nome: string;
  tipo: "caixa" | "banco" | "cartao";
  saldo_inicial: number;
  ativo: boolean;
};

export type LancamentoRow = {
  id: string;
  descricao: string;
  tipo: "despesa" | "receita";
  categoria_id: string | null;
  cliente_id: string | null;
  fornecedor_id: string | null;
  conta_financeira_id: string | null;
  equipamento_id: string | null;
  valor: number;
  custo: number | null;
  vencimento: string | null;
  competencia: string | null;
  recorrencia: string | null;
  observacao: string | null;
  // Lançamento de conciliação de conta: entra no saldo, fica fora de
  // faturamento, metas, DRE e fluxo (ver migração 0013).
  ajuste_saldo: boolean;
  // Quando a linha foi digitada no sistema - diferente do vencimento, que é
  // a data do movimento. Serve de desempate na ordenação: dois lançamentos
  // do mesmo dia precisam de uma ordem estável entre si.
  created_at: string;
};

export type Meta = {
  id: string;
  nome: string;
  tipo: "limite" | "meta";
  metrica: "faturamento" | "permutas" | "categoria";
  categoria_id: string | null;
  unidade: "percentual" | "valor";
  valor_alvo: number;
  ativo: boolean;
};

export type PagamentoRow = {
  id: string;
  lancamento_id: string;
  valor: number;
  taxa: number | null;
  valor_liquido: number;
  forma_pagamento: string | null;
  conta_financeira_id: string | null;
  data_pagamento: string;
  comprovante_url: string | null;
  observacao: string | null;
};
