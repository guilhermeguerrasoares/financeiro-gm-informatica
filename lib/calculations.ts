export type Lancamento = {
  id: string;
  tipo: "despesa" | "receita";
  valor: number;
  custo: number | null;
  vencimento: string | null; // ISO date, YYYY-MM-DD
};

export type Pagamento = {
  id: string;
  lancamento_id: string;
  valor: number;
  taxa: number | null;
  valor_liquido: number;
  data_pagamento: string;
};

export type StatusLancamento = "atrasado" | "aberto" | "parcial" | "quitado";

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function totalPago(pagamentos: Pagamento[], lancamentoId: string): number {
  return round2(
    pagamentos
      .filter((p) => p.lancamento_id === lancamentoId)
      .reduce((acc, p) => acc + p.valor, 0)
  );
}

export function saldo(lancamento: Lancamento, pagamentos: Pagamento[]): number {
  return round2(lancamento.valor - totalPago(pagamentos, lancamento.id));
}

export function status(
  lancamento: Lancamento,
  pagamentos: Pagamento[],
  hoje: string
): StatusLancamento {
  const pago = totalPago(pagamentos, lancamento.id);
  const restante = saldo(lancamento, pagamentos);
  // valor === 0 means "not yet defined" (see reference UX), not "already settled",
  // so it deliberately falls through to atrasado/parcial/aberto instead of quitado.
  if (lancamento.valor > 0 && restante <= 0.004) return "quitado";
  if (lancamento.vencimento && lancamento.vencimento < hoje) return "atrasado";
  if (pago > 0) return "parcial";
  return "aberto";
}

export function valorLiquido(valor: number, taxa: number | null): number {
  return round2(valor - (taxa ?? 0));
}

export function margem(lancamento: Lancamento): number | null {
  if (lancamento.custo == null) return null;
  return round2(lancamento.valor - lancamento.custo);
}

// Ganho na revenda de um item de permuta: preço de venda menos o que ele
// valia quando entrou (valor_estimado) - mesma lógica de margem() acima,
// mas para itens de permuta em vez de lançamentos.
export function lucroPermuta(item: { valor_venda: number | null; valor_estimado: number | null }): number {
  return round2((item.valor_venda ?? 0) - (item.valor_estimado ?? 0));
}

// Filtro de período por data ISO "YYYY-MM-DD": nesse formato a ordem
// lexicográfica é a ordem cronológica, então comparar as strings direto
// evita converter para Date - que é justamente onde datas puras costumam
// escorregar um dia por fuso horário.
//
// Ambos os limites são inclusivos e independentes: informar só um dos lados
// deixa o outro em aberto. Sem data nenhuma, nada é filtrado.
export function dentroDoPeriodo(
  data: string | null,
  de: string,
  ate: string
): boolean {
  if (!de && !ate) return true;
  // Sem data não há como dizer se cabe no período; fica de fora assim que
  // algum limite é informado.
  if (!data) return false;
  if (de && data < de) return false;
  if (ate && data > ate) return false;
  return true;
}

export const SITUACAO_ORDEM: Record<StatusLancamento, number> = {
  atrasado: 0,
  aberto: 1,
  parcial: 2,
  quitado: 3,
};

// Desempate de ordenação: dois lançamentos com o mesmo vencimento (ou a
// mesma situação) precisam de uma ordem estável entre si, senão quem decide
// é o banco e ela muda sem aviso. Vence o digitado por último, que é o que
// quem acabou de lançar procura na tela.
export function compararPorRegistro(
  a: { created_at: string },
  b: { created_at: string }
): number {
  return b.created_at.localeCompare(a.created_at);
}

// Ordena as linhas da tabela de lançamentos. `campo` null significa a ordem
// que veio do banco (vencimento crescente), preservada por ser um sort
// estável; o desempate por data de registro já vem de lá.
export function ordenarLinhas<
  T extends { lancamento: { vencimento: string | null; created_at: string }; status: StatusLancamento }
>(linhas: T[], campo: "data" | "situacao" | null, direcao: "asc" | "desc"): T[] {
  if (!campo) return linhas;

  const sinal = direcao === "asc" ? 1 : -1;
  return [...linhas].sort((a, b) => {
    const primario =
      campo === "data"
        ? (a.lancamento.vencimento ?? "").localeCompare(b.lancamento.vencimento ?? "")
        : SITUACAO_ORDEM[a.status] - SITUACAO_ORDEM[b.status];
    if (primario !== 0) return primario * sinal;
    return compararPorRegistro(a.lancamento, b.lancamento);
  });
}
