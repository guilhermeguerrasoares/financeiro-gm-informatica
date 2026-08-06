"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { StatusTag } from "@/components/StatusTag";
import { status as calcStatus, totalPago } from "@/lib/calculations";
import { money, formatDataBR, hoje } from "@/lib/format";
import { segmentosBarra } from "@/lib/chartSegments";
import type { DiaFluxo } from "@/lib/queries/dashboard";
import type { LancamentoRow, PagamentoRow } from "@/lib/types";

const ENTRADA_CLARA = "rgba(52, 211, 153, 0.25)";
const SAIDA_CLARA = "rgba(248, 113, 113, 0.25)";

export function FluxoDiario({
  fluxoDiario,
  lancamentosFluxo,
  pagamentosFluxo,
}: {
  fluxoDiario: DiaFluxo[];
  lancamentosFluxo: LancamentoRow[];
  pagamentosFluxo: PagamentoRow[];
}) {
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  const maxValor = Math.max(
    1,
    ...fluxoDiario.map((d) => Math.max(d.entradasPrevistas + d.entradasConsolidadas, d.saidasPrevistas + d.saidasConsolidadas))
  );

  const hojeStr = hoje();
  const doDiaSelecionado = diaSelecionado
    ? lancamentosFluxo.filter((l) => l.vencimento === diaSelecionado)
    : [];

  return (
    <div className="glass glow-ring rounded-2xl p-5 lg:col-span-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-4">
        Fluxo de caixa diário
      </h2>
      <div className="flex gap-4 mb-3 text-[11px] text-[var(--text-dim)]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--accent-green)", boxShadow: "0 0 6px var(--accent-green)" }} />
          Consolidado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: ENTRADA_CLARA }} />
          Previsto
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-1.5 items-end h-40" style={{ minWidth: `${fluxoDiario.length * 22}px` }}>
          {fluxoDiario.map((d) => {
            const entrada = segmentosBarra(d.entradasPrevistas, d.entradasConsolidadas, maxValor);
            const saida = segmentosBarra(d.saidasPrevistas, d.saidasConsolidadas, maxValor);
            const totalEntrada = d.entradasPrevistas + d.entradasConsolidadas;
            const totalSaida = d.saidasPrevistas + d.saidasConsolidadas;

            return (
              <button
                key={d.data}
                type="button"
                onClick={() => setDiaSelecionado(d.data)}
                className="flex-1 flex flex-col items-center gap-1 shrink-0"
                title={`${formatDataBR(d.data)}\nEntradas: ${money(totalEntrada)} (${money(d.entradasConsolidadas)} consolidado)\nSaídas: ${money(totalSaida)} (${money(d.saidasConsolidadas)} consolidado)`}
              >
                <div className="flex gap-0.5 items-end h-32 w-full justify-center">
                  <div className="w-2 h-full flex flex-col-reverse rounded-t overflow-hidden">
                    <div style={{ height: `${entrada.consolidadoPct}%`, background: "var(--accent-green)", boxShadow: "0 0 8px -1px var(--accent-green)" }} />
                    <div style={{ height: `${entrada.previstoPct}%`, background: ENTRADA_CLARA }} />
                  </div>
                  <div className="w-2 h-full flex flex-col-reverse rounded-t overflow-hidden">
                    <div style={{ height: `${saida.consolidadoPct}%`, background: "var(--accent-red)", boxShadow: "0 0 8px -1px var(--accent-red)" }} />
                    <div style={{ height: `${saida.previstoPct}%`, background: SAIDA_CLARA }} />
                  </div>
                </div>
                <span className="text-[9px] text-[var(--text-dim)]">{d.data.slice(8, 10)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Modal
        open={diaSelecionado !== null}
        onClose={() => setDiaSelecionado(null)}
        title={diaSelecionado ? `Transações de ${formatDataBR(diaSelecionado)}` : ""}
      >
        <ul className="space-y-1 max-h-[60vh] overflow-y-auto">
          {doDiaSelecionado.map((l) => {
            const st = calcStatus(l, pagamentosFluxo, hojeStr);
            const pago = totalPago(pagamentosFluxo, l.id);
            return (
              <li key={l.id} className="text-sm flex justify-between items-center gap-3 border-b border-[var(--border)] py-1.5">
                <span className="min-w-0">
                  <span className="block truncate">{l.descricao}</span>
                  {pago > 0 && pago < l.valor && (
                    <span className="text-xs text-[var(--text-dim)]">Pago até agora: {money(pago)}</span>
                  )}
                </span>
                <span className="shrink-0 flex items-center gap-2">
                  <StatusTag status={st} />
                  <span className={`font-semibold ${l.tipo === "receita" ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                    {l.tipo === "receita" ? "+" : "−"} {money(l.valor)}
                  </span>
                </span>
              </li>
            );
          })}
          {doDiaSelecionado.length === 0 && (
            <li className="text-sm text-[var(--text-dim)]">Nenhum lançamento neste dia.</li>
          )}
        </ul>
      </Modal>
    </div>
  );
}
