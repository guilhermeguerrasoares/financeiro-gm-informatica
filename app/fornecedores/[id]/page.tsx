import { buscarFornecedor } from "@/lib/queries/fornecedores";
import { listarLancamentos } from "@/lib/queries/lancamentos";
import { listarPagamentos } from "@/lib/queries/pagamentos";
import { saldo } from "@/lib/calculations";
import { money, formatDataBR } from "@/lib/format";

export default async function FornecedorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [fornecedor, lancamentos, pagamentos] = await Promise.all([
    buscarFornecedor(id),
    listarLancamentos(),
    listarPagamentos(),
  ]);

  const historico = lancamentos.filter((l) => l.fornecedor_id === id);
  const proximoVencimento =
    historico.find((l) => l.vencimento && saldo(l, pagamentos) > 0.004)?.vencimento ?? null;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-1">{fornecedor.nome}</h1>
      <p className="text-[var(--text-dim)] mb-4">
        {fornecedor.contato ?? "Sem contato"} · {fornecedor.tipo ?? "—"}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
          <div className="text-xs text-[var(--text-dim)] uppercase">Próximo vencimento</div>
          <div className="text-xl font-semibold">{formatDataBR(proximoVencimento)}</div>
        </div>
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
