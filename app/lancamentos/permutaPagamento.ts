import { registrarPagamentoComPermutaTransacional } from "@/lib/queries/pagamentos";
import { round2 } from "@/lib/calculations";

// Um pagamento pode ser parte em dinheiro/cartão, parte em permuta - os dois
// valores SOMAM (não um desconta do outro). A gravação em si (pagamento(s) +
// item de permuta) é atômica, feita pela função Postgres
// registrar_pagamento_com_permuta (supabase/migrations/0010). Compartilhado
// entre o fluxo de criação (actions.ts) e o de pagamento avulso
// (pagamentoActions.ts) para não deixar as duas cópias divergirem.
export async function registrarPagamentoComPermuta(input: {
  lancamentoId: string;
  dataPagamento: string;
  valorCaixa: number;
  taxa: number | null;
  formaPagamento: string | null;
  comprovanteUrl: string | null;
  permutaDescricao: string;
  valorPermuta: number;
}) {
  const valorCaixa = round2(input.valorCaixa);
  const valorPermuta = input.permutaDescricao ? round2(input.valorPermuta) : 0;

  if (valorCaixa <= 0.004 && valorPermuta <= 0.004) {
    throw new Error("Informe um valor pago (em dinheiro/outro e/ou em permuta) maior que zero.");
  }

  await registrarPagamentoComPermutaTransacional({
    lancamento_id: input.lancamentoId,
    data_pagamento: input.dataPagamento,
    valor_caixa: valorCaixa,
    taxa: input.taxa,
    forma_pagamento: input.formaPagamento,
    comprovante_url: input.comprovanteUrl,
    permuta_descricao: input.permutaDescricao,
    valor_permuta: valorPermuta,
  });

  return { criouPermuta: valorPermuta > 0.004 && !!input.permutaDescricao };
}
