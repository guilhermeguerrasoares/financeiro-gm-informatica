"use client";

import { Modal } from "@/components/Modal";
import { criarFornecedorAction } from "./actions";

export function FornecedorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Novo fornecedor">
      <form
        action={async (formData) => {
          await criarFornecedorAction(formData);
          onClose();
        }}
        className="grid grid-cols-2 gap-3"
      >
        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Nome</label>
          <input name="nome" required className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]" />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Contato</label>
          <input name="contato" className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]" />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Documento</label>
          <input name="documento" className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Tipo</label>
          <input name="tipo" className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]" />
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
