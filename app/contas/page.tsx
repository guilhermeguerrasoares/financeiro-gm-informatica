import { listarContasFinanceiras } from "@/lib/queries/contasFinanceiras";
import { listarLancamentos } from "@/lib/queries/lancamentos";
import { listarPagamentos } from "@/lib/queries/pagamentos";
import { ContasList } from "./ContasList";

export default async function ContasPage() {
  const [contas, lancamentos, pagamentos] = await Promise.all([
    listarContasFinanceiras(),
    listarLancamentos(),
    listarPagamentos(),
  ]);

  const saldoDaConta = (contaId: string) => {
    const conta = contas.find((c) => c.id === contaId)!;
    const daConta = lancamentos.filter((l) => l.conta_financeira_id === contaId);
    const movimentado = daConta.reduce((acc, l) => {
      const pagoDoLancamento = pagamentos
        .filter((p) => p.lancamento_id === l.id)
        .reduce((a, p) => a + p.valor, 0);
      return acc + (l.tipo === "receita" ? pagoDoLancamento : -pagoDoLancamento);
    }, 0);
    return conta.saldo_inicial + movimentado;
  };

  const saldoPorConta = Object.fromEntries(contas.map((c) => [c.id, saldoDaConta(c.id)]));
  const saldoConsolidado = contas.reduce((acc, c) => acc + saldoPorConta[c.id], 0);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Contas e caixas</h1>
      <ContasList contas={contas} saldoPorConta={saldoPorConta} saldoConsolidado={saldoConsolidado} />
    </div>
  );
}
