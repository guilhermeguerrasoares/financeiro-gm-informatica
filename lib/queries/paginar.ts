// O PostgREST corta a resposta no "Max rows" do projeto (padrão 1000) e não
// avisa: devolve 200 com menos linhas, sem erro nenhum. Numa tela de listagem
// isso seria um incômodo; aqui é pior, porque `saldosPorConta`,
// `calcularProgressoMetas` e o DRE somam exatamente essas listas — um corte
// silencioso vira saldo errado, e nada na tela indica que faltou dado.
//
// Por isso ninguém aqui faz `.select()` solto: pagina-se até a última página
// vir incompleta, que é o único sinal confiável de fim.
const TAMANHO_PAGINA = 1000;

// Trava de segurança: 100 páginas = 100 mil linhas. Um filtro que volte a
// tabela inteira por engano para aqui em vez de rodar para sempre.
const MAX_PAGINAS = 100;

/**
 * Percorre todas as páginas de uma consulta PostgREST e devolve as linhas
 * juntas.
 *
 * @param montarConsulta Recebe o intervalo da página e devolve a consulta já
 *   com `.range()` aplicado. É uma função (e não uma consulta pronta) porque
 *   o builder do supabase-js é descartável: reaproveitar a mesma instância
 *   entre páginas acumula os filtros e a segunda chamada volta vazia.
 */
export async function buscarTodasAsPaginas<T>(
  montarConsulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const linhas: T[] = [];

  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const de = pagina * TAMANHO_PAGINA;
    const { data, error } = await montarConsulta(de, de + TAMANHO_PAGINA - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    linhas.push(...data);
    // Página incompleta significa que o servidor chegou ao fim do resultado.
    if (data.length < TAMANHO_PAGINA) break;
  }

  return linhas;
}

export { TAMANHO_PAGINA, MAX_PAGINAS };
