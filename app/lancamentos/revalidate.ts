import { revalidatePath } from "next/cache";

// Every page that derives numbers from lancamentos/pagamentos, so a save
// anywhere in the app shows up everywhere else without a manual refresh.
export function revalidarPaginasFinanceiras() {
  revalidatePath("/lancamentos");
  revalidatePath("/dashboard");
  revalidatePath("/dividas");
  revalidatePath("/relatorios");
  revalidatePath("/fornecedores");
  // A tela de um fornecedor é rota dinâmica, e o Next revalida o caminho
  // literal: sem esta linha, informar a dívida ou pagar deixava o cartão
  // "Devo" mostrando o número velho, e o dono lançava de novo achando que
  // não tinha gravado. A forma com "[id]" alcança todos os fornecedores.
  revalidatePath("/fornecedores/[id]", "page");
  revalidatePath("/contas");
}
