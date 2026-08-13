import { registrarPagamento } from "@/lib/queries/pagamentos";
import { criarItemPermuta } from "@/lib/queries/itensPermuta";
import { round2 } from "@/lib/calculations";

// Um pagamento pode ser parte em dinheiro/cartão, parte em permuta - os dois
// valores SOMAM (não um desconta do outro), e cada um vira um pagamento
// separado, porque forma_pagamento é por pagamento, não por lançamento (ex:
// R$4.000 em pix + R$1.000 num item recebido em permuta = R$5.000 pagos).
// Compartilhado entre o fluxo de criação (actions.ts) e o de pagamento
// avulso (pagamentoActions.ts) para não deixar as duas cópias divergirem.
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

  // Os dois inserts são independentes um do outro (só criarItemPermuta
  // depende do id do pagamento em permuta) - rodam em paralelo em vez de em
  // série pra não dobrar a latência à toa.
  //
  // Not wrapped in a DB transaction: pagamento e itens_permuta são duas
  // gravações separadas. Se a segunda falhar depois da primeira, o
  // pagamento fica registrado mas o item de permuta não - aceito como
  // trade-off de v1 (uma RPC no Postgres fecharia essa brecha depois).
  const [, criouPermuta] = await Promise.all([
    valorCaixa > 0.004
      ? registrarPagamento({
          lancamento_id: input.lancamentoId,
          valor: valorCaixa,
          taxa: input.taxa,
          forma_pagamento: input.formaPagamento,
          data_pagamento: input.dataPagamento,
          comprovante_url: input.comprovanteUrl,
          observacao: null,
        })
      : Promise.resolve(null),
    valorPermuta > 0.004 && input.permutaDescricao
      ? registrarPagamento({
          lancamento_id: input.lancamentoId,
          valor: valorPermuta,
          taxa: null,
          forma_pagamento: "permuta",
          data_pagamento: input.dataPagamento,
          // Se não houve pagamento em caixa, o comprovante (se houver) vem
          // pra cá - senão ele foi anexado ao pagamento em caixa acima e
          // ficaria órfão no Storage sem nenhum pagamento apontando pra ele.
          comprovante_url: valorCaixa > 0.004 ? null : input.comprovanteUrl,
          observacao: null,
        }).then(async (pagamentoPermuta) => {
          await criarItemPermuta({
            pagamento_id: pagamentoPermuta.id,
            descricao: input.permutaDescricao,
            valor_estimado: valorPermuta,
            status: "em_estoque",
          });
          return true;
        })
      : Promise.resolve(false),
  ]);

  return { criouPermuta };
}
