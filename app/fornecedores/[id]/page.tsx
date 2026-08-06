import { notFound } from "next/navigation";
import { buscarFornecedor } from "@/lib/queries/fornecedores";
import { listarLancamentos } from "@/lib/queries/lancamentos";
import { listarPagamentos } from "@/lib/queries/pagamentos";
import { status } from "@/lib/calculations";
import { money, formatDataBR, hoje } from "@/lib/format";

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

  const [fornecedor, lancamentos, pagamentos] = await Promise.all([
    fornecedorPromise,
    listarLancamentos(),
    listarPagamentos(),
  ]);

  const historico = lancamentos.filter((l) => l.fornecedor_id === id);
  const historicoIds = new Set(historico.map((l) => l.id));
  const pagamentosDoFornecedor = pagamentos.filter((p) => historicoIds.has(p.lancamento_id));
  const hojeStr = hoje();
  const proximoVencimento = historico
    .filter((l) => l.vencimento && status(l, pagamentosDoFornecedor, hojeStr) !== "quitado")
    .sort((a, b) => a.vencimento!.localeCompare(b.vencimento!))[0]?.vencimento ?? null;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-1">{fornecedor.nome}</h1>
      <p className="text-[var(--text-dim)] mb-4">
        {fornecedor.contato ?? "Sem contato"} · {fornecedor.tipo ?? "—"}
      </p>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 mb-8 max-w-xs">
        <div className="text-xs text-[var(--text-dim)] uppercase">Próximo vencimento</div>
        <div className="text-xl font-semibold">{formatDataBR(proximoVencimento)}</div>
      </div>

      <h2 className="font-semibold mb-2">Histórico</h2>
      <ul className="space-y-1">
        {historico.map((l) => (
          <li key={l.id} className="text-sm flex justify-between border-b border-[var(--border)] py-1">
            <span>{l.descricao}</span>
            <span>{money(l.valor)}</span>
          </li>
        ))}
        {historico.length === 0 && (
          <li className="text-sm text-[var(--text-dim)]">Nenhum lançamento vinculado a este fornecedor.</li>
        )}
      </ul>
    </div>
  );
}
