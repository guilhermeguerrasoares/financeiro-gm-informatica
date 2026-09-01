This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Usuários e permissões

Usuários são criados pelo dono no painel Supabase
(Authentication → Users → Add user). O cadastro público está desligado.

Todo usuário novo entra como `viewer`: enxerga tudo, não grava nada.
Para promover, rodar no SQL Editor do projeto:

```sql
update public.profiles set papel = 'gerente' where id = '<uuid do usuário>';
```

Papéis: `dono` e `gerente` gravam; `viewer` só lê (ver
`supabase/migrations/0009_rls_papel.sql`).

### Por que promover exige o SQL Editor

Não é inconveniência acidental. Até a migração `0015`, a policy de `profiles`
era `for all using (id = auth.uid())`, e `authenticated` tinha privilégio de
UPDATE em todas as colunas — inclusive `papel`. Qualquer usuário logado podia
rodar isto do próprio navegador e virar dono do financeiro:

```js
supabase.from('profiles').update({ papel: 'dono' }).eq('id', <seu id>)
```

RLS sozinho não resolve: numa policy de UPDATE, `using` enxerga a linha antiga
e `with check` a nova, e não existe forma de comparar as duas. Quem bloqueia é
o **GRANT por coluna**, aplicado pelo **Postgres** antes de a policy ser
avaliada — não pelo PostgREST, que apenas encaminha o `UPDATE`. A proteção
vale, portanto, para qualquer cliente, não só para o PostgREST.

**Invariante a preservar:** `authenticated` deve ter UPDATE em `profiles`
apenas na coluna `nome`. Conferir com:

```sql
select privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee in ('authenticated', 'anon', 'PUBLIC') and privilege_type = 'UPDATE';
```

O resultado tem que ser uma linha só no total: `nome`, para `authenticated`. Um
`grant all on all tables in schema public to authenticated` futuro reabre o
buraco em silêncio, porque privilégio de tabela ganha de privilégio de
coluna. Se essa consulta voltar mais de uma linha, isso é uma regressão de
segurança, não uma correção.

### Proteção de login

Cadastro público desligado; proteção contra senha vazada ligada; senha mínima
de 8 caracteres exigindo dígitos, minúsculas, maiúsculas e símbolos. O limite
de tentativas é o padrão da Supabase Auth por IP, configurável em
Authentication → Rate Limits.

A senha mínima de 8 com todas as classes de caractere foi escolhida no lugar
de 12 apenas com letras e números: pela tabela de entropia da documentação da
Supabase, a primeira é mais forte (~2^52 contra ~2^41).

CAPTCHA (hCaptcha/Turnstile) foi avaliado e deixado de fora: com cadastro
fechado, poucos usuários fixos e senha checada contra vazamento, ele adiciona
dependência de terceiro e atrito no login diário sem fechar um vetor que já
não esteja coberto. Se o limite por IP passar a ser atingido de verdade,
reavaliar — o suporte é nativo da Supabase Auth e a mudança fica em
`app/login/actions.ts` mais o formulário.
