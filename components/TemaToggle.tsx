"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { CHAVE_TEMA, temaInicial, type Tema } from "@/lib/tema";

// O estado nasce em "escuro" e é corrigido no primeiro efeito, em vez de ler
// localStorage no render: no servidor não existe localStorage, e ler no
// render faria o HTML enviado discordar do primeiro render do navegador. O
// tema em si já foi aplicado pelo script do layout antes da pintura, então
// essa correção só alinha o ícone - ninguém vê a tela trocar de cor.
export function TemaToggle() {
  const [tema, setTema] = useState<Tema>("escuro");

  useEffect(() => {
    try {
      setTema(temaInicial(localStorage.getItem(CHAVE_TEMA)));
    } catch {
      // Janela privada ou armazenamento bloqueado: fica no padrão.
    }
  }, []);

  function alternar() {
    const proximo: Tema = tema === "escuro" ? "claro" : "escuro";
    setTema(proximo);
    document.documentElement.dataset.theme = proximo;
    try {
      localStorage.setItem(CHAVE_TEMA, proximo);
    } catch {
      // Sem onde guardar: o tema vale só para esta aba, o que é melhor que
      // recusar a troca.
    }
  }

  const vaiPara = tema === "escuro" ? "claro" : "escuro";

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={`Mudar para o tema ${vaiPara}`}
      title={`Tema ${vaiPara}`}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-[var(--text-dim)] hover:bg-[var(--hover)] hover:text-[var(--text)] transition-colors"
    >
      {tema === "escuro" ? (
        <Sun size={16} strokeWidth={2} className="shrink-0" />
      ) : (
        <Moon size={16} strokeWidth={2} className="shrink-0" />
      )}
      Tema {vaiPara}
    </button>
  );
}
