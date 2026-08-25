"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { FornecedorModal } from "./FornecedorModal";
import { excluirFornecedorAction } from "./actions";
import { money } from "@/lib/format";
import type { Fornecedor } from "@/lib/types";

export function FornecedoresList({
  linhas,
}: {
  linhas: { fornecedor: Fornecedor; total: number; falta: number; qtdLancamentos: number }[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Fornecedor | null>(null);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => {
            setEditando(null);
            setModalOpen(true);
          }}
          className="px-4 py-1.5 rounded bg-[var(--accent-blue)] text-[var(--bg)] text-sm font-semibold"
        >
          + Novo fornecedor
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {linhas.map(({ fornecedor, total, falta, qtdLancamentos }) => (
          <Link
            key={fornecedor.id}
            href={`/fornecedores/${fornecedor.id}`}
            className="block bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 hover:border-[var(--accent-blue)]"
          >
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-semibold">{fornecedor.nome}</h3>
              <div className="flex gap-1 -mt-1 -mr-1">
                <button
                  type="button"
                  aria-label="Editar fornecedor"
                  title="Editar"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditando(fornecedor);
                    setModalOpen(true);
                  }}
                  className="p-1.5 rounded text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Excluir fornecedor"
                  title="Excluir"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const aviso =
                      qtdLancamentos > 0
                        ? `Excluir "${fornecedor.nome}"? Existem ${qtdLancamentos} lançamento(s) vinculados a ele — eles NÃO serão apagados, mas ficarão sem fornecedor. Essa ação não pode ser desfeita.`
                        : `Excluir "${fornecedor.nome}"? Essa ação não pode ser desfeita.`;
                    if (!confirm(aviso)) return;
                    try {
                      await excluirFornecedorAction(fornecedor.id);
                    } catch {
                      alert("Não foi possível excluir o fornecedor. Tente novamente.");
                    }
                  }}
                  className="p-1.5 rounded text-[var(--text-dim)] hover:text-[var(--accent-red)] hover:bg-[var(--surface-2)]"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
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
          </Link>
        ))}
        {linhas.length === 0 && <p className="text-[var(--text-dim)]">Nenhum fornecedor cadastrado ainda.</p>}
      </div>

      <FornecedorModal open={modalOpen} onClose={() => setModalOpen(false)} fornecedor={editando} />
    </div>
  );
}
