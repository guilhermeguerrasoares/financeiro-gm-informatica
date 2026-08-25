import { listarFornecedores } from "@/lib/queries/fornecedores";
import { listarLancamentos } from "@/lib/queries/lancamentos";
import { listarPagamentos } from "@/lib/queries/pagamentos";
import { saldo } from "@/lib/calculations";
import { FornecedoresList } from "./FornecedoresList";

export default async function FornecedoresPage() {
  const [fornecedores, lancamentos, pagamentos] = await Promise.all([
    listarFornecedores(),
    listarLancamentos(),
    listarPagamentos(),
  ]);

  const linhas = fornecedores.map((f) => {
    const doFornecedor = lancamentos.filter((l) => l.fornecedor_id === f.id);
    const total = doFornecedor.reduce((acc, l) => acc + l.valor, 0);
    const falta = doFornecedor.reduce((acc, l) => acc + saldo(l, pagamentos), 0);
    return { fornecedor: f, total, falta, qtdLancamentos: doFornecedor.length };
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Fornecedores</h1>
      <FornecedoresList linhas={linhas} />
    </div>
  );
}
