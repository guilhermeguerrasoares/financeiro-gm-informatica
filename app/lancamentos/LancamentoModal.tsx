"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/Modal";
import { ModalError } from "@/components/ModalError";
import { PermutaItemFields } from "./PermutaItemFields";
import { ContaSelect } from "@/components/ContaSelect";
import { salvarLancamentoAction, excluirLancamentoAction } from "./actions";
import { valorLiquido } from "@/lib/calculations";
import { money, hoje } from "@/lib/format";
import { FORMAS_PAGAMENTO } from "@/lib/formasPagamento";
import { usePermutaSplit } from "./usePermutaSplit";
import { RepeticaoFields, type Repeticao } from "./RepeticaoFields";
import { AlcanceSerieDialog } from "./AlcanceSerieDialog";
import type { Categoria, Cliente, Fornecedor, LancamentoRow, ContaFinanceira } from "@/lib/types";

export function LancamentoModal({
  open,
  onClose,
  lancamento,
  categorias,
  clientes,
  fornecedores,
  contas,
}: {
  open: boolean;
  onClose: () => void;
  lancamento: LancamentoRow | null;
  categorias: Categoria[];
  clientes: Cliente[];
  fornecedores: Fornecedor[];
  contas: ContaFinanceira[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [valorLancamento, setValorLancamento] = useState(lancamento?.valor ?? 0);
  const [vencimento, setVencimento] = useState(lancamento?.vencimento ?? "");
  const [repeticao, setRepeticao] = useState<Repeticao>("nenhuma");
  const [perguntandoAlcance, setPerguntandoAlcance] = useState<"editar" | "excluir" | null>(null);
  // Segura o formulário já preenchido enquanto o diálogo de alcance está na
  // tela: a escolha do alcance vem depois do submit, mas antes de gravar.
  const [dadosPendentes, setDadosPendentes] = useState<FormData | null>(null);
  const ehSerie = Boolean(lancamento?.serie_id);
  const [pago, setPago] = useState(false);
  const [valorPago, setValorPago] = useState(lancamento?.valor ?? 0);
  const [taxa, setTaxa] = useState<number | "">("");
  const [forma, setForma] = useState("");
  const { incluiuPermuta, setIncluiuPermuta, valorPermuta, setValorPermuta, totalPago, diferenca } = usePermutaSplit(
    valorPago,
    valorLancamento
  );

  async function salvar(formData: FormData, alcance: "este" | "proximos" | "todos") {
    setErro(null);
    setEnviando(true);
    try {
      formData.set("alcance", alcance);
      const { aviso } = await salvarLancamentoAction(formData);
      if (aviso) alert(aviso);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o lançamento. Tente novamente.");
    } finally {
      setEnviando(false);
      setPerguntandoAlcance(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={lancamento ? "Editar lançamento" : "Novo lançamento"}>
      <form
        ref={formRef}
        action={async (formData) => {
          // Numa série, o alcance decide o que a edição atinge - por isso a
          // pergunta vem antes de gravar, não depois.
          if (ehSerie) {
            setDadosPendentes(formData);
            setPerguntandoAlcance("editar");
            return;
          }
          await salvar(formData, "este");
        }}
        className="grid grid-cols-2 gap-3"
      >
        {lancamento && <input type="hidden" name="id" value={lancamento.id} />}
        <ModalError mensagem={erro} />

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Descrição</label>
          <input
            name="descricao"
            defaultValue={lancamento?.descricao}
            required
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Tipo</label>
          <select
            name="tipo"
            defaultValue={lancamento?.tipo ?? "despesa"}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            <option value="despesa">Saída (conta a pagar)</option>
            <option value="receita">Entrada (a receber)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Categoria</label>
          <select
            name="categoria_id"
            defaultValue={lancamento?.categoria_id ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            <option value="">Selecione</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Cliente (opcional)</label>
          <select
            name="cliente_id"
            defaultValue={lancamento?.cliente_id ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            <option value="">Nenhum</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Fornecedor (opcional)</label>
          <select
            name="fornecedor_id"
            defaultValue={lancamento?.fornecedor_id ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            <option value="">Nenhum</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Vencimento</label>
          <input
            type="date"
            name="vencimento"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
            required={repeticao !== "nenhuma"}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            name="valor"
            defaultValue={lancamento?.valor}
            onChange={(e) => setValorLancamento(Number(e.target.value) || 0)}
            required
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Custo/CMV (opcional)</label>
          <input
            type="number"
            step="0.01"
            name="custo"
            defaultValue={lancamento?.custo ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Observação</label>
          <input
            name="observacao"
            defaultValue={lancamento?.observacao ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        {!lancamento && (
          <RepeticaoFields
            valor={valorLancamento}
            vencimento={vencimento}
            onRepeticaoChange={setRepeticao}
          />
        )}

        {/* "Já foi pago?" some quando há repetição: numa compra de 3x, "já foi
            pago" não diz qual parcela foi quitada. A baixa é feita parcela a
            parcela, pelo botão "Pagar" da tabela. */}
        {!lancamento && repeticao === "nenhuma" && (
          <div className="col-span-2 flex items-center gap-2 pt-1">
            <input
              id="ja-pago"
              type="checkbox"
              name="registrar_pagamento"
              checked={pago}
              onChange={(e) => {
                setPago(e.target.checked);
                if (e.target.checked) setValorPago(valorLancamento);
              }}
              className="w-4 h-4"
            />
            <label htmlFor="ja-pago" className="text-sm">
              Já foi pago?
            </label>
          </div>
        )}

        {!lancamento && repeticao === "nenhuma" && pago && (
          <div className="col-span-2 border border-[var(--border)] rounded p-3 bg-[var(--surface-2)] grid grid-cols-2 gap-3">
            <p className="col-span-2 text-xs text-[var(--text-dim)] uppercase tracking-wide">Pagamento</p>

            <div>
              <label className="block text-xs text-[var(--text-dim)] mb-1">
                Valor pago{incluiuPermuta ? " em dinheiro/outro" : ""} (R$)
              </label>
              <input
                type="number"
                step="0.01"
                name="pagamento_valor"
                value={valorPago}
                onChange={(e) => setValorPago(Number(e.target.value) || 0)}
                required
                className="w-full px-3 py-2 rounded bg-[var(--surface)] border border-[var(--border)]"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--text-dim)] mb-1">Data</label>
              <input
                type="date"
                name="data_pagamento"
                defaultValue={hoje()}
                className="w-full px-3 py-2 rounded bg-[var(--surface)] border border-[var(--border)]"
              />
            </div>

            <ContaSelect contas={contas} obrigatoria={valorPago > 0.004} />

            <div>
              <label className="block text-xs text-[var(--text-dim)] mb-1">
                Forma de pagamento{incluiuPermuta ? " (parte em dinheiro/outro)" : ""}
              </label>
              <select
                name="forma_pagamento"
                value={forma}
                onChange={(e) => setForma(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[var(--surface)] border border-[var(--border)]"
              >
                <option value="">Não informada</option>
                {FORMAS_PAGAMENTO.filter((f) => f.value !== "permuta").map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-[var(--text-dim)] mb-1">Taxa paga (opcional)</label>
              <input
                type="number"
                step="0.01"
                name="taxa"
                onChange={(e) => setTaxa(e.target.value ? Number(e.target.value) : "")}
                className="w-full px-3 py-2 rounded bg-[var(--surface)] border border-[var(--border)]"
              />
              <p className="text-xs text-[var(--text-dim)] mt-1">
                Valor líquido: {money(valorLiquido(valorPago || 0, taxa === "" ? null : taxa))}
              </p>
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-[var(--text-dim)] mb-1">Comprovante (foto ou PDF)</label>
              <input
                type="file"
                name="comprovante"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && file.size > 10 * 1024 * 1024) {
                    alert("Arquivo maior que 10MB. Escolha um arquivo menor.");
                    e.target.value = "";
                  }
                }}
                className="w-full text-sm"
              />
            </div>

            <div className="col-span-2 flex items-center gap-2 pt-1 border-t border-[var(--border)] mt-1">
              <input
                id="incluiu-permuta"
                type="checkbox"
                checked={incluiuPermuta}
                onChange={(e) => setIncluiuPermuta(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="incluiu-permuta" className="text-sm">
                Uma parte foi recebida em permuta?
              </label>
            </div>

            {incluiuPermuta && (
              <>
                <div className="col-span-2">
                  <label className="block text-xs text-[var(--text-dim)] mb-1">
                    Valor do item em permuta (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="permuta_valor"
                    value={valorPermuta}
                    onChange={(e) => setValorPermuta(Number(e.target.value) || 0)}
                    required
                    className="w-full px-3 py-2 rounded bg-[var(--surface)] border border-[var(--border)]"
                  />
                  <p className="text-xs text-[var(--text-dim)] mt-1">
                    Esse valor soma com o valor pago acima, e também vira o valor do item no estoque de permutas.
                  </p>
                </div>
                <PermutaItemFields />
              </>
            )}

            <p
              className={`col-span-2 text-xs font-medium ${
                Math.abs(diferenca) <= 0.004
                  ? "text-[var(--accent-green)]"
                  : diferenca > 0
                    ? "text-[var(--accent-amber)]"
                    : "text-[var(--accent-red)]"
              }`}
            >
              Total pago: {money(totalPago)} de {money(valorLancamento)}
              {diferenca > 0.004 && ` — falta ${money(diferenca)} (ficará parcial)`}
              {diferenca < -0.004 && ` — ${money(Math.abs(diferenca))} acima do valor do lançamento`}
            </p>
          </div>
        )}

        <div className="col-span-2 flex justify-between mt-2">
          {lancamento ? (
            <button
              type="button"
              onClick={async () => {
                if (ehSerie) {
                  setPerguntandoAlcance("excluir");
                  return;
                }
                if (!confirm(`Excluir "${lancamento.descricao}"? Essa ação não pode ser desfeita.`)) return;
                try {
                  await excluirLancamentoAction(lancamento.id);
                  onClose();
                } catch (e) {
                  setErro(e instanceof Error ? e.message : "Não foi possível excluir o lançamento. Tente novamente.");
                }
              }}
              className="text-[var(--accent-red)] text-sm font-semibold"
            >
              Excluir lançamento
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded disabled:opacity-50"
            >
              {enviando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </form>

      {perguntandoAlcance && lancamento && (
        <AlcanceSerieDialog
          acao={perguntandoAlcance}
          onCancelar={() => {
            setPerguntandoAlcance(null);
            setDadosPendentes(null);
          }}
          onEscolher={async (alcance) => {
            if (perguntandoAlcance === "editar") {
              if (dadosPendentes) await salvar(dadosPendentes, alcance);
              setDadosPendentes(null);
              return;
            }
            try {
              const aviso = await excluirLancamentoAction(lancamento.id, alcance);
              if (aviso) alert(aviso);
              onClose();
            } catch (e) {
              setErro(e instanceof Error ? e.message : "Não foi possível excluir o lançamento. Tente novamente.");
            } finally {
              setPerguntandoAlcance(null);
            }
          }}
        />
      )}
    </Modal>
  );
}
