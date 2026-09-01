"use server";

import { createClient } from "@/lib/supabase/server";
import { validarTrocaSenha, traduzirErroSenha } from "@/lib/senha";

export type ResultadoTrocaSenha = { ok: true } | { ok: false; erro: string };

export async function alterarSenhaAction(formData: FormData): Promise<ResultadoTrocaSenha> {
  const atual = (formData.get("senha_atual") as string) || "";
  const nova = (formData.get("nova_senha") as string) || "";
  const confirmacao = (formData.get("confirmacao") as string) || "";

  const erroLocal = validarTrocaSenha(nova, confirmacao);
  if (erroLocal) return { ok: false, erro: erroLocal };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return { ok: false, erro: "Sessão expirada. Entre de novo." };

  // Reautentica antes de trocar: `updateUser` sozinho aceita a troca só com a
  // sessão válida, o que deixaria qualquer pessoa numa máquina destravada
  // mudar a senha e tomar a conta. Conferir a senha atual é o que impede isso.
  // Usamos signInWithPassword em vez do fluxo de nonce da Supabase porque não
  // depende de e-mail — que este sistema ainda não tem configurado.
  const { error: erroAtual } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: atual,
  });
  if (erroAtual) return { ok: false, erro: traduzirErroSenha(erroAtual.message) };

  const { error: erroTroca } = await supabase.auth.updateUser({ password: nova });
  if (erroTroca) return { ok: false, erro: traduzirErroSenha(erroTroca.message) };

  return { ok: true };
}
