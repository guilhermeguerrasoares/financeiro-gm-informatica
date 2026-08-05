"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ModalError } from "@/components/ModalError";
import { criarContaAction } from "./actions";

export function ContaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [erro, setErro] = useState<string | null>(null);

  return (
    <Modal open={open} onClose={onClose} title="Nova conta/caixa">
      <form
        action={async (formData) => {
          setErro(null);
          try {
            await criarContaAction(formData);
            onClose();
          } catch {
            setErro("Não foi possível salvar a conta. Tente novamente.");
          }
        }}
        className="grid grid-cols-2 gap-3"
      >
        <ModalError mensagem={erro} />
        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Nome</label>
          <input name="nome" required className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]" />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Tipo</label>
          <select name="tipo" className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]">
            <option value="caixa">Caixa físico</option>
            <option value="banco">Conta bancária</option>
            <option value="cartao">Cartão</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Saldo inicial (R$)</label>
          <input type="number" step="0.01" name="saldo_inicial" defaultValue={0} className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]" />
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
