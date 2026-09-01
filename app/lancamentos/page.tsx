import { listarLancamentos } from "@/lib/queries/lancamentos";
import { listarPagamentos } from "@/lib/queries/pagamentos";
import { listarCategorias } from "@/lib/queries/categorias";
import { listarClientes } from "@/lib/queries/clientes";
import { listarFornecedores } from "@/lib/queries/fornecedores";
import { listarContasFinanceiras } from "@/lib/queries/contasFinanceiras";
import { listarSeries } from "@/lib/queries/series";
import { LancamentosTable } from "./LancamentosTable";

export default async function LancamentosPage() {
  const [lancamentos, pagamentos, categorias, clientes, fornecedores, contas, series] =
    await Promise.all([
      listarLancamentos(),
      listarPagamentos(),
      listarCategorias(),
      listarClientes(),
      listarFornecedores(),
      listarContasFinanceiras(),
      listarSeries(),
    ]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Entradas e Saídas</h1>
      <LancamentosTable
        lancamentos={lancamentos}
        pagamentos={pagamentos}
        categorias={categorias}
        clientes={clientes}
        fornecedores={fornecedores}
        contas={contas}
        series={series}
      />
    </div>
  );
}
