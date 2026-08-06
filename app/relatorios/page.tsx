import { dadosRelatorios } from "@/lib/queries/relatorios";
import { money } from "@/lib/format";

const FRENTE_LABEL: Record<string, string> = {
  pecas_acessorios: "Peças e Acessórios",
  computadores: "Computadores",
  assistencia_tecnica: "Assistência Técnica",
  outros: "Outros",
};

export default async function RelatoriosPage() {
  const { porCategoria, porFrente } = await dadosRelatorios();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Relatórios</h1>

      <h2 className="font-semibold mb-2">Por frente de negócio</h2>
      <table className="w-full text-sm border-collapse mb-8">
        <thead>
          <tr className="text-left text-[var(--text-dim)] text-xs uppercase border-b border-[var(--border)]">
            <th className="py-2">Frente</th>
            <th className="text-right">Receita</th>
            <th className="text-right">Custo</th>
            <th className="text-right">Margem</th>
          </tr>
        </thead>
        <tbody>
          {porFrente.map((r) => (
            <tr key={r.frente} className="border-b border-[var(--border)]">
              <td className="py-2">{FRENTE_LABEL[r.frente]}</td>
              <td className="text-right">{money(r.receita)}</td>
              <td className="text-right">{money(r.custo)}</td>
              <td className="text-right font-semibold text-[var(--accent-green)]">{money(r.margem)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="font-semibold mb-2">Por categoria</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-[var(--text-dim)] text-xs uppercase border-b border-[var(--border)]">
            <th className="py-2">Categoria</th>
            <th className="text-right">Total</th>
            <th className="text-right">Pago</th>
            <th className="text-right">Vencido</th>
          </tr>
        </thead>
        <tbody>
          {porCategoria.map((r) => (
            <tr key={r.categoria} className="border-b border-[var(--border)]">
              <td className="py-2">{r.categoria}</td>
              <td className="text-right">{money(r.total)}</td>
              <td className="text-right">{money(r.pago)}</td>
              <td className="text-right text-[var(--accent-red)]">{money(r.vencido)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
