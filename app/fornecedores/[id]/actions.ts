"use server";

import { registrarAjusteDivida, registrarQuitacaoDivida } from "@/lib/queries/fornecedores";
import { listarLancamentos } from "@/lib/queries/lancamentos";
import { listarPagamentos } from "@/lib/queries/pagamentos";
import { temCompraEmAberto } from "@/lib/fornecedores";
import { round2 } from "@/lib/calculations";
import { revalidarPaginasFinanceiras } from "@/app/lancamentos/revalidate";

export async function ajustarDividaAction(formData: FormData) {
  const dividaReal = round2(Number(formData.get("divida_real")));
  const dividaSistema = round2(Number(formData.get("divida_sistema")));
  const diferenca = round2(dividaReal - dividaSistema);

  if (!Number.isFinite(dividaReal)) {
    throw new Error("Informe quanto você deve de verdade a este fornecedor.");
  }
  // Mesmo limite do lado do banco: abaixo de meio centavo não há diferença
  // real, e gravar um ajuste de zero só sujaria o histórico.
  if (Math.abs(diferenca) < 0.005) {
    throw new Error("A dívida informada já é igual à dívida do sistema: não há nada para ajustar.");
  }

  await registrarAjusteDivida({
    fornecedor_id: formData.get("fornecedor_id") as string,
    data: formData.get("data") as string,
    diferenca,
    observacao: (formData.get("observacao") as string) || null,
  });

  revalidarPaginasFinanceiras();
}

export async function registrarQuitacaoAction(formData: FormData) {
  const fornecedorId = formData.get("fornecedor_id") as string;
  const valor = round2(Number(formData.get("valor")));
  const contaId = (formData.get("conta_financeira_id") as string) || "";

  if (!(valor > 0.004)) {
    throw new Error("Informe um valor maior que zero.");
  }
  if (!contaId) {
    throw new Error("Escolha a conta de onde saiu o dinheiro.");
  }

  // A mesma recusa que a RPC faz, aqui também: em produção o Next troca o
  // texto de erro de Server Action por um genérico, e esta mensagem precisa
  // ser lida para o dono saber o que fazer em vez disso.
  const [lancamentos, pagamentos] = await Promise.all([listarLancamentos(), listarPagamentos()]);
  if (temCompraEmAberto(fornecedorId, lancamentos, pagamentos)) {
    throw new Error(
      "Este fornecedor tem compras lançadas ainda em aberto. Dê baixa nelas em vez de registrar um pagamento solto — a compra já contou como despesa no mês dela, e um pagamento por cima contaria a mesma despesa duas vezes."
    );
  }

  await registrarQuitacaoDivida({
    fornecedor_id: fornecedorId,
    data: formData.get("data") as string,
    valor,
    conta_financeira_id: contaId,
    categoria_id: (formData.get("categoria_id") as string) || null,
    forma_pagamento: (formData.get("forma_pagamento") as string) || null,
    observacao: (formData.get("observacao") as string) || null,
    idempotency_key: (formData.get("idempotency_key") as string) || null,
  });

  revalidarPaginasFinanceiras();
}
