"use client";

import { useState } from "react";
import { ContaModal } from "./ContaModal";
import { AjusteSaldoModal } from "./AjusteSaldoModal";
import { money } from "@/lib/format";
import type { ContaFinanceira } from "@/lib/types";

export function ContasList({
  contas,
  saldoPorConta,
  saldoConsolidado,
}: {
  contas: ContaFinanceira[];
  saldoPorConta: Record<string, number>;
  saldoConsolidado: number;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [ajustando, setAjustando] = useState<ContaFinanceira | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-1.5 rounded bg-[var(--accent-blue)] text-[var(--bg)] text-sm font-semibold"
        >
          + Nova conta
        </button>
        <div className="text-right">
          <div className="text-xs text-[var(--text-dim)] uppercase">Saldo consolidado</div>
          <div className="text-xl font-semibold">{money(saldoConsolidado)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {contas.map((c) => (
          <div key={c.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
            <h3 className="font-semibold mb-1">{c.nome}</h3>
            <p className="text-xs text-[var(--text-dim)] mb-3 uppercase">{c.tipo}</p>
            <div className="flex items-end justify-between gap-2">
              <div className="text-lg font-semibold">{money(saldoPorConta[c.id] ?? 0)}</div>
              <button
                type="button"
                onClick={() => setAjustando(c)}
                className="text-xs text-[var(--accent-blue)] underline"
              >
                Ajustar saldo
              </button>
            </div>
          </div>
        ))}
        {contas.length === 0 && <p className="text-[var(--text-dim)]">Nenhuma conta cadastrada ainda.</p>}
      </div>

      <ContaModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <AjusteSaldoModal
        key={ajustando?.id ?? "fechado"}
        conta={ajustando}
        saldoSistema={ajustando ? saldoPorConta[ajustando.id] ?? 0 : 0}
        onClose={() => setAjustando(null)}
      />
    </div>
  );
}
