// Nem toda linha de `lancamentos` é operação da loja. Algumas existem para
// corrigir ou movimentar saldo, e contá-las em faturamento, metas, DRE ou
// fluxo distorce justamente os números que elas deveriam deixar confiáveis.
//
// A regra mora aqui, num lugar só, porque ela estava repetida em seis pontos
// de cálculo - e uma lista repetida seis vezes é uma lista que mais cedo ou
// mais tarde fica com cinco itens certos e um errado. Acrescentar um tipo
// novo de linha não operacional passa a ser editar esta função; esquecer um
// ponto de chamada deixa de ser possível.
export type LinhaClassificavel = {
  ajuste_saldo: boolean;
  transferencia_id: string | null;
  movimento_fornecedor: "compra" | "ajuste" | "quitacao";
};

export function entraNosRelatorios(l: LinhaClassificavel): boolean {
  // Conciliação de conta: corrige o saldo, não é venda nem despesa.
  if (l.ajuste_saldo) return false;
  // Perna de transferência: o dinheiro mudou de lugar, não entrou nem saiu
  // da loja. Depositar R$ 1.000 do caixa no banco não é faturamento.
  if (l.transferencia_id !== null) return false;
  // Ajuste de dívida de fornecedor: reconhecer que se deve R$ 6.500 não é
  // gastar R$ 6.500 - não houve entrada nem saída. Ele nunca tem pagamento, e
  // como também não tem vencimento, "atrasado" não significa nada para ele:
  // por isso fica fora dos cards do dashboard junto com o resto.
  //
  // A quitação, ao contrário, ENTRA: o dinheiro saiu de verdade, e a compra
  // que gerou aquela dívida nunca foi lançada, então ela nunca bateu no DRE.
  if (l.movimento_fornecedor === "ajuste") return false;
  return true;
}
