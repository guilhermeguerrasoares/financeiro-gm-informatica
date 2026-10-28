// As mesmas recusas que a RPC registrar_transferencia faz, do lado do app.
// Existem nos dois lugares de propósito: em produção o Next.js troca a
// mensagem de erro de Server Action por um texto genérico com digest, então o
// que o usuário lê é esta mensagem, não a do banco. A do banco continua sendo
// a que vale - ela pega qualquer caminho, inclusive o que não passou por aqui.
export type EntradaTransferencia = {
  origemId: string;
  destinoId: string;
  valor: number;
};

export function validarTransferencia({ origemId, destinoId, valor }: EntradaTransferencia): string | null {
  if (!origemId || !destinoId) {
    return "Escolha a conta de origem e a conta de destino.";
  }
  if (origemId === destinoId) {
    return "Origem e destino são a mesma conta: não há transferência a registrar.";
  }
  // Mesmo limiar do ajuste de saldo: abaixo de meio centavo não há movimento
  // real a registrar.
  if (!Number.isFinite(valor) || valor < 0.005) {
    return "Informe um valor maior que zero.";
  }
  return null;
}
