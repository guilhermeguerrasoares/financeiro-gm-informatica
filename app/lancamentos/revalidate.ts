import { revalidatePath } from "next/cache";

// Every page that derives numbers from lancamentos/pagamentos, so a save
// anywhere in the app shows up everywhere else without a manual refresh.
export function revalidarPaginasFinanceiras() {
  revalidatePath("/lancamentos");
  revalidatePath("/dashboard");
  revalidatePath("/dividas");
  revalidatePath("/relatorios");
  revalidatePath("/fornecedores");
  revalidatePath("/contas");
}
