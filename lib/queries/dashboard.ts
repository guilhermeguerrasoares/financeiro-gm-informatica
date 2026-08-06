import { listarLancamentos } from "./lancamentos";
import { listarPagamentos } from "./pagamentos";
import { listarClientes } from "./clientes";
import { listarContasFinanceiras } from "./contasFinanceiras";
import { listarMetas } from "./metas";
import { listarItensPermuta, type ItemPermuta } from "./itensPermuta";
import { saldo, status as calcStatus, totalPago } from "@/lib/calculations";
import { calcularProgressoMetas } from "@/lib/metas-calc";
import { addDias, diffDias } from "@/lib/format";
import type { LancamentoRow, PagamentoRow } from "@/lib/types";

export type PeriodoDashboard = { inicio: string; fim: string };

export type PagamentoComLancamento = { pagamento: PagamentoRow; lancamento: LancamentoRow };

export type ItemPermutaComLucro = { item: ItemPermuta; lucro: number };

export type DiaFluxo = {
  data: string;
  entradasPrevistas: number;
  entradasConsolidadas: number;
  saidasPrevistas: number;
  saidasConsolidadas: number;
};

export type SemanaFluxo = { inicio: string; fim: string } & Omit<DiaFluxo, "data">;

function diasEntre(inicio: string, fim: string): string[] {
  const total = Math.max(0, diffDias(inicio, fim));
  return Array.from({ length: total + 1 }, (_, i) => addDias(inicio, i));
}

// Agrupa o fluxo diário em blocos de 7 dias a partir do início do
// intervalo - reaproveita os números já calculados, sem nova consulta.
export function agruparPorSemana(dias: DiaFluxo[]): SemanaFluxo[] {
  const semanas: SemanaFluxo[] = [];
  for (let i = 0; i < dias.length; i += 7) {
    const bloco = dias.slice(i, i + 7);
    semanas.push({
      inicio: bloco[0].data,
      fim: bloco[bloco.length - 1].data,
      entradasPrevistas: bloco.reduce((acc, d) => acc + d.entradasPrevistas, 0),
      entradasConsolidadas: bloco.reduce((acc, d) => acc + d.entradasConsolidadas, 0),
      saidasPrevistas: bloco.reduce((acc, d) => acc + d.saidasPrevistas, 0),
      saidasConsolidadas: bloco.reduce((acc, d) => acc + d.saidasConsolidadas, 0),
    });
  }
  return semanas;
}

export async function dadosDashboard(periodo: PeriodoDashboard, periodoFluxo: PeriodoDashboard) {
  const [lancamentos, pagamentos, clientes, contas, metas, itensPermuta] = await Promise.all([
    listarLancamentos(),
    listarPagamentos(),
    listarClientes(),
    listarContasFinanceiras(),
    listarMetas(),
    listarItensPermuta(),
  ]);

  const { inicio, fim } = periodo;
  const despesas = lancamentos.filter((l) => l.tipo === "despesa");

  // "Atrasado" e "vence em 7 dias" são sempre relativos ao fim do período
  // selecionado - selecionar um mês passado mostra a situação como estava
  // naquele momento.
  const atrasados = despesas.filter((l) => calcStatus(l, pagamentos, fim) === "atrasado");
  const atrasadosComSaldo = atrasados.map((lancamento) => ({ lancamento, saldo: saldo(lancamento, pagamentos) }));
  const totalAtrasado = atrasadosComSaldo.reduce((acc, a) => acc + a.saldo, 0);

  const limite = addDias(fim, 7);
  const venceSemana = despesas.filter(
    (l) => l.vencimento && l.vencimento >= fim && l.vencimento <= limite && calcStatus(l, pagamentos, fim) !== "quitado"
  );
  const totalSemana = venceSemana.reduce((acc, l) => acc + saldo(l, pagamentos), 0);

  const receitaPeriodo = lancamentos
    .filter((l) => l.tipo === "receita" && l.vencimento && l.vencimento >= inicio && l.vencimento <= fim)
    .reduce((acc, l) => acc + totalPago(pagamentos, l.id), 0);

  // Saldo consolidado: quanto cada conta tinha acumulado até o fim do
  // período (não só o que se moveu dentro dele) - é o "extrato daquele dia".
  const saldoPorConta = contas.map((c) => {
    const daConta = lancamentos.filter((l) => l.conta_financeira_id === c.id);
    const movimentado = daConta.reduce((a, l) => {
      const pagoAteFim = pagamentos
        .filter((p) => p.lancamento_id === l.id && p.data_pagamento <= fim)
        .reduce((soma, p) => soma + p.valor, 0);
      return a + (l.tipo === "receita" ? pagoAteFim : -pagoAteFim);
    }, 0);
    return { conta: c, saldo: c.saldo_inicial + movimentado };
  });
  const saldoConsolidado = saldoPorConta.reduce((acc, s) => acc + s.saldo, 0);

  // Classificação é um estado atual do cliente, não histórico - não faz
  // sentido variar por período selecionado.
  const clientesInadimplentesLista = clientes.filter((c) => c.classificacao === "inadimplente");

  const progressoMetas = calcularProgressoMetas(metas, lancamentos, pagamentos, periodo);

  // Lucro de permuta é reconhecido na data da venda (não na data de
  // recebimento do item) - é quando o ganho vira valor real.
  const itensPermutaVendidosPeriodo: ItemPermutaComLucro[] = itensPermuta
    .filter((item) => item.status === "revendido" && item.data_venda && item.data_venda >= inicio && item.data_venda <= fim)
    .map((item) => ({ item, lucro: (item.valor_venda ?? 0) - (item.valor_estimado ?? 0) }));
  const lucroPermutasPeriodo = itensPermutaVendidosPeriodo.reduce((acc, i) => acc + i.lucro, 0);

  const pagamentosNoPeriodo = pagamentos.filter((p) => p.data_pagamento >= inicio && p.data_pagamento <= fim);
  const pagamentosPeriodo: PagamentoComLancamento[] = pagamentosNoPeriodo
    .map((pagamento) => {
      const lancamento = lancamentos.find((l) => l.id === pagamento.lancamento_id);
      return lancamento ? { pagamento, lancamento } : null;
    })
    .filter((x): x is PagamentoComLancamento => x !== null);

  const totalEntradasPeriodo = pagamentosPeriodo
    .filter((p) => p.lancamento.tipo === "receita")
    .reduce((acc, p) => acc + p.pagamento.valor, 0);
  const totalSaidasPeriodo = pagamentosPeriodo
    .filter((p) => p.lancamento.tipo === "despesa")
    .reduce((acc, p) => acc + p.pagamento.valor, 0);
  const resultadoPeriodo = totalEntradasPeriodo - totalSaidasPeriodo;

  const valorVendidoPermutasPeriodo = itensPermutaVendidosPeriodo.reduce(
    (acc, i) => acc + (i.item.valor_venda ?? 0),
    0
  );
  const percentualPermutasPeriodo =
    totalEntradasPeriodo > 0 ? (valorVendidoPermutasPeriodo / totalEntradasPeriodo) * 100 : 0;

  // Fluxo diário: cobre o intervalo completo (mês inteiro, mesmo além de
  // hoje) para mostrar previsão, diferente dos KPIs acima que travam em `fim`.
  const lancamentosFluxo = lancamentos.filter(
    (l) => l.vencimento && l.vencimento >= periodoFluxo.inicio && l.vencimento <= periodoFluxo.fim
  );
  const idsFluxo = new Set(lancamentosFluxo.map((l) => l.id));
  const pagamentosFluxo = pagamentos.filter((p) => idsFluxo.has(p.lancamento_id));

  const fluxoDiario: DiaFluxo[] = diasEntre(periodoFluxo.inicio, periodoFluxo.fim).map((data) => {
    const doDia = lancamentosFluxo.filter((l) => l.vencimento === data);
    let entradasPrevistas = 0;
    let entradasConsolidadas = 0;
    let saidasPrevistas = 0;
    let saidasConsolidadas = 0;

    for (const l of doDia) {
      const pago = totalPago(pagamentosFluxo, l.id);
      const restante = Math.max(0, saldo(l, pagamentosFluxo));
      if (l.tipo === "receita") {
        entradasConsolidadas += pago;
        entradasPrevistas += restante;
      } else {
        saidasConsolidadas += pago;
        saidasPrevistas += restante;
      }
    }

    return { data, entradasPrevistas, entradasConsolidadas, saidasPrevistas, saidasConsolidadas };
  });

  return {
    saldoConsolidado,
    saldoPorConta,
    totalAtrasado,
    contasAtrasadas: atrasados.length,
    atrasados: atrasadosComSaldo,
    totalSemana,
    receitaPeriodo,
    clientesInadimplentes: clientesInadimplentesLista.length,
    clientesInadimplentesLista,
    totalEntradasPeriodo,
    totalSaidasPeriodo,
    resultadoPeriodo,
    pagamentosPeriodo,
    fluxoDiario,
    fluxoSemanal: agruparPorSemana(fluxoDiario),
    lancamentosFluxo,
    pagamentosFluxo,
    progressoMetas,
    lucroPermutasPeriodo,
    itensPermutaVendidosPeriodo,
    valorVendidoPermutasPeriodo,
    percentualPermutasPeriodo,
  };
}
