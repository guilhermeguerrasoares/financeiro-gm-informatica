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
};

export function entraNosRelatorios(l: LinhaClassificavel): boolean {
  // Conciliação de conta: corrige o saldo, não é venda nem despesa.
  if (l.ajuste_saldo) return false;
  // Perna de transferência: o dinheiro mudou de lugar, não entrou nem saiu
  // da loja. Depositar R$ 1.000 do caixa no banco não é faturamento.
  if (l.transferencia_id !== null) return false;
  return true;
}
