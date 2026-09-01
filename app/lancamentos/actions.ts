"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  criarLancamento,
  atualizarLancamento,
  excluirLancamento,
} from "@/lib/queries/lancamentos";
import {
  reverterItemPermutaPorLancamento,
  buscarItensPermutaPorLancamentoOrigem,
} from "@/lib/queries/itensPermuta";
import { registrarPagamentoComPermuta } from "./permutaPagamento";
import { round2 } from "@/lib/calculations";
import { montarOcorrencias, type Frequencia, type ModoValor } from "@/lib/series";
import { criarSerie, atualizarSerie, excluirSerie } from "@/lib/queries/series";
import { revalidarPaginasFinanceiras } from "./revalidate";
import { validarComprovante, montarCaminhoComprovante } from "@/lib/comprovantes";

// O erro de validação volta como valor, não como exceção: o Next.js redige
// mensagens de erro de server action em produção (troca por um texto
// genérico com digest), então um `throw` aqui nunca chegaria ao usuário em
// português. Falha de upload no Storage continua lançando exceção - é
// inesperada, não uma validação com mensagem pensada para o usuário ler.
async function uploadComprovanteServidor(
  arquivo: File,
  lancamentoId: string
): Promise<{ path: string | null; erro: string | null }> {
  if (arquivo.size === 0) return { path: null, erro: null };
  const erro = validarComprovante(arquivo);
  if (erro) return { path: null, erro };
  const supabase = await createClient();
  const path = montarCaminhoComprovante(lancamentoId, arquivo.name, Date.now());
  const { error } = await supabase.storage.from("comprovantes").upload(path, arquivo);
  if (error) throw error;
  return { path, erro: null };
}

// 12 meses à frente numa conta fixa mensal. A parcelada usa o número de
// parcelas que o usuário digitou.
const MESES_CONTA_FIXA = 12;

async function criarSerieDoFormulario(formData: FormData, tipoSerie: "parcelada" | "fixa") {
  const vencimento = (formData.get("vencimento") as string) || "";
  if (!vencimento) {
    throw new Error("Informe o vencimento da primeira ocorrência para poder repetir o lançamento.");
  }

  const frequencia: Frequencia =
    tipoSerie === "fixa" ? "mensal" : ((formData.get("frequencia") as Frequencia) || "mensal");
  const totalParcelas = tipoSerie === "parcelada" ? Number(formData.get("total_parcelas")) : null;

  if (tipoSerie === "parcelada" && (!totalParcelas || totalParcelas < 2)) {
    throw new Error("Um lançamento parcelado precisa de pelo menos 2 parcelas.");
  }

  const valor = Number(formData.get("valor"));
  const custo = formData.get("custo") ? Number(formData.get("custo")) : null;
  // Na conta fixa o valor digitado é sempre o de cada mês - não há total a
  // dividir, porque a série não tem fim.
  const modo: ModoValor =
    tipoSerie === "fixa" ? "parcela" : ((formData.get("modo_valor") as ModoValor) || "total");

  const serie = {
    tipo_serie: tipoSerie,
    frequencia,
    data_inicio: vencimento,
    total_parcelas: totalParcelas,
    descricao: formData.get("descricao") as string,
    tipo: formData.get("tipo") as "despesa" | "receita",
    categoria_id: (formData.get("categoria_id") as string) || null,
    cliente_id: (formData.get("cliente_id") as string) || null,
    fornecedor_id: (formData.get("fornecedor_id") as string) || null,
    // O modelo guarda o valor de UMA ocorrência: é dele que as próximas
    // nascem. Guardar o total faria a conta fixa gerar meses de R$ 1.200 onde
    // deveriam ser R$ 400.
    valor: modo === "total" && totalParcelas ? round2(valor / totalParcelas) : valor,
    custo: modo === "total" && totalParcelas && custo !== null ? round2(custo / totalParcelas) : custo,
    observacao: (formData.get("observacao") as string) || null,
  };

  const ocorrencias = montarOcorrencias({
    dataInicio: vencimento,
    frequencia,
    parcelas: totalParcelas ?? MESES_CONTA_FIXA,
    valor,
    custo,
    modo,
  });

  await criarSerie(serie, ocorrencias);
  revalidarPaginasFinanceiras();
  return { lancamento: null, aviso: null };
}

export async function salvarLancamentoAction(formData: FormData) {
  const id = formData.get("id") as string | null;
  const registrandoPagamento = !id && formData.get("registrar_pagamento") === "on";

  const repeticao = (formData.get("repeticao") as string) || "nenhuma";

  // Criação de série é um caminho próprio: em vez de um lançamento, nascem N.
  // Só vale na criação - editar uma parcela nunca reconstrói a série.
  if (!id && repeticao !== "nenhuma") {
    return criarSerieDoFormulario(formData, repeticao as "parcelada" | "fixa");
  }

  // Validado antes de criar o lançamento: se deixarmos passar e
  // registrarPagamentoComPermuta rejeitar só depois, o lançamento já teria
  // sido criado sem nenhum pagamento, e reenviar o formulário (que não tem
  // um `id` pra reaproveitar) criaria um lançamento duplicado.
  if (registrandoPagamento) {
    const permutaDescricao = (formData.get("permuta_descricao") as string) || "";
    const valorCaixa = round2(Number(formData.get("pagamento_valor")) || 0);
    const valorPermuta = permutaDescricao ? round2(Number(formData.get("permuta_valor")) || 0) : 0;
    if (valorCaixa <= 0.004 && valorPermuta <= 0.004) {
      throw new Error("Informe um valor pago (em dinheiro/outro e/ou em permuta) maior que zero.");
    }

    // Mesmo motivo do comentário acima: um comprovante inválido não pode
    // ser descoberto só depois de criarLancamento. validarComprovante é
    // pura (só olha type/size), então dá pra rodar aqui sem custo de I/O.
    // Um arquivo de 0 byte é tratado como "nenhum arquivo", igual ao que
    // uploadComprovanteServidor já faz mais abaixo.
    const arquivoComprovante = formData.get("comprovante") as File | null;
    if (arquivoComprovante && arquivoComprovante.size > 0) {
      const erroComprovante = validarComprovante(arquivoComprovante);
      if (erroComprovante) {
        return { lancamento: null, aviso: null, erro: erroComprovante };
      }
    }
  }

  const input = {
    descricao: formData.get("descricao") as string,
    tipo: formData.get("tipo") as "despesa" | "receita",
    categoria_id: (formData.get("categoria_id") as string) || null,
    cliente_id: (formData.get("cliente_id") as string) || null,
    fornecedor_id: (formData.get("fornecedor_id") as string) || null,
    equipamento_id: null,
    valor: Number(formData.get("valor")),
    custo: formData.get("custo") ? Number(formData.get("custo")) : null,
    vencimento: (formData.get("vencimento") as string) || null,
    competencia: (formData.get("vencimento") as string)?.slice(0, 7) || null,
    observacao: (formData.get("observacao") as string) || null,
  };

  const lancamento = id ? await atualizarLancamento(id, input) : await criarLancamento(input);

  // Propagação para o resto da série. `vencimento` e `tipo` ficam de fora de
  // propósito: cada ocorrência tem a data dela, e trocar entrada por saída no
  // meio de uma série é erro de digitação, não intenção.
  const alcance = (formData.get("alcance") as string) || "este";
  let aviso: string | null = null;

  if (id && (alcance === "proximos" || alcance === "todos")) {
    const { alterados, pulados_pagos } = await atualizarSerie(id, alcance, {
      descricao: input.descricao,
      categoria_id: input.categoria_id,
      cliente_id: input.cliente_id,
      fornecedor_id: input.fornecedor_id,
      valor: input.valor,
      custo: input.custo,
      observacao: input.observacao,
    });
    if (pulados_pagos > 0) {
      aviso = `${alterados} lançamento(s) atualizado(s). ${pulados_pagos} já pago(s) não foram alterados.`;
    }
  }

  // Pagamento inline só se aplica à criação (o botão "Pagar" da tabela cobre
  // lançamentos já existentes, que têm seu próprio fluxo em PagamentoModal).
  if (registrandoPagamento) {
    const dataPagamento = formData.get("data_pagamento") as string;
    const permutaDescricao = (formData.get("permuta_descricao") as string) || "";
    const arquivo = formData.get("comprovante") as File | null;
    const comprovante = arquivo
      ? await uploadComprovanteServidor(arquivo, lancamento.id)
      : { path: null, erro: null };
    // Nesse fluxo (registrandoPagamento) o comprovante já foi validado antes
    // de criarLancamento, então este `erro` não deveria mais disparar aqui -
    // fica como cinto e suspensório: é a validação própria de
    // uploadComprovanteServidor, mantida mesmo virando inalcançável.
    if (comprovante.erro) {
      revalidarPaginasFinanceiras();
      return { lancamento, aviso, erro: comprovante.erro };
    }
    const taxaRaw = formData.get("taxa") as string;

    const { criouPermuta } = await registrarPagamentoComPermuta({
      lancamentoId: lancamento.id,
      dataPagamento,
      valorCaixa: Number(formData.get("pagamento_valor")) || 0,
      taxa: taxaRaw ? Number(taxaRaw) : null,
      formaPagamento: (formData.get("forma_pagamento") as string) || null,
      comprovanteUrl: comprovante.path,
      permutaDescricao,
      valorPermuta: Number(formData.get("permuta_valor")) || 0,
      contaFinanceiraId: (formData.get("conta_financeira_id") as string) || null,
    });
    if (criouPermuta) revalidatePath("/permutas");
  }

  revalidarPaginasFinanceiras();
  return { lancamento, aviso };
}

export async function excluirLancamentoAction(
  id: string,
  alcance: "este" | "proximos" | "todos" = "este"
): Promise<string | null> {
  // Se algum pagamento deste lançamento gerou um item de permuta que já foi
  // revendido (ou baixado), apagar o lançamento apagaria o item em cascata
  // e deixaria a venda dele órfã, sem nenhum item por trás. Mesma trava que
  // estornarPagamentoAction já tem no nível de pagamento.
  const itensDeOrigem = await buscarItensPermutaPorLancamentoOrigem(id);
  const itemJaMovimentado = itensDeOrigem.find((item) => item.status !== "em_estoque");
  if (itemJaMovimentado) {
    throw new Error(
      "Este lançamento gerou um item de permuta que já foi vendido (ou baixado). Reverta isso antes de excluir o lançamento."
    );
  }

  // Se este lançamento veio de uma venda de permuta, devolve o item pro
  // estoque antes de apagar - senão ele fica preso em "vendido" pra sempre,
  // sem lançamento nenhum por trás.
  await reverterItemPermutaPorLancamento(id);

  // Alcance de série: a RPC apaga de uma vez os lançamentos em aberto no
  // alcance escolhido e encerra a recorrência, para o reabastecimento não
  // recriar na próxima abertura da tela o que acabou de ser apagado.
  if (alcance === "proximos" || alcance === "todos") {
    const { excluidos, pulados_pagos } = await excluirSerie(id, alcance);
    revalidatePath("/permutas");
    revalidarPaginasFinanceiras();
    return pulados_pagos > 0
      ? `${excluidos} lançamento(s) excluído(s). ${pulados_pagos} já pago(s) foram mantidos.`
      : null;
  }

  await excluirLancamento(id);
  revalidatePath("/permutas");
  revalidarPaginasFinanceiras();
  return null;
}
