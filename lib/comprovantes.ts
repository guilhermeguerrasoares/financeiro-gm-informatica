// Validação de comprovante de pagamento. O limite que vale de verdade é o do
// bucket (migração 0018) — isto aqui existe para o usuário receber uma
// mensagem em português antes de esperar o upload de um arquivo que o Storage
// ia recusar de qualquer jeito.

export const TIPOS_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024;

// O nome vem do computador do usuário e ia cru para o path do Storage.
// Reduzir a [a-z0-9.-] tira separador de diretório, byte nulo e unicode
// esquisito de uma vez, em vez de tentar listar o que é perigoso.
export function sanitizarNomeArquivo(nome: string): string {
  const base = nome.split(/[\\/]/).pop() ?? "";
  const semAcento = base.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const limpo = semAcento
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return (limpo || "arquivo").slice(0, 80);
}

export function validarComprovante(arquivo: { type: string; size: number }): string | null {
  if (!(TIPOS_PERMITIDOS as readonly string[]).includes(arquivo.type)) {
    return "Comprovante deve ser JPG, PNG, WEBP ou PDF.";
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return "Comprovante deve ter no máximo 10 MB.";
  }
  return null;
}

export function montarCaminhoComprovante(
  lancamentoId: string,
  nome: string,
  agoraMs: number
): string {
  return `${lancamentoId}/${agoraMs}-${sanitizarNomeArquivo(nome)}`;
}
