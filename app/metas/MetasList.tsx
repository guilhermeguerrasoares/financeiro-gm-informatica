"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { MetaModal } from "./MetaModal";
import { excluirMetaAction } from "./actions";
import { money } from "@/lib/format";
import type { Categoria, Meta } from "@/lib/types";

const TIPO_LABEL: Record<Meta["tipo"], string> = { meta: "Meta", limite: "Limite" };
const METRICA_LABEL: Record<Meta["metrica"], string> = {
  faturamento: "Faturamento total",
  permutas: "Permutas recebidas",
  categoria: "Categoria",
};

export function MetasList({ metas, categorias }: { metas: Meta[]; categorias: Categoria[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Meta | null>(null);

  const nomeCategoria = (id: string | null) => categorias.find((c) => c.id === id)?.nome ?? "—";

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
          + Nova meta/limite
        </button>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-[var(--text-dim)] text-xs uppercase border-b border-[var(--border)]">
            <th className="py-2">Nome</th>
            <th>Tipo</th>
            <th>Medindo</th>
            <th className="text-right">Alvo</th>
            <th>Status</th>
            <th className="text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {metas.map((m) => (
            <tr key={m.id} className="border-b border-[var(--border)]">
              <td className="py-2 font-medium">{m.nome}</td>
              <td className="text-[var(--text-dim)]">{TIPO_LABEL[m.tipo]}</td>
              <td className="text-[var(--text-dim)]">
                {m.metrica === "categoria" ? nomeCategoria(m.categoria_id) : METRICA_LABEL[m.metrica]}
              </td>
              <td className="text-right">{m.unidade === "percentual" ? `${m.valor_alvo}%` : money(m.valor_alvo)}</td>
              <td>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    m.ativo ? "bg-emerald-950 text-[var(--accent-green)]" : "bg-[var(--surface-2)] text-[var(--text-dim)]"
                  }`}
                >
                  {m.ativo ? "Ativa" : "Pausada"}
                </span>
              </td>
              <td className="text-right">
                <button
                  type="button"
                  aria-label="Editar meta"
                  title="Editar"
                  onClick={() => {
                    setEditando(m);
                    setModalOpen(true);
                  }}
                  className="p-1.5 rounded text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Excluir meta"
                  title="Excluir"
                  onClick={async () => {
                    if (!confirm(`Excluir "${m.nome}"? Essa ação não pode ser desfeita.`)) return;
                    await excluirMetaAction(m.id);
                  }}
                  className="p-1.5 rounded text-[var(--text-dim)] hover:text-[var(--accent-red)] hover:bg-[var(--surface-2)]"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
          {metas.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-[var(--text-dim)]">
                Nenhuma meta ou limite cadastrado ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <MetaModal open={modalOpen} onClose={() => setModalOpen(false)} meta={editando} categorias={categorias} />
    </div>
  );
}
