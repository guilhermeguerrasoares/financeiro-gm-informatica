"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ModalError } from "@/components/ModalError";
import { desmembrarItemPermutaAction } from "./actions";
import { validarDesmembramento } from "@/lib/permutas";
import { money } from "@/lib/format";
import type { ItemPermuta } from "@/lib/queries/itensPermuta";

// Uma venda paga em permuta com mais de um aparelho entra como item único,
// porque o formulário de pagamento tem uma descrição só. Aqui esse item é
// partido em dois: o valor do que sai é descontado do que fica, então o total
// recebido em permuta continua o mesmo e cada peça passa a ter lucro próprio.
export function DesmembrarModal({ item, onClose }: { item: ItemPermuta | null; onClose: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const valorOriginal = item?.valor_estimado ?? 0;

  return (
    <Modal open={item !== null} onClose={onClose} title={item ? `Desmembrar: ${item.descricao}` : ""}>
      {item && (
        <form
          key={item.id}
          action={async (formData) => {
            const erroValidacao = validarDesmembramento({
              valorEstimadoOriginal: item.valor_estimado,
              novoValor: Number(formData.get("novo_valor")),
              novaDescricao: (formData.get("nova_descricao") as string) ?? "",
              descricaoOriginal: (formData.get("descricao_original") as string) ?? "",
            });
            if (erroValidacao) {
              setErro(erroValidacao);
              return;
            }
            setErro(null);
            setEnviando(true);
            try {
              await desmembrarItemPermutaAction(formData);
              onClose();
            } catch (err) {
              console.error(err);
              setErro("Não foi possível desmembrar o item. Tente novamente.");
            } finally {
              setEnviando(false);
            }
          }}
          className="grid grid-cols-2 gap-3"
        >
          <input type="hidden" name="item_id" value={item.id} />
          <input type="hidden" name="valor_estimado_original" value={item.valor_estimado ?? ""} />
          <ModalError mensagem={erro} />

          <p className="col-span-2 text-xs text-[var(--text-dim)]">
            O valor do item separado sai do item original ({money(valorOriginal)}), sem mexer no total recebido em
            permutas.
          </p>

          <div className="col-span-2">
            <label className="block text-xs text-[var(--text-dim)] mb-1">Item que fica (descrição)</label>
            <input
              name="descricao_original"
              defaultValue={item.descricao}
              required
              className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1">Item que sai (descrição)</label>
            <input
              name="nova_descricao"
              placeholder="Ex: Monitor LG 24"
              required
              className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1">Valor do item que sai (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              name="novo_valor"
              required
              className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
            />
          </div>

          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded disabled:opacity-50"
            >
              {enviando ? "Salvando..." : "Desmembrar"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
