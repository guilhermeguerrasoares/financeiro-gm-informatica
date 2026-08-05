"use server";

import {
  criarLancamento,
  atualizarLancamento,
  excluirLancamento,
} from "@/lib/queries/lancamentos";
import { revalidarPaginasFinanceiras } from "./revalidate";

export async function salvarLancamentoAction(formData: FormData) {
  const id = formData.get("id") as string | null;

  const input = {
    descricao: formData.get("descricao") as string,
    tipo: formData.get("tipo") as "despesa" | "receita",
    categoria_id: (formData.get("categoria_id") as string) || null,
    cliente_id: null,
    fornecedor_id: null,
    conta_financeira_id: (formData.get("conta_financeira_id") as string) || null,
    equipamento_id: null,
    valor: Number(formData.get("valor")),
    custo: formData.get("custo") ? Number(formData.get("custo")) : null,
    vencimento: (formData.get("vencimento") as string) || null,
    competencia: (formData.get("vencimento") as string)?.slice(0, 7) || null,
    recorrencia: null,
    observacao: (formData.get("observacao") as string) || null,
  };

  if (id) {
    await atualizarLancamento(id, input);
  } else {
    await criarLancamento(input);
  }

  revalidarPaginasFinanceiras();
}

export async function excluirLancamentoAction(id: string) {
  await excluirLancamento(id);
  revalidarPaginasFinanceiras();
}
