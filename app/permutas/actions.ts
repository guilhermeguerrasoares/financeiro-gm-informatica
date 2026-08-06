"use server";

import { revalidatePath } from "next/cache";
import { venderItemPermuta } from "@/lib/queries/itensPermuta";
import { revalidarPaginasFinanceiras } from "@/app/lancamentos/revalidate";

export async function venderItemPermutaAction(formData: FormData) {
  const itemId = formData.get("item_id") as string;
  const descricaoItem = formData.get("descricao_item") as string;
  const valorEstimadoRaw = formData.get("valor_estimado_item") as string;
  const valorVenda = Number(formData.get("valor_venda"));
  const dataVenda = formData.get("data_venda") as string;
  const formaPagamento = (formData.get("forma_pagamento") as string) || null;
  const contaFinanceiraId = (formData.get("conta_financeira_id") as string) || null;
  const categoriaId = (formData.get("categoria_id") as string) || null;

  await venderItemPermuta({
    item_id: itemId,
    descricao: `Venda de permuta: ${descricaoItem}`,
    valor: valorVenda,
    custo: valorEstimadoRaw ? Number(valorEstimadoRaw) : null,
    data: dataVenda,
    forma_pagamento: formaPagamento,
    conta_financeira_id: contaFinanceiraId,
    categoria_id: categoriaId,
  });

  revalidatePath("/permutas");
  revalidarPaginasFinanceiras();
}
