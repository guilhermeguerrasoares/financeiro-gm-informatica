import { listarLancamentos } from "./lancamentos";
import { listarPagamentos } from "./pagamentos";
import { listarClientes } from "./clientes";
import { listarContasFinanceiras } from "./contasFinanceiras";
import { saldo, status as calcStatus, totalPago } from "@/lib/calculations";
import { addDias, diffDias } from "@/lib/format";

export type PeriodoDashboard = { inicio: string; fim: string };

const MAX_SEMANAS = 8;

export async function dadosDashboard(periodo: PeriodoDashboard) {
  const [lancamentos, pagamentos, clientes, contas] = await Promise.all([
    listarLancamentos(),
    listarPagamentos(),
    listarClientes(),
    listarContasFinanceiras(),
  ]);

  const { inicio, fim } = periodo;
  const despesas = lancamentos.filter((l) => l.tipo === "despesa");

  // "Atrasado" e "vence em 7 dias" são sempre relativos ao fim do período
  // selecionado - selecionar um mês passado mostra a situação como estava
  // naquele momento.
  const atrasados = despesas.filter((l) => calcStatus(l, pagamentos, fim) === "atrasado");
  const totalAtrasado = atrasados.reduce((acc, l) => acc + saldo(l, pagamentos), 0);

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
  const saldoConsolidado = contas.reduce((acc, c) => {
    const daConta = lancamentos.filter((l) => l.conta_financeira_id === c.id);
    const movimentado = daConta.reduce((a, l) => {
      const pagoAteFim = pagamentos
        .filter((p) => p.lancamento_id === l.id && p.data_pagamento <= fim)
        .reduce((soma, p) => soma + p.valor, 0);
      return a + (l.tipo === "receita" ? pagoAteFim : -pagoAteFim);
    }, 0);
    return acc + c.saldo_inicial + movimentado;
  }, 0);

  // Classificação é um estado atual do cliente, não histórico - não faz
  // sentido variar por período selecionado.
  const clientesInadimplentes = clientes.filter((c) => c.classificacao === "inadimplente").length;

  const diasNoPeriodo = Math.max(1, diffDias(inicio, fim) + 1);
  const numSemanas = Math.min(MAX_SEMANAS, Math.max(1, Math.ceil(diasNoPeriodo / 7)));

  const semanas: { inicio: string; fim: string; entradas: number; saidas: number }[] = [];
  for (let i = numSemanas - 1; i >= 0; i--) {
    const fimSemana = addDias(fim, -i * 7);
    const inicioSemana = addDias(fimSemana, -6);

    const pagamentosNaSemana = pagamentos.filter((p) => p.data_pagamento >= inicioSemana && p.data_pagamento <= fimSemana);
    const entradas = pagamentosNaSemana
      .filter((p) => lancamentos.find((l) => l.id === p.lancamento_id)?.tipo === "receita")
      .reduce((acc, p) => acc + p.valor, 0);
    const saidas = pagamentosNaSemana
      .filter((p) => lancamentos.find((l) => l.id === p.lancamento_id)?.tipo === "despesa")
      .reduce((acc, p) => acc + p.valor, 0);

    semanas.push({ inicio: inicioSemana, fim: fimSemana, entradas, saidas });
  }

  return {
    saldoConsolidado,
    totalAtrasado,
    contasAtrasadas: atrasados.length,
    totalSemana,
    receitaPeriodo,
    clientesInadimplentes,
    semanas,
  };
}
