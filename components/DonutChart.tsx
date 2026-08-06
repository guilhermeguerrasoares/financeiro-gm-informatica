const R = 60;
const CIRCUNFERENCIA = 2 * Math.PI * R;

export function DonutChart({
  entradas,
  saidas,
}: {
  entradas: number;
  saidas: number;
}) {
  const total = entradas + saidas;
  const fracaoEntradas = total > 0 ? entradas / total : 0;
  const arcoEntradas = fracaoEntradas * CIRCUNFERENCIA;

  return (
    <svg viewBox="0 0 140 140" className="w-36 h-36 -rotate-90">
      <circle cx="70" cy="70" r={R} fill="none" stroke="var(--accent-red)" strokeOpacity="0.35" strokeWidth="14" />
      {total > 0 && (
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke="var(--accent-green)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${arcoEntradas} ${CIRCUNFERENCIA - arcoEntradas}`}
        />
      )}
    </svg>
  );
}
