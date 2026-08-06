import { listarItensPermuta } from "@/lib/queries/itensPermuta";
import { listarCategorias } from "@/lib/queries/categorias";
import { listarContasFinanceiras } from "@/lib/queries/contasFinanceiras";
import { PermutasList } from "./PermutasList";

export default async function PermutasPage() {
  const [itens, categorias, contas] = await Promise.all([
    listarItensPermuta(),
    listarCategorias(),
    listarContasFinanceiras(),
  ]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Permutas</h1>
      <PermutasList itens={itens} categorias={categorias} contas={contas} />
    </div>
  );
}
