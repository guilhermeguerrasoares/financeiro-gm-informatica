"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ModalError } from "@/components/ModalError";
import { salvarMetaAction } from "./actions";
import type { Categoria, Meta } from "@/lib/types";

export function MetaModal({
  open,
  onClose,
  meta,
  categorias,
}: {
  open: boolean;
  onClose: () => void;
  meta: Meta | null;
  categorias: Categoria[];
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [metrica, setMetrica] = useState<Meta["metrica"]>(meta?.metrica ?? "faturamento");

  return (
    <Modal open={open} onClose={onClose} title={meta ? "Editar meta/limite" : "Nova meta/limite"}>
      <form
        action={async (formData) => {
          setErro(null);
          try {
            await salvarMetaAction(formData);
            onClose();
          } catch {
            setErro("Não foi possível salvar a meta. Tente novamente.");
          }
        }}
        className="grid grid-cols-2 gap-3"
      >
        {meta && <input type="hidden" name="id" value={meta.id} />}
        <ModalError mensagem={erro} />

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Nome</label>
          <input
            name="nome"
            defaultValue={meta?.nome}
            required
            placeholder="Ex: Limite em Permutas"
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Tipo</label>
          <select
            name="tipo"
            defaultValue={meta?.tipo ?? "meta"}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            <option value="meta">Meta — quero alcançar</option>
            <option value="limite">Limite — não posso ultrapassar</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Unidade</label>
          <select
            name="unidade"
            defaultValue={meta?.unidade ?? "valor"}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            <option value="valor">R$ (valor fixo)</option>
            <option value="percentual">% do faturamento</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Medir sobre</label>
          <select
            name="metrica"
            value={metrica}
            onChange={(e) => setMetrica(e.target.value as Meta["metrica"])}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            <option value="faturamento">Faturamento total</option>
            <option value="permutas">Permutas recebidas</option>
            <option value="categoria">Uma categoria específica</option>
          </select>
        </div>

        {metrica === "categoria" && (
          <div className="col-span-2">
            <label className="block text-xs text-[var(--text-dim)] mb-1">Categoria</label>
            <select
              name="categoria_id"
              defaultValue={meta?.categoria_id ?? ""}
              required
              className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
            >
              <option value="" disabled>
                Selecione...
              </option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Valor alvo</label>
          <input
            name="valor_alvo"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={meta?.valor_alvo}
            required
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div className="col-span-2 flex items-center gap-2">
          <input
            id="meta-ativo"
            name="ativo"
            type="checkbox"
            defaultChecked={meta?.ativo ?? true}
            className="w-4 h-4"
          />
          <label htmlFor="meta-ativo" className="text-sm">
            Ativa (aparece no dashboard)
          </label>
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
