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
};

export type PagamentoRow = {
  id: string;
  lancamento_id: string;
  valor: number;
  taxa: number | null;
  valor_liquido: number;
  forma_pagamento: string | null;
  data_pagamento: string;
  comprovante_url: string | null;
  observacao: string | null;
};
