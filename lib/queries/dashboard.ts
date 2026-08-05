import { listarLancamentos } from "./lancamentos";
import { listarPagamentos } from "./pagamentos";
import { listarClientes } from "./clientes";
import { listarContasFinanceiras } from "./contasFinanceiras";
import { saldo, status as calcStatus, totalPago } from "@/lib/calculations";
import { hoje, addDias } from "@/lib/format";

export async function dadosDashboard() {
  const [lancamentos, pagamentos, clientes, contas] = await Promise.all([
    listarLancamentos(),
    listarPagamentos(),
    listarClientes(),
    listarContasFinanceiras(),
  ]);

  const hojeStr = hoje();
  const despesas = lancamentos.filter((l) => l.tipo === "despesa");

  const atrasados = despesas.filter((l) => calcStatus(l, pagamentos, hojeStr) === "atrasado");
  const totalAtrasado = atrasados.reduce((acc, l) => acc + saldo(l, pagamentos), 0);

  const limite = addDias(hojeStr, 7);
  const venceSemana = despesas.filter(
    (l) => l.vencimento && l.vencimento >= hojeStr && l.vencimento <= limite && calcStatus(l, pagamentos, hojeStr) !== "quitado"
  );
  const totalSemana = venceSemana.reduce((acc, l) => acc + saldo(l, pagamentos), 0);

  const mesAtual = hojeStr.slice(0, 7);
  const receitaMes = lancamentos
    .filter((l) => l.tipo === "receita" && l.vencimento?.slice(0, 7) === mesAtual)
    .reduce((acc, l) => acc + totalPago(pagamentos, l.id), 0);

  const saldoConsolidado = contas.reduce((acc, c) => {
    const daConta = lancamentos.filter((l) => l.conta_financeira_id === c.id);
    const movimentado = daConta.reduce((a, l) => {
      const pago = totalPago(pagamentos, l.id);
      return a + (l.tipo === "receita" ? pago : -pago);
    }, 0);
    return acc + c.saldo_inicial + movimentado;
  }, 0);

  const clientesInadimplentes = clientes.filter((c) => c.classificacao === "inadimplente").length;

  const semanas: { inicio: string; entradas: number; saidas: number }[] = [];
  for (let i = 3; i >= 0; i--) {
    const fimStr = addDias(hojeStr, -i * 7);
    const inicioStr = addDias(fimStr, -6);

    const pagamentosNaSemana = pagamentos.filter((p) => p.data_pagamento >= inicioStr && p.data_pagamento <= fimStr);
    const entradas = pagamentosNaSemana
      .filter((p) => lancamentos.find((l) => l.id === p.lancamento_id)?.tipo === "receita")
      .reduce((acc, p) => acc + p.valor, 0);
    const saidas = pagamentosNaSemana
      .filter((p) => lancamentos.find((l) => l.id === p.lancamento_id)?.tipo === "despesa")
      .reduce((acc, p) => acc + p.valor, 0);

    semanas.push({ inicio: inicioStr, entradas, saidas });
  }

  return {
    saldoConsolidado,
    totalAtrasado,
    contasAtrasadas: atrasados.length,
    totalSemana,
    receitaMes,
    clientesInadimplentes,
    semanas,
  };
}
