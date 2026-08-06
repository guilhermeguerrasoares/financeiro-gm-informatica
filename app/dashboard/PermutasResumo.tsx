"use client";

import { useState } from "react";
import { Repeat, PieChart, TrendingUp } from "lucide-react";
import { Kpi } from "@/components/Kpi";
import { Modal } from "@/components/Modal";
import { money, formatDataBR } from "@/lib/format";
import type { ItemPermutaComLucro } from "@/lib/queries/dashboard";

export function PermutasResumo({
  valorVendido,
  percentualDasEntradas,
  lucro,
  itensVendidos,
}: {
  valorVendido: number;
  percentualDasEntradas: number;
  lucro: number;
  itensVendidos: ItemPermutaComLucro[];
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-3">
        Permutas do período
      </h2>
      <button type="button" onClick={() => setAberto(true)} className="text-left block w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Kpi label="Vendido em permutas" valor={money(valorVendido)} icon={Repeat} />
          <Kpi label="% das entradas do mês" valor={`${percentualDasEntradas.toFixed(1)}%`} icon={PieChart} />
          <Kpi
            label="Lucro em permutas"
            valor={money(lucro)}
            tone={lucro >= 0 ? "green" : "red"}
            icon={TrendingUp}
          />
        </div>
      </button>

      <Modal open={aberto} onClose={() => setAberto(false)} title="Permutas vendidas no período">
        <ul className="space-y-1 max-h-[60vh] overflow-y-auto">
          {itensVendidos.map(({ item, lucro: lucroItem }) => (
            <li key={item.id} className="text-sm flex justify-between gap-3 border-b border-[var(--border)] py-1.5">
              <span className="min-w-0">
                <span className="block truncate">{item.descricao}</span>
                <span className="text-xs text-[var(--text-dim)]">
                  {formatDataBR(item.data_venda)} · Recebido por {money(item.valor_estimado)}, vendido por{" "}
                  {money(item.valor_venda)}
                </span>
              </span>
              <span
                className={`shrink-0 font-semibold ${lucroItem >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}
              >
                {lucroItem >= 0 ? "+" : "−"} {money(Math.abs(lucroItem))}
              </span>
            </li>
          ))}
          {itensVendidos.length === 0 && (
            <li className="text-sm text-[var(--text-dim)]">Nenhuma permuta vendida no período.</li>
          )}
        </ul>
      </Modal>
    </div>
  );
}
