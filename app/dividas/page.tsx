import { listarDividasClientes, listarDividasLoja } from "@/lib/queries/dividas";
import { listarClientes } from "@/lib/queries/clientes";
import { listarPagamentos } from "@/lib/queries/pagamentos";
import { saldo, status as calcStatus } from "@/lib/calculations";
import { money, formatDataBR, hoje } from "@/lib/format";
import { StatusTag } from "@/components/StatusTag";

export default async function DividasPage() {
  const [dividasClientes, dividasLoja, clientes, pagamentos] = await Promise.all([
    listarDividasClientes(),
    listarDividasLoja(),
    listarClientes(),
    listarPagamentos(),
  ]);

  const hojeStr = hoje();
  const nomeCliente = (id: string | null) => clientes.find((c) => c.id === id)?.nome ?? "—";

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Dívidas</h1>

      <h2 className="font-semibold mb-2">Clientes devendo</h2>
      <table className="w-full text-sm border-collapse mb-8">
        <thead>
          <tr className="text-left text-[var(--text-dim)] text-xs uppercase border-b border-[var(--border)]">
            <th className="py-2">Cliente</th>
            <th>Vencimento</th>
            <th>Situação</th>
            <th className="text-right">Falta</th>
          </tr>
        </thead>
        <tbody>
          {dividasClientes
            .filter((l) => saldo(l, pagamentos) > 0.004)
            .map((l) => (
              <tr key={l.id} className="border-b border-[var(--border)]">
                <td className="py-2">{nomeCliente(l.cliente_id)}</td>
                <td>{formatDataBR(l.vencimento)}</td>
                <td>
                  <StatusTag status={calcStatus(l, pagamentos, hojeStr)} />
                </td>
                <td className="text-right font-semibold text-[var(--accent-red)]">{money(saldo(l, pagamentos))}</td>
              </tr>
            ))}
        </tbody>
      </table>

      <h2 className="font-semibold mb-2">Dívidas da loja (empréstimos e financiamentos)</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-[var(--text-dim)] text-xs uppercase border-b border-[var(--border)]">
            <th className="py-2">Descrição</th>
            <th>Vencimento</th>
            <th>Situação</th>
            <th className="text-right">Falta</th>
          </tr>
        </thead>
        <tbody>
          {dividasLoja
            .filter((l) => saldo(l, pagamentos) > 0.004)
            .map((l) => (
              <tr key={l.id} className="border-b border-[var(--border)]">
                <td className="py-2">{l.descricao}</td>
                <td>{formatDataBR(l.vencimento)}</td>
                <td>
                  <StatusTag status={calcStatus(l, pagamentos, hojeStr)} />
                </td>
                <td className="text-right font-semibold text-[var(--accent-red)]">{money(saldo(l, pagamentos))}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
