import { buscarCliente } from "@/lib/queries/clientes";
import { listarEquipamentosDoCliente } from "@/lib/queries/equipamentos";
import { listarLancamentos } from "@/lib/queries/lancamentos";
import { listarPagamentos } from "@/lib/queries/pagamentos";
import { metricasCliente } from "@/lib/ltv";
import { money } from "@/lib/format";
import { ClienteDetailActions } from "./ClienteDetailActions";

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [cliente, equipamentos, lancamentos, pagamentos] = await Promise.all([
    buscarCliente(id),
    listarEquipamentosDoCliente(id),
    listarLancamentos(),
    listarPagamentos(),
  ]);

  const metricas = metricasCliente(id, lancamentos, pagamentos);
  const historico = lancamentos.filter((l) => l.cliente_id === id);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-1">{cliente.nome}</h1>
      <p className="text-[var(--text-dim)] mb-4">{cliente.contato ?? "Sem contato"}</p>

      <ClienteDetailActions cliente={cliente} />

      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
          <div className="text-xs text-[var(--text-dim)] uppercase">LTV</div>
          <div className="text-xl font-semibold">{money(metricas.ltv)}</div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
          <div className="text-xs text-[var(--text-dim)] uppercase">Ticket médio</div>
          <div className="text-xl font-semibold">{money(metricas.ticketMedio)}</div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
          <div className="text-xs text-[var(--text-dim)] uppercase">Compras/serviços</div>
          <div className="text-xl font-semibold">{metricas.frequencia}</div>
        </div>
      </div>

      <h2 className="font-semibold mb-2">Equipamentos</h2>
      <ul className="mb-8 space-y-1">
        {equipamentos.map((e) => (
          <li key={e.id} className="text-sm text-[var(--text-dim)]">
            {e.tipo} — {e.marca_modelo ?? "sem modelo informado"}
          </li>
        ))}
        {equipamentos.length === 0 && (
          <li className="text-sm text-[var(--text-dim)]">Nenhum equipamento cadastrado.</li>
        )}
      </ul>

      <h2 className="font-semibold mb-2">Histórico</h2>
      <ul className="space-y-1">
        {historico.map((l) => (
          <li key={l.id} className="text-sm flex justify-between border-b border-[var(--border)] py-1">
            <span>{l.descricao}</span>
            <span>{money(l.valor)}</span>
          </li>
        ))}
        {historico.length === 0 && (
          <li className="text-sm text-[var(--text-dim)]">Nenhum lançamento vinculado a este cliente.</li>
        )}
      </ul>
    </div>
  );
}
