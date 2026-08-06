import { listarCategorias } from "@/lib/queries/categorias";
import { CategoriasList } from "./CategoriasList";

export default async function CategoriasPage() {
  const categorias = await listarCategorias();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Categorias</h1>
      <CategoriasList categorias={categorias} />
    </div>
  );
}
