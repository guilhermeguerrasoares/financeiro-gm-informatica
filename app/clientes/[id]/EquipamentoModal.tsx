"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ModalError } from "@/components/ModalError";
import { criarEquipamentoAction } from "./equipamentoActions";

export function EquipamentoModal({
  open,
  onClose,
  clienteId,
}: {
  open: boolean;
  onClose: () => void;
  clienteId: string;
}) {
  const [erro, setErro] = useState<string | null>(null);

  return (
    <Modal open={open} onClose={onClose} title="Novo equipamento">
      <form
        action={async (formData) => {
          setErro(null);
          try {
            await criarEquipamentoAction(formData);
            onClose();
          } catch {
            setErro("Não foi possível salvar o equipamento. Tente novamente.");
          }
        }}
        className="grid grid-cols-2 gap-3"
      >
        <input type="hidden" name="cliente_id" value={clienteId} />
        <ModalError mensagem={erro} />

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Tipo</label>
          <select name="tipo" className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]">
            <option value="notebook">Notebook</option>
            <option value="desktop">Desktop</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Marca/Modelo</label>
          <input name="marca_modelo" className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]" />
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Número de série</label>
          <input name="numero_serie" className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]" />
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
