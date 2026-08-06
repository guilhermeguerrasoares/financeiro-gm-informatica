"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { StatusTag } from "@/components/StatusTag";
import { status as calcStatus, totalPago } from "@/lib/calculations";
import { money, formatDataBR, hoje } from "@/lib/format";
import { segmentosBarra } from "@/lib/chartSegments";
import type { SemanaFluxo } from "@/lib/queries/dashboard";
import type { LancamentoRow, PagamentoRow } from "@/lib/types";

const ENTRADA_CLARA = "rgba(52, 211, 153, 0.25)";
const SAIDA_CLARA = "rgba(248, 113, 113, 0.25)";

export function FluxoSemanal({
  semanas,
  lancamentosFluxo,
  pagamentosFluxo,
}: {
  semanas: SemanaFluxo[];
  lancamentosFluxo: LancamentoRow[];
  pagamentosFluxo: PagamentoRow[];
}) {
  const [selecao, setSelecao] = useState<{ semana: SemanaFluxo; tipo: "receita" | "despesa" } | null>(null);

  const maxValor = Math.max(
    1,
    ...semanas.map((s) => Math.max(s.entradasPrevistas + s.entradasConsolidadas, s.saidasPrevistas + s.saidasConsolidadas))
  );

  const hojeStr = hoje();
  const doSelecionado = selecao
    ? lancamentosFluxo.filter(
        (l) =>
          l.tipo === selecao.tipo &&
          l.vencimento &&
          l.vencimento >= selecao.semana.inicio &&
          l.vencimento <= selecao.semana.fim
      )
    : [];

  return (
    <div className="glass glow-ring rounded-2xl p-5 mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-4">
        Previsão semanal do mês
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {semanas.map((s) => {
          const entrada = segmentosBarra(s.entradasPrevistas, s.entradasConsolidadas, maxValor, 4);
          const saida = segmentosBarra(s.saidasPrevistas, s.saidasConsolidadas, maxValor, 4);
          const totalEntrada = s.entradasPrevistas + s.entradasConsolidadas;
          const totalSaida = s.saidasPrevistas + s.saidasConsolidadas;

          return (
            <div key={s.inicio} className="flex-1 min-w-[150px] border border-[var(--border)] rounded-xl p-3">
              <span className="block text-[11px] text-[var(--text-dim)] mb-2">
                {formatDataBR(s.inicio)}–{formatDataBR(s.fim)}
              </span>
              <div className="flex gap-3 items-end h-28">
                <button
                  type="button"
                  onClick={() => setSelecao({ semana: s, tipo: "receita" })}
                  className="flex-1 flex flex-col items-center justify-end gap-1 h-full"
                  title={`Entradas: ${money(totalEntrada)} (${money(s.entradasConsolidadas)} consolidado)`}
                >
                  <span className="text-[10px] text-[var(--accent-green)] font-semibold">{money(totalEntrada)}</span>
                  <div className="w-6 h-20 flex flex-col-reverse rounded-t overflow-hidden bg-[var(--surface-2)]">
                    <div
                      style={{
                        height: `${entrada.consolidadoPct}%`,
                        background: "var(--accent-green)",
                        boxShadow: "0 0 12px -2px var(--accent-green)",
                      }}
                    />
                    <div style={{ height: `${entrada.previstoPct}%`, background: ENTRADA_CLARA }} />
                  </div>
                  <span className="text-[9px] text-[var(--text-dim)]">Entradas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelecao({ semana: s, tipo: "despesa" })}
                  className="flex-1 flex flex-col items-center justify-end gap-1 h-full"
                  title={`Saídas: ${money(totalSaida)} (${money(s.saidasConsolidadas)} consolidado)`}
                >
                  <span className="text-[10px] text-[var(--accent-red)] font-semibold">{money(totalSaida)}</span>
                  <div className="w-6 h-20 flex flex-col-reverse rounded-t overflow-hidden bg-[var(--surface-2)]">
                    <div
                      style={{
                        height: `${saida.consolidadoPct}%`,
                        background: "var(--accent-red)",
                        boxShadow: "0 0 12px -2px var(--accent-red)",
                      }}
                    />
                    <div style={{ height: `${saida.previstoPct}%`, background: SAIDA_CLARA }} />
                  </div>
                  <span className="text-[9px] text-[var(--text-dim)]">Saídas</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={selecao !== null}
        onClose={() => setSelecao(null)}
        title={
          selecao
            ? `${selecao.tipo === "receita" ? "Entradas" : "Saídas"} de ${formatDataBR(selecao.semana.inicio)} a ${formatDataBR(selecao.semana.fim)}`
            : ""
        }
      >
        <ul className="space-y-1 max-h-[60vh] overflow-y-auto">
          {doSelecionado.map((l) => {
            const st = calcStatus(l, pagamentosFluxo, hojeStr);
            const pago = totalPago(pagamentosFluxo, l.id);
            return (
              <li
                key={l.id}
                className="text-sm flex justify-between items-center gap-3 border-b border-[var(--border)] py-1.5"
              >
                <span className="min-w-0">
                  <span className="block truncate">{l.descricao}</span>
                  <span className="text-xs text-[var(--text-dim)]">
                    {formatDataBR(l.vencimento)}
                    {pago > 0 && pago < l.valor ? ` · Pago até agora: ${money(pago)}` : ""}
                  </span>
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
          {doSelecionado.length === 0 && (
            <li className="text-sm text-[var(--text-dim)]">Nenhuma transação nesta semana.</li>
          )}
        </ul>
      </Modal>
    </div>
  );
}
