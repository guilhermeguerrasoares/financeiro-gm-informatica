"use client";

import { useState } from "react";
import { FornecedorModal } from "./FornecedorModal";
import { money } from "@/lib/format";
import type { Fornecedor } from "@/lib/types";

export function FornecedoresList({
  linhas,
}: {
  linhas: { fornecedor: Fornecedor; total: number; falta: number }[];
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-1.5 rounded bg-[var(--accent-blue)] text-[var(--bg)] text-sm font-semibold"
        >
          + Novo fornecedor
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {linhas.map(({ fornecedor, total, falta }) => (
          <div key={fornecedor.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
            <h3 className="font-semibold mb-1">{fornecedor.nome}</h3>
            <p className="text-xs text-[var(--text-dim)] mb-3">{fornecedor.tipo ?? "—"}</p>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-dim)]">Total lançado</span>
              <span>{money(total)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-[var(--text-dim)]">Falta pagar</span>
              <span className={falta > 0.004 ? "text-[var(--accent-red)]" : "text-[var(--accent-green)]"}>
                {money(falta)}
              </span>
            </div>
          </div>
        ))}
        {linhas.length === 0 && <p className="text-[var(--text-dim)]">Nenhum fornecedor cadastrado ainda.</p>}
      </div>

      <FornecedorModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
