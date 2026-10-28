"use server";

import { registrarAjusteDivida } from "@/lib/queries/fornecedores";
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
