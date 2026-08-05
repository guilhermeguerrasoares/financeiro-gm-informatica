"use client";

import { Modal } from "@/components/Modal";
import { salvarClienteAction } from "./actions";
import type { Cliente } from "@/lib/types";

export function ClienteModal({
  open,
  onClose,
  cliente,
}: {
  open: boolean;
  onClose: () => void;
  cliente: Cliente | null;
}) {
  return (
    <Modal open={open} onClose={onClose} title={cliente ? "Editar cliente" : "Novo cliente"}>
      <form
        action={async (formData) => {
          await salvarClienteAction(formData);
          onClose();
        }}
        className="grid grid-cols-2 gap-3"
      >
        {cliente && <input type="hidden" name="id" value={cliente.id} />}

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Nome</label>
          <input
            name="nome"
            defaultValue={cliente?.nome}
            required
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Contato</label>
          <input
            name="contato"
            defaultValue={cliente?.contato ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Documento</label>
          <input
            name="documento"
            defaultValue={cliente?.documento ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Classificação</label>
          <select
            name="classificacao"
            defaultValue={cliente?.classificacao ?? "padrao"}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            <option value="padrao">Padrão</option>
            <option value="vip">VIP</option>
            <option value="recorrente">Recorrente</option>
            <option value="inadimplente">Inadimplente</option>
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
