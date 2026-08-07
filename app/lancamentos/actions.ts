"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  criarLancamento,
  atualizarLancamento,
  excluirLancamento,
} from "@/lib/queries/lancamentos";
import { registrarPagamento } from "@/lib/queries/pagamentos";
import { criarItemPermuta, reverterItemPermutaPorLancamento } from "@/lib/queries/itensPermuta";
import { round2 } from "@/lib/calculations";
import { revalidarPaginasFinanceiras } from "./revalidate";

async function uploadComprovanteServidor(arquivo: File, lancamentoId: string): Promise<string | null> {
  if (arquivo.size === 0) return null;
  const supabase = await createClient();
  const path = `${lancamentoId}/${Date.now()}-${arquivo.name}`;
  const { error } = await supabase.storage.from("comprovantes").upload(path, arquivo);
  if (error) throw error;
  return path;
}

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

  const lancamento = id ? await atualizarLancamento(id, input) : await criarLancamento(input);

  // Pagamento inline só se aplica à criação (o botão "Pagar" da tabela cobre
  // lançamentos já existentes, que têm seu próprio fluxo em PagamentoModal).
  if (!id && formData.get("registrar_pagamento") === "on") {
    const dataPagamento = formData.get("data_pagamento") as string;
    const permutaDescricao = formData.get("permuta_descricao") as string;
    // Uma venda pode ser paga parte em dinheiro/cartão, parte em permuta -
    // os dois valores SOMAM (não um desconta do outro), e cada um vira um
    // pagamento separado, porque forma_pagamento é por pagamento, não por
    // lançamento (ex: R$4.000 em pix + R$1.000 num item recebido em
    // permuta = R$5.000 pagos).
    const valorCaixa = round2(Number(formData.get("pagamento_valor")) || 0);
    const valorPermuta = permutaDescricao ? round2(Number(formData.get("permuta_valor")) || 0) : 0;

    if (valorCaixa > 0.004) {
      const arquivo = formData.get("comprovante") as File | null;
      const comprovantePath = arquivo ? await uploadComprovanteServidor(arquivo, lancamento.id) : null;
      const taxaRaw = formData.get("taxa") as string;
      await registrarPagamento({
        lancamento_id: lancamento.id,
        valor: valorCaixa,
        taxa: taxaRaw ? Number(taxaRaw) : null,
        forma_pagamento: (formData.get("forma_pagamento") as string) || null,
        data_pagamento: dataPagamento,
        comprovante_url: comprovantePath,
        observacao: null,
      });
    }

    // Mesmo trade-off não-transacional do fluxo de pagamento avulso: se a
    // criação do item de permuta falhar aqui, o pagamento já foi gravado.
    if (valorPermuta > 0.004 && permutaDescricao) {
      const pagamentoPermuta = await registrarPagamento({
        lancamento_id: lancamento.id,
        valor: valorPermuta,
        taxa: null,
        forma_pagamento: "permuta",
        data_pagamento: dataPagamento,
        comprovante_url: null,
        observacao: null,
      });
      await criarItemPermuta({
        pagamento_id: pagamentoPermuta.id,
        descricao: permutaDescricao,
        valor_estimado: valorPermuta,
        status: "em_estoque",
      });
      revalidatePath("/permutas");
    }
  }

  revalidarPaginasFinanceiras();
  return lancamento;
}

export async function excluirLancamentoAction(id: string) {
  // Se este lançamento veio de uma venda de permuta, devolve o item pro
  // estoque antes de apagar - senão ele fica preso em "vendido" pra sempre,
  // sem lançamento nenhum por trás.
  await reverterItemPermutaPorLancamento(id);
  await excluirLancamento(id);
  revalidatePath("/permutas");
  revalidarPaginasFinanceiras();
}
