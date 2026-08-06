import { listarMetas } from "@/lib/queries/metas";
import { listarCategorias } from "@/lib/queries/categorias";
import { MetasList } from "./MetasList";

export default async function MetasPage() {
  const [metas, categorias] = await Promise.all([listarMetas(), listarCategorias()]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Metas e limites</h1>
      <MetasList metas={metas} categorias={categorias} />
    </div>
  );
}
