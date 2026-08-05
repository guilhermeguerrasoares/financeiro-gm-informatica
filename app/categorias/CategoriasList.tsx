"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { CategoriaModal } from "./CategoriaModal";
import type { Categoria } from "@/lib/types";

const FRENTE_LABEL: Record<string, string> = {
  pecas_acessorios: "Peças e Acessórios",
  computadores: "Computadores",
  assistencia_tecnica: "Assistência Técnica",
  outros: "Outros",
};

export function CategoriasList({ categorias }: { categorias: Categoria[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Categoria | null>(null);

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
          + Nova categoria
        </button>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-[var(--text-dim)] text-xs uppercase border-b border-[var(--border)]">
            <th className="py-2">Nome</th>
            <th>Grupo no DRE</th>
            <th>Frente de negócio</th>
            <th className="text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {categorias.map((c) => (
            <tr key={c.id} className="border-b border-[var(--border)]">
              <td className="py-2 font-medium">{c.nome}</td>
              <td className="text-[var(--text-dim)]">{c.grupo_dre}</td>
              <td className="text-[var(--text-dim)]">
                {c.frente_negocio ? FRENTE_LABEL[c.frente_negocio] ?? c.frente_negocio : "—"}
              </td>
              <td className="text-right">
                <button
                  type="button"
                  aria-label="Editar categoria"
                  title="Editar"
                  onClick={() => {
                    setEditando(c);
                    setModalOpen(true);
                  }}
                  className="p-1.5 rounded text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
                >
                  <Pencil size={14} />
                </button>
              </td>
            </tr>
          ))}
          {categorias.length === 0 && (
            <tr>
              <td colSpan={4} className="py-8 text-center text-[var(--text-dim)]">
                Nenhuma categoria cadastrada ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <CategoriaModal open={modalOpen} onClose={() => setModalOpen(false)} categoria={editando} />
    </div>
  );
}
