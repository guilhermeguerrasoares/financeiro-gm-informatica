# Correções de Segurança — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a escalação de privilégio em `profiles`, impedir que cadastro público vire acesso total, e endurecer autenticação, upload e headers HTTP do sistema financeiro.

**Architecture:** Quase tudo é banco e painel, não aplicação. A correção central é mover o controle de `profiles.papel` do RLS (que não consegue comparar linha antiga com nova) para **GRANT por coluna**, que o PostgREST respeita antes de qualquer policy. As demais correções são quatro migrações numeradas, um módulo puro de validação de upload testado em vitest, e headers em `next.config.ts`.

**Tech Stack:** Next.js 15 (App Router, server actions), React 19, TypeScript, Supabase (Postgres 17 + RLS + Storage), vitest.

**Spec:** Não há spec separado. Este plano nasce da auditoria de 2026-09-01; os achados que ele corrige estão listados na seção "Achados" abaixo, com a evidência de cada um.

**Projeto Supabase:** `oiidbgyhihaaearcqjas` (`financeiro-gm-informatica`, us-east-2)

## Global Constraints

- Migrações numeradas em sequência a partir de `0015`, comentadas explicando **por que**, não o quê — seguir o tom de `supabase/migrations/0013_ajuste_saldo.sql`.
- Migrações são aplicadas via MCP do Supabase (`apply_migration`) direto no projeto de produção. **Não existe ambiente de staging.** Toda migração deste plano deve ser idempotente (`drop policy if exists`, `create or replace`) para poder ser reaplicada sem estrago.
- O arquivo `.sql` local em `supabase/migrations/` é a fonte da verdade e vai para o git; o `apply_migration` recebe o mesmo conteúdo.
- Textos de interface em **português do Brasil**, no vocabulário da loja.
- Nenhuma tarefa deste plano pode introduzir uso da `service_role` no código da aplicação. O cliente Supabase continua sendo o de anon key amarrado ao cookie (`lib/supabase/server.ts`).
- Rodar `npm test` antes de cada commit que toque em `lib/`.

## Achados que este plano corrige

| # | Achado | Evidência | Tarefa |
|---|---|---|---|
| A1 | Qualquer usuário logado pode se promover a `dono` | `authenticated` tem privilégio UPDATE na coluna `papel` (confirmado em `information_schema.column_privileges`), e a policy de `0002_rls.sql:11` é `for all using (id = auth.uid())` | 2 |
| A2 | Todo usuário novo nasce `dono` | `0004_profile_trigger.sql:8` grava `'dono'` fixo; `profiles.papel` tem `default 'dono'` em `0001_schema.sql:14` | 1, 3 |
| A3 | `handle_new_user()` é SECURITY DEFINER exposta a `anon` via `/rest/v1/rpc/` | advisor `anon_security_definer_function_executable` | 3 |
| A4 | 8 funções com `search_path` mutável | advisor `function_search_path_mutable` | 4 |
| A5 | Proteção contra senha vazada desligada; sem limite de tentativa próprio | advisor `auth_leaked_password_protection` | 5 |
| A6 | Upload de comprovante sem validar tipo nem tamanho; path monta com `file.name` cru | `app/lancamentos/uploadComprovante.ts:7`, `app/lancamentos/actions.ts:23` | 6 |
| A7 | Sem headers de segurança (CSP, X-Frame-Options, HSTS) | `next.config.ts` vazio | 7 |
| A8 | Chave `service_role` em texto claro numa regra de permissão | `.claude/settings.local.json` | 8 |

---

### Task 1: Desligar cadastro público no painel Supabase

Primeiro porque é o de maior risco e o mais rápido: enquanto o cadastro estiver aberto, qualquer pessoa na internet cria conta e — por causa de A2 — entra como `dono` do financeiro. Não tem código; é uma checagem de configuração.

**Files:** nenhum.

**Interfaces:**
- Consumes: nada
- Produces: a certeza de que só o dono cria usuários — as tarefas 2 e 3 assumem isso.

- [ ] **Step 1: Abrir a configuração de provedores de autenticação**

Abrir: https://supabase.com/dashboard/project/oiidbgyhihaaearcqjas/auth/providers

Expandir o provedor **Email**.

- [ ] **Step 2: Verificar o estado atual e anotar**

Procurar o controle de cadastro de novos usuários — dependendo da versão do painel aparece como **"Allow new users to sign up"** dentro do provedor Email, ou como **"User Signups"** em Authentication → Sign In / Up.

Anotar o estado encontrado (ligado ou desligado) na mensagem do commit da Task 2, porque isso muda a urgência do resto: se estava **ligado**, tratar como incidente e seguir o Step 4.

- [ ] **Step 3: Desligar**

Desligar o toggle e salvar. Este sistema tem usuários fixos (a equipe da loja); contas novas passam a ser criadas pelo dono em Authentication → Users → "Add user".

- [ ] **Step 4: Só se o cadastro estava ligado — auditar quem entrou**

Abrir https://supabase.com/dashboard/project/oiidbgyhihaaearcqjas/auth/users e conferir a lista inteira. Qualquer e-mail que não seja da equipe da loja deve ser removido antes de seguir para a Task 2.

- [ ] **Step 5: Confirmar que o login da equipe continua funcionando**

Abrir o sistema, sair, entrar de novo com a conta do dono. Desligar cadastro não afeta login de conta existente — este passo é só para não descobrir um problema depois de três migrações aplicadas.

---

### Task 2: Tornar `profiles.papel` imutável pelo próprio usuário

O furo central. O RLS sozinho **não resolve**: numa policy de UPDATE, `using` enxerga a linha antiga e `with check` a nova, e não há como comparar as duas. A ferramenta certa é GRANT por coluna, que o PostgREST aplica antes de chegar na policy.

Verificado antes de escrever esta tarefa: o app **nunca** lê nem escreve `profiles` (`grep -rn 'profiles' app lib components` só acha um comentário solto em `lib/types.ts`). Restringir a tabela não quebra nenhuma tela.

**Files:**
- Create: `supabase/migrations/0015_profiles_papel_imutavel.sql`

**Interfaces:**
- Consumes: a tabela `profiles` e as policies de `0002_rls.sql`
- Produces: `authenticated` passa a ter UPDATE **apenas** na coluna `nome` de `profiles`. As policies das outras tabelas (`0009_rls_papel.sql`), que leem `profiles.papel`, continuam funcionando sem alteração — elas só fazem SELECT.

- [ ] **Step 1: Registrar o estado atual (a prova do furo)**

Rodar via MCP `execute_sql` no projeto `oiidbgyhihaaearcqjas`:

```sql
select privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'profiles'
  and grantee = 'authenticated'
  and privilege_type = 'UPDATE'
order by column_name;
```

Esperado ANTES da correção: 4 linhas — `created_at`, `id`, `nome`, `papel`. A linha `papel` é o furo.

- [ ] **Step 2: Escrever a migração**

Criar `supabase/migrations/0015_profiles_papel_imutavel.sql`:

```sql
-- A policy de 0002 ("profiles: usuário vê e edita o próprio perfil") é
-- `for all using (id = auth.uid())`. `for all` inclui UPDATE, e a checagem só
-- olha o id — então qualquer usuário logado, inclusive um 'viewer', podia
-- rodar do próprio navegador:
--
--   supabase.from('profiles').update({ papel: 'dono' }).eq('id', <seu id>)
--
-- ...e passar nas duas condições. Isso anulava inteiramente a migração 0009,
-- que separou leitura de escrita justamente para o 'viewer' não escrever nada.
--
-- RLS não consegue barrar isso sozinho: numa policy de UPDATE, `using` vê a
-- linha antiga e `with check` a nova, e não existe forma de comparar as duas.
-- Quem barra é o GRANT por coluna, que o PostgREST aplica antes da policy.
-- Trocar `papel` passa a exigir service_role (SQL Editor do painel).

revoke update on public.profiles from anon, authenticated;
grant update (nome) on public.profiles to authenticated;

-- Ninguém cria nem apaga perfil pela API: quem cria é o trigger
-- handle_new_user (SECURITY DEFINER, roda como owner e ignora isto), e apagar
-- o próprio perfil só serviria para o usuário se trancar para fora — as
-- policies de 0009 exigem uma linha em profiles para qualquer leitura.
revoke insert, delete on public.profiles from anon, authenticated;

-- Substitui o `for all` por policies explícitas. Sem policy de insert/delete,
-- o RLS nega as duas por padrão — cinto e suspensório junto com o revoke.
drop policy if exists "profiles: usuário vê e edita o próprio perfil" on public.profiles;

drop policy if exists "profiles: leitura do próprio perfil" on public.profiles;
create policy "profiles: leitura do próprio perfil"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profiles: atualização do próprio nome" on public.profiles;
create policy "profiles: atualização do próprio nome"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());
```

- [ ] **Step 3: Aplicar a migração**

Via MCP `apply_migration` no projeto `oiidbgyhihaaearcqjas`, com `name: "profiles_papel_imutavel"` e o conteúdo exato do arquivo acima.

- [ ] **Step 4: Verificar que o furo fechou**

Rodar de novo o SQL do Step 1.

Esperado DEPOIS: **1 linha só** — `nome`. Se `papel` ainda aparecer, o revoke não pegou; parar e investigar antes de seguir.

Rodar também, para confirmar que as policies ficaram como esperado:

```sql
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'profiles'
order by policyname;
```

Esperado: exatamente 2 linhas — `profiles: atualização do próprio nome` (UPDATE) e `profiles: leitura do próprio perfil` (SELECT).

- [ ] **Step 5: Verificar que o sistema não quebrou**

Rodar `npm run dev`, entrar no sistema e abrir Dashboard, Entradas e Saídas, Clientes e Contas. Todas devem carregar normalmente — as policies de `0009` fazem SELECT em `profiles`, que continua liberado.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0015_profiles_papel_imutavel.sql
git commit -m "fix(seguranca): impedir que usuário altere o próprio papel"
```

---

### Task 3: Usuário novo nasce `viewer` e a função de trigger sai da API

Duas coisas na mesma migração porque as duas são sobre `handle_new_user` e uma sem a outra deixa o trabalho pela metade.

**Files:**
- Create: `supabase/migrations/0016_novo_usuario_viewer.sql`

**Interfaces:**
- Consumes: `public.handle_new_user()` de `0004_profile_trigger.sql`; o trigger `on_auth_user_created` continua o mesmo e **não** precisa ser recriado (`create or replace function` mantém o vínculo).
- Produces: perfis novos entram como `'viewer'` — só leitura. Promover alguém passa a ser um comando manual, documentado no Step 5.

- [ ] **Step 1: Anotar quem é dono hoje**

Rodar via `execute_sql`:

```sql
select id, nome, papel from public.profiles order by created_at;
```

Guardar o resultado. Depois da migração, essas linhas têm que continuar idênticas — a mudança vale só para cadastro futuro.

- [ ] **Step 2: Escrever a migração**

Criar `supabase/migrations/0016_novo_usuario_viewer.sql`:

```sql
-- A migração 0004 dava 'dono' a todo mundo que se cadastrasse, e o default da
-- coluna (0001) também era 'dono'. Combinado com cadastro público aberto, isso
-- significava acesso total ao financeiro para qualquer pessoa que criasse uma
-- conta. O cadastro público foi desligado no painel, mas o padrão continua
-- errado: privilégio se concede, não se herda.
--
-- Perfil novo passa a nascer 'viewer' (só leitura). Promover é ato explícito
-- do dono, via SQL Editor — a coluna `papel` não é mais gravável pela API
-- desde a migração 0015.

alter table public.profiles alter column papel set default 'viewer';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, nome, papel)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), 'viewer');
  return new;
end;
$$;

-- A função só existe para ser chamada pelo trigger on_auth_user_created.
-- Estando no schema `public`, o PostgREST a expunha em /rest/v1/rpc/ para os
-- roles anon e authenticated — foi o que o linter do Supabase acusou. Não há
-- motivo para ninguém chamá-la pela API.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
```

- [ ] **Step 3: Aplicar a migração**

Via MCP `apply_migration`, `name: "novo_usuario_viewer"`.

- [ ] **Step 4: Verificar**

```sql
select id, nome, papel from public.profiles order by created_at;
```

Esperado: idêntico ao Step 1 — nenhum perfil existente foi rebaixado.

```sql
select column_default from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'papel';
```

Esperado: `'viewer'::papel_usuario`.

Rodar o advisor de segurança (MCP `get_advisors`, `type: "security"`). Os dois avisos `..._security_definer_function_executable` sobre `handle_new_user` devem ter sumido.

- [ ] **Step 5: Documentar como promover alguém**

Adicionar ao final do `README.md`:

```markdown
## Usuários e permissões

Usuários são criados pelo dono no painel Supabase
(Authentication → Users → Add user). O cadastro público está desligado.

Todo usuário novo entra como `viewer`: enxerga tudo, não grava nada.
Para promover, rodar no SQL Editor do projeto:

```sql
update public.profiles set papel = 'gerente' where id = '<uuid do usuário>';
```

Papéis: `dono` e `gerente` gravam; `viewer` só lê (ver
`supabase/migrations/0009_rls_papel.sql`). A coluna `papel` não é gravável
pela API do sistema de propósito — só pelo SQL Editor
(`supabase/migrations/0015_profiles_papel_imutavel.sql`).
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0016_novo_usuario_viewer.sql README.md
git commit -m "fix(seguranca): usuário novo nasce viewer e handle_new_user sai da API"
```

---

### Task 4: Fixar `search_path` das funções

O linter acusou 8 funções sem `search_path` fixo. O risco é real mas indireto: se alguém conseguir criar um schema no `search_path` do chamador, consegue sequestrar a resolução de nomes dentro da função. Baixo agora, gratuito de corrigir.

**Files:**
- Create: `supabase/migrations/0017_search_path_funcoes.sql`

**Interfaces:**
- Consumes: as funções criadas em `0001`, `0008`, `0011`, `0013`, `0014`
- Produces: nada que outra tarefa use. Independente das demais.

- [ ] **Step 1: Escrever a migração**

Criar `supabase/migrations/0017_search_path_funcoes.sql`:

```sql
-- Função sem `search_path` fixo resolve nomes pelo search_path de quem chama.
-- O linter do Supabase (0011_function_search_path_mutable) acusou as 8 funções
-- abaixo. Fixar é gratuito e tira a classe inteira de ataque de mesa.
--
-- Loop em vez de 8 ALTERs escritos à mão porque várias delas têm sobrecarga
-- (registrar_pagamento_com_permuta foi recriada em 0010 e 0011 com assinaturas
-- diferentes) — `oid::regprocedure` acerta a assinatura sozinho, sem depender
-- de eu transcrever a lista de tipos corretamente.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'set_updated_at',
        'vender_item_permuta',
        'registrar_pagamento_com_permuta',
        'registrar_ajuste_saldo',
        'criar_serie_lancamentos',
        'inserir_ocorrencias_serie',
        'atualizar_serie_lancamentos',
        'excluir_serie_lancamentos'
      )
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.assinatura);
  end loop;
end $$;
```

- [ ] **Step 2: Aplicar a migração**

Via MCP `apply_migration`, `name: "search_path_funcoes"`.

- [ ] **Step 3: Verificar que não sobrou nenhuma**

```sql
select p.proname, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
order by p.proname;
```

Esperado: toda linha com `proconfig` contendo `search_path=public, pg_temp`. Nenhuma com `proconfig` nulo.

- [ ] **Step 4: Verificar que as funções ainda funcionam**

`npm run dev`, e no sistema:
1. Registrar um pagamento em um lançamento (exercita `registrar_pagamento_com_permuta`)
2. Criar um lançamento parcelado em 3x (exercita `criar_serie_lancamentos`)
3. Excluir a série criada (exercita `excluir_serie_lancamentos`)
4. Fazer um ajuste de saldo em uma conta (exercita `registrar_ajuste_saldo`)

Todas devem completar sem erro. `search_path = public, pg_temp` cobre tudo que essas funções referenciam, mas este passo é o que prova.

- [ ] **Step 5: Rodar o advisor**

MCP `get_advisors`, `type: "security"`. Os 8 avisos `function_search_path_mutable` devem ter sumido.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0017_search_path_funcoes.sql
git commit -m "fix(seguranca): fixar search_path das funções do schema public"
```

---

### Task 5: Endurecer autenticação no painel

Sem código. É a resposta ao "rate limit" da auditoria — com uma decisão explícita registrada.

**Files:** nenhum.

**Interfaces:**
- Consumes: nada
- Produces: nada. Independente das demais tarefas.

- [ ] **Step 1: Ligar proteção contra senha vazada**

Abrir https://supabase.com/dashboard/project/oiidbgyhihaaearcqjas/auth/providers → provedor **Email** → ligar **"Prevent use of leaked passwords"**.

Passa a checar toda senha contra o HaveIBeenPwned na criação e na troca. Referência: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

- [ ] **Step 2: Exigir senha decente**

Na mesma tela: **Minimum password length** para `12`, e **Password Requirements** para exigir letras e números (`Letters and digits` ou mais forte).

Isso vale para senha nova. As senhas atuais da equipe não são revalidadas — o Step 5 trata disso.

- [ ] **Step 3: Revisar os limites de tentativa**

Abrir https://supabase.com/dashboard/project/oiidbgyhihaaearcqjas/auth/rate-limits e anotar o valor atual do limite do endpoint de token (login).

Este sistema tem um punhado de usuários fixos e nenhum cadastro público. Baixar o limite para o mínimo que a operação da loja aguenta é ganho direto contra força bruta — não há tráfego legítimo em volume para proteger.

- [ ] **Step 4: Registrar a decisão sobre CAPTCHA**

**Decisão: não implementar CAPTCHA agora.** Registrar no `README.md`, na seção criada na Task 3:

```markdown
### Proteção de login

Cadastro público desligado; proteção contra senha vazada ligada; senha mínima
de 12 caracteres. O limite de tentativas é o da Supabase Auth por IP,
configurado em Authentication → Rate Limits.

CAPTCHA (hCaptcha/Turnstile) foi avaliado e deixado de fora: com cadastro
fechado, poucos usuários fixos e senha checada contra vazamento, ele adiciona
dependência de terceiro e atrito no login diário sem fechar um vetor que já
não esteja coberto. Se o limite por IP passar a ser atingido de verdade,
reavaliar — o suporte é nativo da Supabase Auth e a mudança fica em
`app/login/actions.ts` mais o formulário.
```

- [ ] **Step 5: Trocar as senhas da equipe**

As regras dos Steps 1 e 2 só valem para senha nova. Cada pessoa da equipe deve trocar a senha uma vez para passar pela validação — inclusive o dono. Fazer por "Esqueci minha senha" ou pelo painel (Authentication → Users → "Send password recovery").

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs(seguranca): registrar configuração de autenticação e decisão sobre CAPTCHA"
```

---

### Task 6: Validar comprovante antes de subir

Hoje qualquer arquivo, de qualquer tamanho, com qualquer nome vai para o Storage. O bucket é privado e servido por URL assinada de 60s, então o risco é contido — mas o nome do arquivo vai cru para o path e não há teto de tamanho.

A validação vive em módulo puro testado em vitest (padrão do projeto: `lib/series.ts`, `lib/calculations.ts`). O limite **de verdade** é o do bucket, no Step 8 — validação em TypeScript é mensagem de erro decente para o usuário, não fronteira de segurança.

**Files:**
- Create: `lib/comprovantes.ts`
- Test: `lib/comprovantes.test.ts`
- Modify: `app/lancamentos/uploadComprovante.ts` (arquivo inteiro, 14 linhas)
- Modify: `app/lancamentos/actions.ts:20-27` (função `uploadComprovanteServidor`)
- Create: `supabase/migrations/0018_limites_bucket_comprovantes.sql`

**Interfaces:**
- Consumes: nada de tarefas anteriores
- Produces:
  - `TIPOS_PERMITIDOS: readonly string[]`
  - `TAMANHO_MAXIMO_BYTES: number`
  - `sanitizarNomeArquivo(nome: string): string`
  - `validarComprovante(arquivo: { type: string; size: number }): string | null` — devolve a mensagem de erro em português, ou `null` se estiver tudo certo
  - `montarCaminhoComprovante(lancamentoId: string, nome: string, agoraMs: number): string`

- [ ] **Step 1: Escrever os testes que falham**

Criar `lib/comprovantes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  sanitizarNomeArquivo,
  validarComprovante,
  montarCaminhoComprovante,
  TAMANHO_MAXIMO_BYTES,
} from "./comprovantes";

describe("sanitizarNomeArquivo", () => {
  it("descarta diretórios do nome", () => {
    expect(sanitizarNomeArquivo("../../etc/passwd")).toBe("passwd");
  });

  it("tira acento e espaço, preservando a extensão", () => {
    expect(sanitizarNomeArquivo("Nota Fiscal Março.pdf")).toBe("nota-fiscal-marco.pdf");
  });

  it("colapsa separadores repetidos", () => {
    expect(sanitizarNomeArquivo("nota   ---   2.pdf")).toBe("nota-2.pdf");
  });

  it("devolve um nome utilizável quando não sobra nada", () => {
    expect(sanitizarNomeArquivo("///")).toBe("arquivo");
  });

  it("limita o comprimento", () => {
    expect(sanitizarNomeArquivo("a".repeat(200) + ".pdf").length).toBeLessThanOrEqual(80);
  });
});

describe("validarComprovante", () => {
  it("aceita PDF dentro do limite", () => {
    expect(validarComprovante({ type: "application/pdf", size: 1024 })).toBeNull();
  });

  it("aceita imagem dentro do limite", () => {
    expect(validarComprovante({ type: "image/png", size: 1024 })).toBeNull();
  });

  it("recusa tipo fora da lista", () => {
    expect(validarComprovante({ type: "text/html", size: 1024 })).toBe(
      "Comprovante deve ser JPG, PNG, WEBP ou PDF."
    );
  });

  it("recusa arquivo acima do limite", () => {
    expect(validarComprovante({ type: "application/pdf", size: TAMANHO_MAXIMO_BYTES + 1 })).toBe(
      "Comprovante deve ter no máximo 10 MB."
    );
  });
});

describe("montarCaminhoComprovante", () => {
  it("prefixa com o lançamento e o instante, com o nome já limpo", () => {
    expect(montarCaminhoComprovante("abc-123", "Nota Fiscal.pdf", 1700000000000)).toBe(
      "abc-123/1700000000000-nota-fiscal.pdf"
    );
  });
});
```

- [ ] **Step 2: Rodar os testes para vê-los falhar**

```bash
npm test -- lib/comprovantes.test.ts
```

Esperado: FAIL — `Failed to resolve import "./comprovantes"`.

- [ ] **Step 3: Escrever o módulo**

Criar `lib/comprovantes.ts`:

```ts
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
```

- [ ] **Step 4: Rodar os testes para vê-los passar**

```bash
npm test -- lib/comprovantes.test.ts
```

Esperado: PASS, 10 testes.

- [ ] **Step 5: Ligar no upload do cliente**

Substituir o conteúdo inteiro de `app/lancamentos/uploadComprovante.ts` por:

```ts
"use client";

import { createClient } from "@/lib/supabase/client";
import { validarComprovante, montarCaminhoComprovante } from "@/lib/comprovantes";

export async function uploadComprovante(file: File, lancamentoId: string): Promise<string> {
  const erro = validarComprovante(file);
  if (erro) throw new Error(erro);

  const supabase = createClient();
  const path = montarCaminhoComprovante(lancamentoId, file.name, Date.now());

  const { error } = await supabase.storage.from("comprovantes").upload(path, file);
  if (error) throw error;

  return path;
}
```

- [ ] **Step 6: Ligar no upload do servidor**

Em `app/lancamentos/actions.ts`, substituir a função `uploadComprovanteServidor` (linhas 20-27) por:

```ts
async function uploadComprovanteServidor(arquivo: File, lancamentoId: string): Promise<string | null> {
  if (arquivo.size === 0) return null;
  const erro = validarComprovante(arquivo);
  if (erro) throw new Error(erro);
  const supabase = await createClient();
  const path = montarCaminhoComprovante(lancamentoId, arquivo.name, Date.now());
  const { error } = await supabase.storage.from("comprovantes").upload(path, arquivo);
  if (error) throw error;
  return path;
}
```

E adicionar ao bloco de imports do topo do arquivo, junto dos outros imports de `@/lib`:

```ts
import { validarComprovante, montarCaminhoComprovante } from "@/lib/comprovantes";
```

- [ ] **Step 7: Verificar que compila e que a suíte toda passa**

```bash
npx tsc --noEmit && npm test
```

Esperado: sem erro de tipo, todos os testes passando.

- [ ] **Step 8: Escrever e aplicar os limites no bucket**

Criar `supabase/migrations/0018_limites_bucket_comprovantes.sql`:

```sql
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
```

Aplicar via MCP `apply_migration`, `name: "limites_bucket_comprovantes"`.

Verificar:

```sql
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'comprovantes';
```

Esperado: `public` = false, `file_size_limit` = 10485760, os 4 mime types.

- [ ] **Step 9: Testar o caminho feliz e o infeliz na tela**

`npm run dev`, em Entradas e Saídas:
1. Anexar um PDF pequeno a um pagamento → sobe, e "Ver comprovante" abre.
2. Tentar anexar um arquivo `.txt` → recusado com "Comprovante deve ser JPG, PNG, WEBP ou PDF."

- [ ] **Step 10: Commit**

```bash
git add lib/comprovantes.ts lib/comprovantes.test.ts app/lancamentos/uploadComprovante.ts app/lancamentos/actions.ts supabase/migrations/0018_limites_bucket_comprovantes.sql
git commit -m "fix(seguranca): validar tipo, tamanho e nome do comprovante"
```

---

### Task 7: Headers de segurança

`next.config.ts` está vazio. Sem `X-Frame-Options` a aplicação pode ser embutida em iframe (clickjacking); sem CSP, um script injetado por qualquer via consegue exfiltrar dados para fora.

**Files:**
- Modify: `next.config.ts` (arquivo inteiro, 7 linhas)

**Interfaces:**
- Consumes: `process.env.NEXT_PUBLIC_SUPABASE_URL` (já usada em `lib/supabase/client.ts`)
- Produces: nada que outra tarefa use.

- [ ] **Step 1: Escrever o config**

Substituir o conteúdo inteiro de `next.config.ts` por:

```ts
import type { NextConfig } from "next";

const emDesenvolvimento = process.env.NODE_ENV === "development";
const supabaseOrigem = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// CSP sem nonce, de propósito. O App Router injeta scripts inline de
// hidratação; um CSP com nonce exigiria gerar e propagar o nonce pelo
// middleware, que hoje só cuida de sessão. Mesmo com 'unsafe-inline', a
// política já barra o que interessa aqui: carregar script de origem externa e
// mandar dado para fora (connect-src). Trocar por nonce é evolução possível,
// não pré-requisito.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // O HMR do next dev usa eval e um websocket; em produção nenhum dos dois entra.
  emDesenvolvimento
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  emDesenvolvimento
    ? `connect-src 'self' ${supabaseOrigem} ws://localhost:* http://localhost:*`
    : `connect-src 'self' ${supabaseOrigem}`,
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verificar que os headers saem**

```bash
npm run dev
```

Em outro terminal:

```bash
curl -sI http://localhost:3000/login | grep -i "content-security-policy\|x-frame-options\|x-content-type-options\|referrer-policy\|permissions-policy"
```

Esperado: as 5 linhas presentes. (`Strict-Transport-Security` é ignorado em HTTP local; aparece em produção.)

- [ ] **Step 3: Verificar que o sistema funciona sob a CSP**

Com o `npm run dev` rodando, abrir o sistema no navegador com o **console aberto** e passar por: login → Dashboard → Entradas e Saídas → abrir o modal de lançamento → salvar um lançamento → anexar e abrir um comprovante.

Esperado: **zero** erro de `Content Security Policy` no console. Se aparecer algum bloqueio, a diretiva que faltou está na própria mensagem do erro — ajustar e repetir este passo antes de commitar.

O passo do comprovante é o que mais importa: a URL assinada aponta para o domínio do Supabase e é aberta em aba nova, mas o `fetch` que a gera passa por `connect-src`.

- [ ] **Step 4: Verificar o build de produção**

```bash
npm run build
```

Esperado: build completa sem erro. Confirma que o ramo não-desenvolvimento da CSP é válido.

- [ ] **Step 5: Commit**

```bash
git add next.config.ts
git commit -m "feat(seguranca): adicionar CSP e headers de segurança"
```

---

### Task 8: Remover a chave `service_role` morta das permissões locais

`.claude/settings.local.json` guarda regras de permissão que embutem, em texto claro, uma chave `service_role` JWT do projeto `wutwfdouywylumywwxrm`.

Duas coisas reduzem a gravidade, e nenhuma delas é motivo para deixar como está: `.claude/` é ignorado pelo git (verificado — nunca foi commitado), e o projeto `wutwfdouywylumywwxrm` **não existe mais** (não aparece em `list_projects`), o que torna a chave inerte. É higiene, não incêndio.

**Files:**
- Modify: `.claude/settings.local.json`

**Interfaces:**
- Consumes: nada
- Produces: nada. Independente das demais tarefas.

- [ ] **Step 1: Confirmar que o projeto realmente não existe mais**

Rodar MCP `list_projects` e conferir que nenhum projeto tem ref `wutwfdouywylumywwxrm`.

Se ele **aparecer** na lista, parar: a chave está viva e o certo é rotacioná-la primeiro, no painel daquele projeto (Settings → API → Reveal/Rotate service_role), antes de mexer no arquivo.

- [ ] **Step 2: Remover as três regras que contêm chave**

Editar `.claude/settings.local.json` e apagar do array `permissions.allow` as três entradas que começam com `Bash(curl -s` e contêm `wutwfdouywylumywwxrm` — duas com a anon key e uma com a `service_role`.

Manter todas as outras entradas.

- [ ] **Step 3: Verificar que o JSON continua válido e limpo**

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.local.json','utf8')); console.log('JSON valido')"
grep -c "eyJ" .claude/settings.local.json
```

Esperado: `JSON valido`, e a contagem do grep em `0`.

- [ ] **Step 4: Confirmar que o arquivo segue fora do git**

```bash
git check-ignore -v .claude/settings.local.json
```

Esperado: uma linha apontando `.gitignore` e o padrão `.claude/`.

- [ ] **Step 5: Sem commit**

O arquivo é ignorado pelo git; não há o que commitar. A tarefa termina aqui.

---

## Verificação final

Depois das 8 tarefas, rodar em sequência:

- [ ] `npm test` — suíte inteira verde
- [ ] `npx tsc --noEmit` — sem erro de tipo
- [ ] `npm run build` — build de produção completa
- [ ] MCP `get_advisors` (`type: "security"`) — devem restar **zero** avisos das categorias `function_search_path_mutable`, `anon_security_definer_function_executable`, `authenticated_security_definer_function_executable` e `auth_leaked_password_protection`
- [ ] Teste manual de ponta a ponta: login → criar lançamento parcelado → registrar pagamento com comprovante → abrir o comprovante → ajuste de saldo → logout

## Fora de escopo (decidido, não esquecido)

- **CAPTCHA no login** — justificativa registrada na Task 5, Step 4.
- **CSP com nonce** — a política desta entrega usa `'unsafe-inline'` em `script-src`. Subir para nonce exige propagar o nonce pelo middleware; vale quando houver motivo, não agora.
- **MFA (2FA)** — a Supabase Auth suporta TOTP nativo, mas exige tela de enrollment e de verificação no app. É uma entrega própria, não um remendo dentro deste plano.
- **Criptografia de coluna em `clientes.documento`** — hoje o CPF/CNPJ fica em texto claro no Postgres (há criptografia de disco e TLS em trânsito, mas nada em nível de coluna). É decisão de produto, não correção de bug: o caminho barato é **parar de guardar o documento completo**; o caro é `pgcrypto` na coluna, que quebra busca e ordenação por documento. Precisa da decisão do dono antes de virar tarefa.
