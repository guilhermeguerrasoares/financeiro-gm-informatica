import { listarLancamentos } from "@/lib/queries/lancamentos";
import { listarPagamentos } from "@/lib/queries/pagamentos";
import { listarCategorias } from "@/lib/queries/categorias";
import { LancamentosTable } from "./LancamentosTable";

export default async function LancamentosPage() {
  const [lancamentos, pagamentos, categorias] = await Promise.all([
    listarLancamentos(),
    listarPagamentos(),
    listarCategorias(),
  ]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Entradas e Saídas</h1>
      <LancamentosTable lancamentos={lancamentos} pagamentos={pagamentos} categorias={categorias} />
    </div>
  );
}
