import { listarItensPermuta } from "@/lib/queries/itensPermuta";
import { money } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  em_estoque: "Em estoque",
  revendido: "Revendido",
  usado_em_conserto: "Usado em conserto",
  descartado: "Descartado",
};

export default async function PermutasPage() {
  const itens = await listarItensPermuta();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Permutas</h1>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-[var(--text-dim)] text-xs uppercase border-b border-[var(--border)]">
            <th className="py-2">Item</th>
            <th>Status</th>
            <th className="text-right">Valor estimado</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr key={item.id} className="border-b border-[var(--border)]">
              <td className="py-2">{item.descricao}</td>
              <td className="text-[var(--text-dim)]">{STATUS_LABEL[item.status]}</td>
              <td className="text-right">{money(item.valor_estimado)}</td>
            </tr>
          ))}
          {itens.length === 0 && (
            <tr>
              <td colSpan={3} className="py-8 text-center text-[var(--text-dim)]">
                Nenhum item de permuta registrado ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
