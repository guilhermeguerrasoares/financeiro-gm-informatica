"use server";

import { revalidatePath } from "next/cache";
import {
  venderItemPermuta,
  desmembrarItemPermuta,
  criarItemPermutaAvulso,
} from "@/lib/queries/itensPermuta";
import { validarDesmembramento, validarPermutaAvulsa } from "@/lib/permutas";
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

export async function desmembrarItemPermutaAction(formData: FormData) {
  const itemId = formData.get("item_id") as string;
  const descricaoOriginal = ((formData.get("descricao_original") as string) ?? "").trim();
  const novaDescricao = ((formData.get("nova_descricao") as string) ?? "").trim();
  const novoValor = Number(formData.get("novo_valor"));
  const valorEstimadoOriginalRaw = formData.get("valor_estimado_original") as string;

  const erro = validarDesmembramento({
    valorEstimadoOriginal: valorEstimadoOriginalRaw ? Number(valorEstimadoOriginalRaw) : null,
    novoValor,
    novaDescricao,
    descricaoOriginal,
  });
  if (erro) throw new Error(erro);

  await desmembrarItemPermuta({
    item_id: itemId,
    descricao_original: descricaoOriginal,
    nova_descricao: novaDescricao,
    novo_valor: novoValor,
  });

  revalidatePath("/permutas");
  revalidarPaginasFinanceiras();
}

export async function criarPermutaAvulsaAction(formData: FormData) {
  const descricao = ((formData.get("descricao") as string) ?? "").trim();
  const valorEstimado = Number(formData.get("valor_estimado") ?? 0);
  const dataEntrada = formData.get("data_entrada") as string;
  const observacao = ((formData.get("observacao") as string) ?? "").trim() || null;
  const valorPago = Number(formData.get("valor_pago") || 0);
  const contaFinanceiraId = (formData.get("conta_financeira_id") as string) || null;
  const categoriaId = (formData.get("categoria_id") as string) || null;
  const formaPagamento = (formData.get("forma_pagamento") as string) || null;

  const erro = validarPermutaAvulsa({
    descricao,
    valorEstimado,
    dataEntrada,
    valorPago,
    contaFinanceiraId,
  });
  if (erro) throw new Error(erro);

  await criarItemPermutaAvulso({
    descricao,
    valor_estimado: valorEstimado,
    data_entrada: dataEntrada,
    observacao,
    valor_pago: valorPago,
    // Sem dinheiro saindo não há despesa para criar, então conta/categoria/
    // forma escolhidas por engano no formulário não vão para lugar nenhum.
    conta_financeira_id: valorPago > 0.004 ? contaFinanceiraId : null,
    categoria_id: valorPago > 0.004 ? categoriaId : null,
    forma_pagamento: valorPago > 0.004 ? formaPagamento : null,
  });

  revalidatePath("/permutas");
  revalidarPaginasFinanceiras();
}
