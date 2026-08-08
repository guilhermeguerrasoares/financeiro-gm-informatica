import { useState } from "react";
import { round2 } from "@/lib/calculations";

// Estado + cálculo compartilhado entre LancamentoModal e PagamentoModal: o
// valor pago em dinheiro/outro SOMA com o valor em permuta (não desconta),
// e `diferenca` é o quanto falta (positivo) ou passou (negativo) do alvo.
export function usePermutaSplit(valorCaixa: number, valorAlvo: number) {
  const [incluiuPermuta, setIncluiuPermutaState] = useState(false);
  const [valorPermuta, setValorPermuta] = useState(0);

  function setIncluiuPermuta(checked: boolean) {
    setIncluiuPermutaState(checked);
    if (!checked) setValorPermuta(0);
  }

  const totalPago = round2(valorCaixa + (incluiuPermuta ? valorPermuta : 0));
  const diferenca = round2(valorAlvo - totalPago);

  return { incluiuPermuta, setIncluiuPermuta, valorPermuta, setValorPermuta, totalPago, diferenca };
}
