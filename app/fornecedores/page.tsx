import { listarFornecedores } from "@/lib/queries/fornecedores";
import { listarLancamentos } from "@/lib/queries/lancamentos";
import { listarPagamentos } from "@/lib/queries/pagamentos";
import { saldoDevedor } from "@/lib/fornecedores";
import { FornecedoresList } from "./FornecedoresList";

export default async function FornecedoresPage() {
  const [fornecedores, lancamentos, pagamentos] = await Promise.all([
    listarFornecedores(),
    listarLancamentos(),
    listarPagamentos(),
  ]);

  const linhas = fornecedores.map((f) => {
    const doFornecedor = lancamentos.filter((l) => l.fornecedor_id === f.id);
    // "Total lançado" conta só compra: ajuste não é compra, e quitação é
    // pagamento. Somar os três aqui daria um número que não é nada.
    const total = doFornecedor
      .filter((l) => l.movimento_fornecedor === "compra")
      .reduce((acc, l) => acc + l.valor, 0);
    // E "Devo" é a mesma pergunta da tela do fornecedor, respondida pela
    // mesma função: inclui ajuste e desconta quitação.
    const devo = saldoDevedor(f.id, lancamentos, pagamentos);
    return { fornecedor: f, total, devo, qtdLancamentos: doFornecedor.length };
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Fornecedores</h1>
      <FornecedoresList linhas={linhas} />
    </div>
  );
}
