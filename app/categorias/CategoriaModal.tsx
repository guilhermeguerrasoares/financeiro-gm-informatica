"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ModalError } from "@/components/ModalError";
import { salvarCategoriaAction } from "./actions";
import type { Categoria } from "@/lib/types";

export function CategoriaModal({
  open,
  onClose,
  categoria,
}: {
  open: boolean;
  onClose: () => void;
  categoria: Categoria | null;
}) {
  const [erro, setErro] = useState<string | null>(null);

  return (
    <Modal open={open} onClose={onClose} title={categoria ? "Editar categoria" : "Nova categoria"}>
      <form
        action={async (formData) => {
          setErro(null);
          try {
            await salvarCategoriaAction(formData);
            onClose();
          } catch {
            setErro("Não foi possível salvar a categoria. Tente novamente.");
          }
        }}
        className="grid grid-cols-2 gap-3"
      >
        {categoria && <input type="hidden" name="id" value={categoria.id} />}
        <ModalError mensagem={erro} />

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Nome</label>
          <input
            name="nome"
            defaultValue={categoria?.nome}
            required
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Grupo no DRE</label>
          <input
            name="grupo_dre"
            defaultValue={categoria?.grupo_dre}
            required
            placeholder="Ex: Despesas Administrativas"
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
          <p className="text-xs text-[var(--text-dim)] mt-1">
            Categorias no grupo &quot;Despesas Financeiras&quot; aparecem em Dívidas → Dívidas da loja.
          </p>
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Frente de negócio (opcional)</label>
          <select
            name="frente_negocio"
            defaultValue={categoria?.frente_negocio ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            <option value="">Nenhuma</option>
            <option value="pecas_acessorios">Peças e Acessórios</option>
            <option value="computadores">Computadores</option>
            <option value="assistencia_tecnica">Assistência Técnica</option>
            <option value="outros">Outros</option>
          </select>
        </div>

        <div className="col-span-2 flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded">
            Cancelar
          </button>
          <button type="submit" className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded">
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}
