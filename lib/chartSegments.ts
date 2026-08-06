// Divide uma barra empilhada (consolidado + previsto) em percentuais de
// altura, com um piso mínimo pra barras muito pequenas continuarem visíveis.
export function segmentosBarra(previsto: number, consolidado: number, maxValor: number, minPct = 2) {
  const total = previsto + consolidado;
  const totalPct = total > 0 ? Math.max(minPct, (total / maxValor) * 100) : 0;
  const consolidadoPct = total > 0 ? (consolidado / total) * totalPct : 0;
  const previstoPct = totalPct - consolidadoPct;
  return { consolidadoPct, previstoPct };
}
