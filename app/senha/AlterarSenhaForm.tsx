"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { alterarSenhaAction } from "./actions";
import { SENHA_MINIMA } from "@/lib/senha";

const CAMPO =
  "w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-cyan)]";

export function AlterarSenhaForm() {
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  return (
    <form
      className="glass glow-ring rounded-2xl p-6 max-w-md"
      action={async (formData) => {
        setSalvando(true);
        setErro(null);
        setPronto(false);
        try {
          const resultado = await alterarSenhaAction(formData);
          if (resultado.ok) {
            setPronto(true);
            (document.getElementById("form-senha") as HTMLFormElement | null)?.reset();
          } else {
            setErro(resultado.erro);
          }
        } finally {
          setSalvando(false);
        }
      }}
      id="form-senha"
    >
      <label className="block text-sm text-[var(--text-dim)] mb-1">Senha atual</label>
      <input name="senha_atual" type="password" required autoComplete="current-password" className={`${CAMPO} mb-4`} />

      <label className="block text-sm text-[var(--text-dim)] mb-1">Nova senha</label>
      <input name="nova_senha" type="password" required autoComplete="new-password" className={`${CAMPO} mb-1`} />
      <p className="text-[11px] text-[var(--text-dim)] mb-4">
        Mínimo de {SENHA_MINIMA} caracteres, com número, maiúscula, minúscula e símbolo. Senhas que
        aparecem em vazamentos conhecidos são recusadas.
      </p>

      <label className="block text-sm text-[var(--text-dim)] mb-1">Confirmar nova senha</label>
      <input name="confirmacao" type="password" required autoComplete="new-password" className={`${CAMPO} mb-4`} />

      {erro && <p className="text-sm text-[var(--accent-red)] mb-4">{erro}</p>}
      {pronto && <p className="text-sm text-[var(--accent-green)] mb-4">Senha alterada.</p>}

      <button
        type="submit"
        disabled={salvando}
        className="w-full flex items-center justify-center gap-2 text-[var(--bg)] font-semibold py-2 rounded-lg disabled:opacity-60"
        style={{ background: "var(--brand-gradient)" }}
      >
        <KeyRound size={16} strokeWidth={2} />
        {salvando ? "Alterando..." : "Alterar senha"}
      </button>
    </form>
  );
}
