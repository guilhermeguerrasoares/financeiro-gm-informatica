"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { registrarPagamentoAction } from "./pagamentoActions";
import { uploadComprovante } from "./uploadComprovante";
import { PermutaItemFields } from "./PermutaItemFields";
import { valorLiquido } from "@/lib/calculations";
import { money, hoje } from "@/lib/format";
import type { LancamentoRow } from "@/lib/types";

export function PagamentoModal({
  open,
  onClose,
  lancamento,
  falta,
}: {
  open: boolean;
  onClose: () => void;
  lancamento: LancamentoRow | null;
  falta: number;
}) {
  const [valor, setValor] = useState(falta);
  const [taxa, setTaxa] = useState<number | "">("");
  const [forma, setForma] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!lancamento) return null;

  return (
    <Modal open={open} onClose={onClose} title="Registrar pagamento">
      <form
        action={async (formData) => {
          setEnviando(true);
          if (arquivo) {
            const path = await uploadComprovante(arquivo, lancamento.id);
            formData.set("comprovante_path", path);
          }
          await registrarPagamentoAction(formData);
          setEnviando(false);
          onClose();
        }}
        className="grid grid-cols-2 gap-3"
      >
        <input type="hidden" name="lancamento_id" value={lancamento.id} />
        <p className="col-span-2 text-sm text-[var(--text-dim)]">
          {lancamento.descricao} · falta {money(falta)}
        </p>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Valor pago (R$)</label>
          <input
            type="number"
            step="0.01"
            name="valor"
            defaultValue={falta}
            onChange={(e) => setValor(Number(e.target.value))}
            required
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Data</label>
          <input
            type="date"
            name="data_pagamento"
            defaultValue={hoje()}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Forma de pagamento</label>
          <select
            name="forma_pagamento"
            value={forma}
            onChange={(e) => setForma(e.target.value)}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            <option value="">Não informada</option>
            <option value="pix">Pix</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="boleto">Boleto</option>
            <option value="transferencia">Transferência</option>
            <option value="cartao_credito">Cartão de crédito</option>
            <option value="cartao_debito">Cartão de débito</option>
            <option value="permuta">Permuta</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Taxa paga (opcional)</label>
          <input
            type="number"
            step="0.01"
            name="taxa"
            onChange={(e) => setTaxa(e.target.value ? Number(e.target.value) : "")}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
          <p className="text-xs text-[var(--text-dim)] mt-1">
            Valor líquido: {money(valorLiquido(valor || 0, taxa === "" ? null : taxa))}
          </p>
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Comprovante (foto ou PDF)</label>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
        </div>

        {forma === "permuta" && <PermutaItemFields />}

        <div className="col-span-2 flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded disabled:opacity-50"
          >
            {enviando ? "Enviando..." : "Registrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
