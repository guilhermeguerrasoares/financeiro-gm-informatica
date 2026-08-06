import { money, formatDataBR } from "@/lib/format";
import type { SemanaFluxo } from "@/lib/queries/dashboard";

const ENTRADA_CLARA = "rgba(52, 211, 153, 0.25)";
const SAIDA_CLARA = "rgba(248, 113, 113, 0.25)";

function segmentos(previsto: number, consolidado: number, maxValor: number) {
  const total = previsto + consolidado;
  const totalPct = total > 0 ? Math.max(2, (total / maxValor) * 100) : 0;
  const consolidadoPct = total > 0 ? (consolidado / total) * totalPct : 0;
  const previstoPct = totalPct - consolidadoPct;
  return { consolidadoPct, previstoPct };
}

export function FluxoSemanal({ semanas }: { semanas: SemanaFluxo[] }) {
  const maxValor = Math.max(
    1,
    ...semanas.map((s) => Math.max(s.entradasPrevistas + s.entradasConsolidadas, s.saidasPrevistas + s.saidasConsolidadas))
  );

  return (
    <div className="glass glow-ring rounded-2xl p-5 mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-4">
        Previsão semanal do mês
      </h2>
      <div className="flex gap-4 items-end h-40">
        {semanas.map((s) => {
          const entrada = segmentos(s.entradasPrevistas, s.entradasConsolidadas, maxValor);
          const saida = segmentos(s.saidasPrevistas, s.saidasConsolidadas, maxValor);
          const totalEntrada = s.entradasPrevistas + s.entradasConsolidadas;
          const totalSaida = s.saidasPrevistas + s.saidasConsolidadas;

          return (
            <div key={s.inicio} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="flex gap-1 items-end h-32 w-full justify-center cursor-default"
                title={`${formatDataBR(s.inicio)} a ${formatDataBR(s.fim)}\nEntradas: ${money(totalEntrada)} (${money(s.entradasConsolidadas)} consolidado)\nSaídas: ${money(totalSaida)} (${money(s.saidasConsolidadas)} consolidado)`}
              >
                <div className="w-4 h-full flex flex-col-reverse rounded-t overflow-hidden">
                  <div style={{ height: `${entrada.consolidadoPct}%`, background: "var(--accent-green)", boxShadow: "0 0 12px -2px var(--accent-green)" }} />
                  <div style={{ height: `${entrada.previstoPct}%`, background: ENTRADA_CLARA }} />
                </div>
                <div className="w-4 h-full flex flex-col-reverse rounded-t overflow-hidden">
                  <div style={{ height: `${saida.consolidadoPct}%`, background: "var(--accent-red)", boxShadow: "0 0 12px -2px var(--accent-red)" }} />
                  <div style={{ height: `${saida.previstoPct}%`, background: SAIDA_CLARA }} />
                </div>
              </div>
              <span className="text-[10px] text-[var(--text-dim)]">
                {formatDataBR(s.inicio)}–{formatDataBR(s.fim)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
