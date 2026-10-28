import { round2, saldo, status as calcStatus, totalPago, dentroDoPeriodo } from "./calculations";
import type { StatusLancamento } from "./calculations";
import { dataLocal, diffDias } from "./format";
import type { LancamentoRow, PagamentoRow } from "./types";

export type MovimentoFornecedor = LancamentoRow["movimento_fornecedor"];

export type LinhaFornecedor = {
  lancamento: LancamentoRow;
  falta: number;
  status: StatusLancamento;
  diasEmAberto: number;
};

// O fornecedor funciona como uma conta: quanto devo a ele é uma soma só,
// feita de três parcelas que moram todas em `lancamentos` - nenhuma tabela
// paralela, senão o número do fornecedor e o dos lançamentos divergem em
// algumas semanas e nenhum dos dois serve.
//
//   saldo devedor = compras em aberto + ajustes - quitações
//
// Por que o ajuste não vaza para as telas de dívida, conferido caminho a
// caminho: `listarDividasClientes` exige cliente_id não nulo, e o ajuste tem
// fornecedor_id; `listarDividasLoja` filtra por categorias do grupo "Despesas
// Financeiras", e o ajuste nasce sem categoria; os cards do dashboard passam
// por entraNosRelatorios(), que o exclui. Ele também nasce sem vencimento,
// então nunca é "atrasado" em cálculo nenhum.
export function saldoDevedor(
  fornecedorId: string,
  lancamentos: LancamentoRow[],
  pagamentos: PagamentoRow[]
): number {
  let devo = 0;

  for (const l of lancamentos) {
    if (l.fornecedor_id !== fornecedorId) continue;

    if (l.movimento_fornecedor === "compra") {
      // Compra entra pelo que falta pagar dela: a parte já paga saiu do caixa
      // e não é mais dívida.
      devo += saldo(l, pagamentos);
    } else if (l.movimento_fornecedor === "ajuste") {
      // O ajuste informa o total devido sem compra lançada. Quando ele
      // diminui a dívida, a diferença é gravada como receita - mesmo uso de
      // sinal que registrar_ajuste_saldo faz.
      devo += l.tipo === "despesa" ? l.valor : -l.valor;
    } else {
      // Quitação abate pelo que foi PAGO, não pelo valor lançado: uma
      // quitação ainda não paga não tirou dinheiro de lugar nenhum, então
      // ainda não diminuiu dívida nenhuma.
      devo -= totalPago(pagamentos, l.id);
    }
  }

  return round2(devo);
}

// O histórico do fornecedor, na ordem em que ele precisa ser lido: o que está
// em aberto primeiro, do mais antigo para o mais novo. Essa ordem é
// funcional, não estética - é ela que responde "qual eu pago primeiro".
//
// `periodo` filtra o histórico, nunca o saldo devedor do topo da tela: dívida
// filtrada por mês é um número sem significado.
export function movimentosDoFornecedor(
  fornecedorId: string,
  lancamentos: LancamentoRow[],
  pagamentos: PagamentoRow[],
  hoje: string,
  periodo?: { de: string; ate: string }
): LinhaFornecedor[] {
  const linhas: LinhaFornecedor[] = [];

  for (const l of lancamentos) {
    if (l.fornecedor_id !== fornecedorId) continue;

    // `created_at` é timestamptz; lido cru em UTC, uma compra registrada à
    // noite no Brasil cairia no dia seguinte e a antiguidade sairia errada.
    const entrada = dataLocal(l.created_at);
    if (periodo && !dentroDoPeriodo(entrada, periodo.de, periodo.ate)) continue;

    linhas.push({
      lancamento: l,
      // Ajuste não é conta a pagar: ele afirma a dívida. Por isso contribui
      // com o próprio valor, com sinal - o que diminui a dívida é gravado
      // como receita e aparece negativo, como abatimento. Passá-lo por
      // saldo() mostraria "falta 500" num crédito, que se lê como algo a
      // receber do fornecedor - o contrário do que é.
      falta:
        l.movimento_fornecedor === "ajuste"
          ? round2(l.tipo === "despesa" ? l.valor : -l.valor)
          : saldo(l, pagamentos),
      status: calcStatus(l, pagamentos, hoje),
      diasEmAberto: diffDias(entrada, hoje),
    });
  }

  return linhas.sort((a, b) => {
    const aQuitada = a.status === "quitado";
    const bQuitada = b.status === "quitado";
    if (aQuitada !== bQuitada) return aQuitada ? 1 : -1;
    return a.lancamento.created_at.localeCompare(b.lancamento.created_at);
  });
}
