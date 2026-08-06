"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { money, formatDataBR } from "@/lib/format";
import type { Cliente, LancamentoRow } from "@/lib/types";

export function AtencaoCard({
  atrasados,
  clientesInadimplentes,
  totalAtrasado,
}: {
  atrasados: { lancamento: LancamentoRow; saldo: number }[];
  clientesInadimplentes: Cliente[];
  totalAtrasado: number;
}) {
  const [aberto, setAberto] = useState(false);

  if (atrasados.length === 0 && clientesInadimplentes.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="glass rounded-2xl p-5 text-left w-full"
        style={{ borderColor: "var(--accent-red)", boxShadow: "0 8px 30px -18px var(--accent-red)" }}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-red)] mb-3">
          Precisa de atenção
        </h2>
        <ul className="space-y-1 text-sm">
          {atrasados.length > 0 && (
            <li>
              {atrasados.length} conta(s) vencida(s) — {money(totalAtrasado)}
            </li>
          )}
          {clientesInadimplentes.length > 0 && (
            <li>{clientesInadimplentes.length} cliente(s) marcado(s) como inadimplente</li>
          )}
        </ul>
      </button>

      <Modal open={aberto} onClose={() => setAberto(false)} title="Precisa de atenção">
        {atrasados.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs uppercase text-[var(--text-dim)] mb-2">Contas vencidas</h3>
            <ul className="space-y-1">
              {atrasados.map(({ lancamento: l, saldo }) => (
                <li key={l.id} className="text-sm flex justify-between gap-3 border-b border-[var(--border)] py-1.5">
                  <span className="min-w-0">
                    <span className="block truncate">{l.descricao}</span>
                    <span className="text-xs text-[var(--text-dim)]">Venceu em {formatDataBR(l.vencimento)}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-[var(--accent-red)]">{money(saldo)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {clientesInadimplentes.length > 0 && (
          <div>
            <h3 className="text-xs uppercase text-[var(--text-dim)] mb-2">Clientes inadimplentes</h3>
            <ul className="space-y-1">
              {clientesInadimplentes.map((c) => (
                <li key={c.id} className="text-sm border-b border-[var(--border)] py-1.5">
                  {c.nome}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </>
  );
}
