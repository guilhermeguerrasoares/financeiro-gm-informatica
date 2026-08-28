import { listarContasFinanceiras } from "@/lib/queries/contasFinanceiras";
import { listarLancamentos } from "@/lib/queries/lancamentos";
import { listarPagamentos } from "@/lib/queries/pagamentos";
import { saldosPorConta, saldoConsolidado } from "@/lib/saldos";
import { ContasList } from "./ContasList";

export default async function ContasPage() {
  const [contas, lancamentos, pagamentos] = await Promise.all([
    listarContasFinanceiras(),
    listarLancamentos(),
    listarPagamentos(),
  ]);

  const saldoPorConta = saldosPorConta(contas, lancamentos, pagamentos);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Contas e caixas</h1>
      <ContasList
        contas={contas}
        saldoPorConta={saldoPorConta}
        saldoConsolidado={saldoConsolidado(contas, lancamentos, pagamentos)}
      />
    </div>
  );
}
