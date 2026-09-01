-- A validação em TypeScript dá mensagem decente ao usuário, mas roda no
-- cliente e pode ser pulada: quem chamar a API do Storage direto, com a anon
-- key e um cookie válido, sobe o que quiser. O limite que vale é este aqui,
-- que o Storage aplica antes de gravar.
update storage.buckets
set file_size_limit = 10485760, -- 10 MB, igual a TAMANHO_MAXIMO_BYTES
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf'
    ]
where id = 'comprovantes';
