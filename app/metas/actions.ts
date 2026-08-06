"use server";

import { revalidatePath } from "next/cache";
import { criarMeta, atualizarMeta, excluirMeta } from "@/lib/queries/metas";
import type { Meta } from "@/lib/types";

function revalidarPaginasComMetas() {
  revalidatePath("/metas");
  revalidatePath("/dashboard");
}

export async function salvarMetaAction(formData: FormData) {
  const metrica = formData.get("metrica") as Meta["metrica"];
  const input = {
    nome: formData.get("nome") as string,
    tipo: formData.get("tipo") as Meta["tipo"],
    metrica,
    categoria_id: metrica === "categoria" ? (formData.get("categoria_id") as string) : null,
    unidade: formData.get("unidade") as Meta["unidade"],
    valor_alvo: Number(formData.get("valor_alvo")),
    ativo: formData.get("ativo") === "on",
  };

  const id = formData.get("id") as string;
  if (id) {
    await atualizarMeta(id, input);
  } else {
    await criarMeta(input);
  }

  revalidarPaginasComMetas();
}

export async function excluirMetaAction(id: string) {
  await excluirMeta(id);
  revalidarPaginasComMetas();
}
