import { notFound } from "next/navigation";
import { buscarFornecedor } from "@/lib/queries/fornecedores";
import { listarLancamentos } from "@/lib/queries/lancamentos";
import { listarPagamentos } from "@/lib/queries/pagamentos";
import { listarCategorias } from "@/lib/queries/categorias";
import { listarClientes } from "@/lib/queries/clientes";
import { listarContasFinanceiras } from "@/lib/queries/contasFinanceiras";
import { FornecedorConta } from "./FornecedorConta";

export default async function FornecedorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const fornecedorPromise = buscarFornecedor(id).catch((error) => {
    if (error?.code === "PGRST116") notFound();
    throw error;
  });

  const [fornecedor, lancamentos, pagamentos, categorias, clientes, contas] = await Promise.all([
    fornecedorPromise,
    listarLancamentos(),
    listarPagamentos(),
    listarCategorias(),
    listarClientes(),
    listarContasFinanceiras(),
  ]);

  return (
    <FornecedorConta
      fornecedor={fornecedor}
      lancamentos={lancamentos}
      pagamentos={pagamentos}
      categorias={categorias}
      clientes={clientes}
      contas={contas}
    />
  );
}
