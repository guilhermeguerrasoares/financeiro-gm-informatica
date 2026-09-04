// Validações dos dois jeitos de mexer no estoque de permuta pela tela
// /permutas. Ficam aqui, puras, porque a gravação em si é uma RPC no
// Postgres (supabase/migrations/0020) - a regra do banco é a que vale contra
// duas abas, esta aqui existe para o usuário ver o erro antes de enviar.

// Tolerância de um centavo: os valores vêm de <input type="number"> e viram
// float, então comparar com > / < direto reprovaria um desmembramento que
// só erra na décima quinta casa.
const CENTAVO = 0.004;

export function validarDesmembramento(input: {
  valorEstimadoOriginal: number | null;
  novoValor: number;
  novaDescricao: string;
  descricaoOriginal: string;
}): string | null {
  if (!input.novaDescricao.trim() || !input.descricaoOriginal.trim()) {
    return "Informe a descrição dos dois itens.";
  }
  if (!input.valorEstimadoOriginal || input.valorEstimadoOriginal <= CENTAVO) {
    return "Este item não tem valor estimado para dividir.";
  }
  if (!(input.novoValor > CENTAVO)) {
    return "O valor do item separado precisa ser maior que zero.";
  }
  // Estritamente menor: se levasse o valor inteiro, o item original ficaria
  // valendo zero em estoque em vez de deixar de existir.
  if (input.novoValor >= input.valorEstimadoOriginal - CENTAVO) {
    return "O valor do item separado precisa ser menor que o valor do item original.";
  }
  return null;
}

export function validarPermutaAvulsa(input: {
  descricao: string;
  valorEstimado: number;
  dataEntrada: string;
  valorPago: number;
  contaFinanceiraId: string | null;
}): string | null {
  if (!input.descricao.trim()) {
    return "Informe a descrição do item.";
  }
  // Zero é válido: item que entrou sem custo nenhum revende com lucro cheio.
  if (!(input.valorEstimado >= 0)) {
    return "O valor estimado não pode ser negativo.";
  }
  if (!input.dataEntrada) {
    return "Informe a data de entrada do item.";
  }
  if (!(input.valorPago >= 0)) {
    return "O valor pago não pode ser negativo.";
  }
  // Sem conta, a despesa criada não sairia de saldo nenhum em /contas.
  if (input.valorPago > CENTAVO && !input.contaFinanceiraId) {
    return "Escolha a conta de onde saiu o dinheiro pago pelo item.";
  }
  return null;
}
