import type { StatusLancamento } from "./calculations";

// A coluna "Falta" era vermelha em toda linha - inclusive numa recém-lançada
// que nem venceu, e no "R$ 0,00" de uma quitada. Vermelho que aparece sempre
// não informa nada. Aqui a cor passa a dizer a situação, que é o que o olho
// procura ao varrer a lista.
export function classeDoSaldo(status: StatusLancamento): string {
  if (status === "atrasado") return "text-[var(--accent-red)]";
  if (status === "parcial") return "text-[var(--accent-amber)]";
  // Quitada não precisa de destaque: o valor ali é zero.
  if (status === "quitado") return "text-[var(--text-dim)]";
  return "text-[var(--text)]";
}
