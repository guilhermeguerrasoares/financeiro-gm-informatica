"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { ModalError } from "@/components/ModalError";
import { ContaSelect } from "@/components/ContaSelect";
import { registrarPagamentoAction } from "@/app/lancamentos/pagamentoActions";
import { registrarQuitacaoAction } from "./actions";
import { money, formatDataBR, hoje, dataLocal } from "@/lib/format";
import { FORMAS_PAGAMENTO } from "@/lib/formasPagamento";
import type { Fornecedor, Categoria, ContaFinanceira } from "@/lib/types";
import type { LinhaFornecedor } from "@/lib/fornecedores";

// Chave do item "dívida informada", que não é um lançamento só: ele junta
// todos os ajustes do fornecedor.
const DIVIDA_INFORMADA = "divida-informada";

// O pagamento é SEMPRE aplicado contra alguma coisa da lista, e é a escolha
// que decide o que acontece:
//
// - Compra escolhida  -> baixa comum em `pagamentos`. NÃO gera despesa nova:
//                        a compra já bateu no DRE no mês dela, pelo valor
//                        cheio, paga ou não.
// - Dívida informada  -> gera uma quitação, que conta como despesa do mês,
//                        porque aquela compra nunca foi lançada.
//
// Sem essa separação, a mesma despesa contaria duas vezes.
export function PagamentoFornecedorModal({
  open,
  onClose,
  fornecedor,
  linhas,
  dividaInformada,
  categorias,
  contas,
}: {
  open: boolean;
  onClose: () => void;
  fornecedor: Fornecedor;
  linhas: LinhaFornecedor[];
  dividaInformada: number;
  categorias: Categoria[];
  contas: ContaFinanceira[];
}) {
  // Compras em aberto, da mais antiga para a mais nova - a ordem já vem
  // pronta de movimentosDoFornecedor.
  const compras = linhas.filter(
    (l) => l.lancamento.movimento_fornecedor === "compra" && l.falta > 0.004
  );
  const temDividaInformada = dividaInformada > 0.004;

  const [escolhido, setEscolhido] = useState("");
  const [valor, setValor] = useState<number | "">("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [chave, setChave] = useState("");

  // Pré-seleciona o mais antigo em aberto, que é o que o dono costuma pagar
  // primeiro. Só cai na dívida informada quando não há compra em aberto.
  useEffect(() => {
    if (!open) return;
    const padrao = compras[0]?.lancamento.id ?? (temDividaInformada ? DIVIDA_INFORMADA : "");
    setEscolhido(padrao);
    setValor(compras[0]?.falta ?? (temDividaInformada ? dividaInformada : ""));
    setErro(null);
    setChave(crypto.randomUUID());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const compraEscolhida = compras.find((l) => l.lancamento.id === escolhido);
  const ehQuitacao = escolhido === DIVIDA_INFORMADA;
  const nadaAPagar = compras.length === 0 && !temDividaInformada;

  function aoEscolher(id: string) {
    setEscolhido(id);
    const linha = compras.find((l) => l.lancamento.id === id);
    setValor(linha ? linha.falta : id === DIVIDA_INFORMADA ? dividaInformada : "");
  }

  return (
    <Modal open={open} onClose={onClose} title={`Registrar pagamento — ${fornecedor.nome}`}>
      {nadaAPagar ? (
        <div>
          <p className="text-sm text-[var(--text-dim)]">
            Não há nada em aberto com {fornecedor.nome}. Cadastre a compra, ou informe a dívida em &quot;Ajustar
            dívida&quot;, antes de registrar um pagamento.
          </p>
          <div className="flex justify-end mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded">
              Fechar
            </button>
          </div>
        </div>
      ) : (
        <form
          action={async (formData) => {
            setErro(null);
            setEnviando(true);
            try {
              if (ehQuitacao) {
                await registrarQuitacaoAction(formData);
              } else {
                await registrarPagamentoAction(formData);
              }
              onClose();
            } catch (e) {
              setErro(e instanceof Error ? e.message : "Não foi possível registrar o pagamento. Tente novamente.");
            } finally {
              setEnviando(false);
            }
          }}
          className="grid grid-cols-2 gap-3"
        >
          <input type="hidden" name="idempotency_key" value={chave} />
          <input type="hidden" name="fornecedor_id" value={fornecedor.id} />
          {!ehQuitacao && <input type="hidden" name="lancamento_id" value={escolhido} />}
          <ModalError mensagem={erro} />

          <div className="col-span-2">
            <label className="block text-xs text-[var(--text-dim)] mb-1">O que você está pagando</label>
            <select
              value={escolhido}
              onChange={(e) => aoEscolher(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
            >
              {compras.map((l) => (
                <option key={l.lancamento.id} value={l.lancamento.id}>
                  {formatDataBR(dataLocal(l.lancamento.created_at))} · {l.lancamento.descricao} · falta{" "}
                  {money(l.falta)} · há {l.diasEmAberto}d
                </option>
              ))}
              {temDividaInformada && (
                <option value={DIVIDA_INFORMADA}>Dívida informada · {money(dividaInformada)}</option>
              )}
            </select>
            <p className="text-xs text-[var(--text-dim)] mt-1">
              {ehQuitacao
                ? "Dívida que não está lançada compra a compra: o pagamento entra como despesa deste mês, porque essa compra nunca foi lançada."
                : "Baixa nesta compra. Ela já contou como despesa no mês em que foi lançada, então o pagamento não gera despesa nova."}
            </p>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1">Valor pago (R$)</label>
            <input
              type="number"
              step="0.01"
              name="valor"
              value={valor}
              onChange={(e) => setValor(e.target.value === "" ? "" : Number(e.target.value))}
              required
              className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
            />
            {compraEscolhida && (
              <p className="text-xs text-[var(--text-dim)] mt-1">Falta {money(compraEscolhida.falta)}.</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1">Data</label>
            <input
              type="date"
              name={ehQuitacao ? "data" : "data_pagamento"}
              defaultValue={hoje()}
              required
              className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
            />
          </div>

          <ContaSelect contas={contas} fundo="surface-2" />

          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1">Forma de pagamento</label>
            <select
              name="forma_pagamento"
              className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
            >
              <option value="">Não informada</option>
              {FORMAS_PAGAMENTO.filter((f) => f.value !== "permuta").map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Só a quitação precisa de categoria: ela é uma despesa nova e
              tem que cair em algum lugar do DRE. A baixa de compra herda a
              categoria da compra. */}
          {ehQuitacao && (
            <div className="col-span-2">
              <label className="block text-xs text-[var(--text-dim)] mb-1">Categoria da despesa</label>
              <select
                name="categoria_id"
                className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
              >
                <option value="">Sem categoria</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando || valor === "" || !escolhido}
              className="px-4 py-2 text-sm bg-[var(--accent-green)] text-[var(--bg)] font-semibold rounded disabled:opacity-50"
            >
              {enviando ? "Registrando..." : "Registrar pagamento"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
