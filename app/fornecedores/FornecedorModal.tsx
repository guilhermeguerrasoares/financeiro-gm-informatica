"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ModalError } from "@/components/ModalError";
import { salvarFornecedorAction } from "./actions";
import type { Fornecedor } from "@/lib/types";

const TIPO_OPCOES = [
  { value: "fornecedor", label: "Fornecedor de peças/produtos" },
  { value: "servico", label: "Prestador de serviço" },
  { value: "orgao", label: "Órgão público" },
  { value: "pessoal", label: "Pessoal/Equipe" },
  { value: "socio", label: "Sócio (pró-labore)" },
  { value: "outro", label: "Outro" },
];

export function FornecedorModal({
  open,
  onClose,
  fornecedor,
}: {
  open: boolean;
  onClose: () => void;
  fornecedor?: Fornecedor | null;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const editando = !!fornecedor;

  return (
    <Modal open={open} onClose={onClose} title={editando ? "Editar fornecedor" : "Novo fornecedor"}>
      <form
        action={async (formData) => {
          setErro(null);
          try {
            await salvarFornecedorAction(formData);
            onClose();
          } catch {
            setErro("Não foi possível salvar o fornecedor. Tente novamente.");
          }
        }}
        className="grid grid-cols-2 gap-3"
      >
        <ModalError mensagem={erro} />
        {editando && <input type="hidden" name="id" value={fornecedor!.id} />}
        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Nome</label>
          <input
            name="nome"
            required
            defaultValue={fornecedor?.nome ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Contato</label>
          <input
            name="contato"
            defaultValue={fornecedor?.contato ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Documento</label>
          <input
            name="documento"
            defaultValue={fornecedor?.documento ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Tipo</label>
          <select
            name="tipo"
            defaultValue={fornecedor?.tipo ?? "fornecedor"}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            {TIPO_OPCOES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
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
