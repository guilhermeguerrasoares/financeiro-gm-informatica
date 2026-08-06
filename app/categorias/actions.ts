"use server";

import { revalidatePath } from "next/cache";
import { criarCategoria, atualizarCategoria } from "@/lib/queries/categorias";
import type { Categoria } from "@/lib/types";

function revalidarPaginasComCategorias() {
  revalidatePath("/categorias");
  revalidatePath("/lancamentos");
  revalidatePath("/relatorios");
  revalidatePath("/dividas");
}

export async function salvarCategoriaAction(formData: FormData) {
  const input = {
    nome: formData.get("nome") as string,
    grupo_dre: formData.get("grupo_dre") as string,
    frente_negocio: ((formData.get("frente_negocio") as string) || null) as Categoria["frente_negocio"],
  };

  const id = formData.get("id") as string;
  if (id) {
    await atualizarCategoria(id, input);
  } else {
    await criarCategoria(input);
  }

  revalidarPaginasComCategorias();
}
