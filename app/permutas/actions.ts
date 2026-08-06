"use server";

import { revalidatePath } from "next/cache";
import { criarLancamento } from "@/lib/queries/lancamentos";
import { registrarPagamento } from "@/lib/queries/pagamentos";
import { marcarItemPermutaVendido } from "@/lib/queries/itensPermuta";

export async function venderItemPermutaAction(formData: FormData) {
  const itemId = formData.get("item_id") as string;
  const descricaoItem = formData.get("descricao_item") as string;
  const valorVenda = Number(formData.get("valor_venda"));
  const dataVenda = formData.get("data_venda") as string;
  const formaPagamento = (formData.get("forma_pagamento") as string) || null;
  const contaFinanceiraId = (formData.get("conta_financeira_id") as string) || null;
  const categoriaId = (formData.get("categoria_id") as string) || null;

  const lancamento = await criarLancamento({
    descricao: `Venda de permuta: ${descricaoItem}`,
    tipo: "receita",
    categoria_id: categoriaId,
    cliente_id: null,
    fornecedor_id: null,
    conta_financeira_id: contaFinanceiraId,
    equipamento_id: null,
    valor: valorVenda,
    custo: null,
    vencimento: dataVenda,
    competencia: dataVenda.slice(0, 7),
    recorrencia: null,
    observacao: null,
  });

  // Venda de permuta já nasce quitada - o dinheiro entra no ato da venda.
  await registrarPagamento({
    lancamento_id: lancamento.id,
    valor: valorVenda,
    taxa: null,
    forma_pagamento: formaPagamento,
    data_pagamento: dataVenda,
    comprovante_url: null,
    observacao: null,
  });

  await marcarItemPermutaVendido(itemId, {
    data_venda: dataVenda,
    valor_venda: valorVenda,
    lancamento_venda_id: lancamento.id,
  });

  revalidatePath("/permutas");
  revalidatePath("/dashboard");
  revalidatePath("/lancamentos");
}
