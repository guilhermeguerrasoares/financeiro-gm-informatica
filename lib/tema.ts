export type Tema = "claro" | "escuro";

// Chave no localStorage do navegador. A preferência é por navegador, e não
// por usuário no banco: é escolha de conforto visual, e uma ida ao servidor
// para resolvê-la faria a tela piscar no tema errado a cada carregamento.
export const CHAVE_TEMA = "tema";

// Escuro é o padrão porque é o tema que o sistema sempre teve: quem nunca
// escolheu nada não pode ver a tela mudar sozinha. Valor desconhecido cai no
// padrão em vez de virar atributo inválido no <html>.
export function temaInicial(armazenado: string | null): Tema {
  return armazenado === "claro" ? "claro" : "escuro";
}
