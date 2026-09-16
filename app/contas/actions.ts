"use server";

import { revalidatePath } from "next/cache";
import {
  criarContaFinanceira,
  registrarAjusteSaldo,
  contarPagamentosDaConta,
  excluirContaFinanceira,
} from "@/lib/queries/contasFinanceiras";
import { round2 } from "@/lib/calculations";
import { revalidarPaginasFinanceiras } from "@/app/lancamentos/revalidate";

export async function ajustarSaldoAction(formData: FormData) {
  const saldoReal = round2(Number(formData.get("saldo_real")));
  const saldoSistema = round2(Number(formData.get("saldo_sistema")));
  const diferenca = round2(saldoReal - saldoSistema);

  if (!Number.isFinite(saldoReal)) {
    throw new Error("Informe o saldo real da conta.");
  }
  // Mesmo limite do lado do banco: abaixo de meio centavo não há diferença
  // real, e gravar um ajuste de zero só sujaria o extrato.
  if (Math.abs(diferenca) < 0.005) {
    throw new Error("O saldo informado já é igual ao saldo do sistema: não há nada para ajustar.");
  }

  await registrarAjusteSaldo({
    conta_financeira_id: formData.get("conta_financeira_id") as string,
    data: formData.get("data") as string,
    diferenca,
    observacao: (formData.get("observacao") as string) || null,
  });

  revalidarPaginasFinanceiras();
}

export async function criarContaAction(formData: FormData) {
  await criarContaFinanceira({
    nome: formData.get("nome") as string,
    tipo: formData.get("tipo") as "caixa" | "banco" | "cartao",
    saldo_inicial: Number(formData.get("saldo_inicial") || 0),
  });
  revalidatePath("/contas");
  revalidatePath("/dashboard");
}

export async function excluirContaAction(id: string) {
  // A FK de pagamentos é "on delete set null": apagar uma conta com
  // movimentação deixaria esses pagamentos "sem conta" e tiraria o dinheiro
  // deles de todo saldo, sem aviso. A tela já esconde a opção nesse caso;
  // aqui é a trava para quem chegar por outro caminho.
  const qtd = await contarPagamentosDaConta(id);
  if (qtd > 0) {
    throw new Error(
      `Esta conta tem ${qtd} pagamento(s) registrados. Mude a conta desses pagamentos em Lançamentos antes de excluí-la.`
    );
  }

  await excluirContaFinanceira(id);
  revalidarPaginasFinanceiras();
}
