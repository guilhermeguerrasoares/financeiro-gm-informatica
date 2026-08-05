"use server";

import { revalidatePath } from "next/cache";
import { criarContaFinanceira } from "@/lib/queries/contasFinanceiras";

export async function criarContaAction(formData: FormData) {
  await criarContaFinanceira({
    nome: formData.get("nome") as string,
    tipo: formData.get("tipo") as "caixa" | "banco" | "cartao",
    saldo_inicial: Number(formData.get("saldo_inicial") || 0),
  });
  revalidatePath("/contas");
}
