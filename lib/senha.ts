// Validação da troca de senha. Deliberadamente NÃO replica a regra de
// complexidade (dígito, maiúscula, minúscula, símbolo): essa regra mora no
// painel da Supabase e pode ser mudada lá sem passar por este código. Duplicá-la
// aqui criaria duas fontes da verdade que divergem em silêncio — a tela
// recusaria senha que o servidor aceita, ou prometeria aceitar o que ele nega.
// Aqui fica só o que a tela sabe sozinha; o resto vem do servidor, traduzido.

export const SENHA_MINIMA = 8;

export function validarTrocaSenha(nova: string, confirmacao: string): string | null {
  if (!nova) return "Informe a nova senha.";
  if (nova.length < SENHA_MINIMA) {
    return `A nova senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  }
  if (nova !== confirmacao) return "A confirmação não confere com a nova senha.";
  return null;
}

// A Supabase responde em inglês. Mapeia o que dá para reconhecer e cai numa
// mensagem genérica em português no resto — mostrar o texto cru do servidor
// para o pessoal da loja não ajudaria ninguém.
export function traduzirErroSenha(mensagem: string): string {
  const m = mensagem.toLowerCase();

  if (m.includes("invalid login credentials")) return "Senha atual incorreta.";
  if (m.includes("weak") || m.includes("pwned") || m.includes("leaked")) {
    return "Essa senha aparece em vazamentos conhecidos. Escolha outra.";
  }
  if (m.includes("should be different")) {
    return "A nova senha precisa ser diferente da atual.";
  }
  if (m.includes("at least") || m.includes("should contain")) {
    return "A senha não atende à política mínima exigida (tamanho e tipos de caractere).";
  }
  return "Não foi possível alterar a senha. Tente de novo.";
}
