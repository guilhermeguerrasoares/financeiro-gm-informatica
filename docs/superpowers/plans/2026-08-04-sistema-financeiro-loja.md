# Sistema de Gestão Financeira — Loja de Informática Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based financial management system for the computer store — dashboard, entradas/saídas, formas de pagamento, permutas, clientes/LTV, dívidas, fornecedores, relatórios financeiros, comprovantes e contas múltiplas — replacing the single-file `localStorage` prototype with a real multi-device app.

**Architecture:** Next.js (App Router, TypeScript) frontend on Vercel, Supabase (Postgres + Auth + Storage) backend with Row Level Security enforcing access. `lancamentos` + `pagamentos` are the core tables; dívidas, fornecedores, and relatórios are all views/queries over them rather than separate data stores. v1 ships with a single user role (structure ready for `gerente`/`viewer` later).

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Supabase CLI for local dev/migrations, Vitest for unit tests.

> **Environment note (added after Task 1):** This machine has no Docker, Homebrew, or Supabase CLI, so the local-dev workflow described in Tasks 2–4 and 11 (`supabase start`, `supabase db reset`) is not available. Instead, development targets a real hosted Supabase **Free-tier** project ("Financeiro GM Informatica", ref `wutwfdouywylumywwxrm`) created directly via the Supabase dashboard. Its URL and API keys go straight into `.env.local` — no local Postgres instance. Wherever a task says to run a migration via `supabase db reset`, apply it instead by pasting the migration SQL into the project's **SQL Editor** in the Supabase dashboard (the controller coordinates this with the user directly, since it requires a manual paste). This is a deliberate stopgap: the store owner found the ~US$10/month compute cost too high to commit to before client approval, so this free project is for build-and-demo purposes. Once approved, the plan is to hand the finished project off to the client's own Supabase/Vercel accounts (their own billing, not the agency's) — Task 19 will need re-scoping at that point rather than following its current "push migrations to a production project we own" framing.

**Reference spec:** `docs/superpowers/specs/2026-08-04-sistema-financeiro-loja-design.md`

---

## File Structure

```
supabase/
  migrations/
    0001_schema.sql
    0002_rls.sql
    0003_seed_categorias.sql
    0004_profile_trigger.sql
    0005_storage_comprovantes.sql
lib/
  supabase/
    client.ts          # browser Supabase client
    server.ts           # server component / server action Supabase client
  calculations.ts       # pure functions: totalPago, saldo, status, valorLiquido, margem
  calculations.test.ts
  format.ts              # money/date formatting helpers
  queries/
    categorias.ts
    contasFinanceiras.ts
    clientes.ts
    fornecedores.ts
    lancamentos.ts
    pagamentos.ts
    relatorios.ts
    dividas.ts
    dashboard.ts
  types.ts                # hand-written row types matching schema
middleware.ts
app/
  login/page.tsx
  layout.tsx
  globals.css
  dashboard/page.tsx
  lancamentos/
    page.tsx
    LancamentosTable.tsx
    LancamentoModal.tsx
    PagamentoModal.tsx
    PermutaItemFields.tsx
  clientes/
    page.tsx
    [id]/page.tsx
    ClienteModal.tsx
    EquipamentoModal.tsx
  fornecedores/
    page.tsx
    FornecedorModal.tsx
  dividas/page.tsx
  relatorios/page.tsx
  contas/
    page.tsx
    ContaModal.tsx
  components/
    Kpi.tsx
    StatusTag.tsx
    Modal.tsx
```

Each `app/<modulo>/page.tsx` is a Server Component that fetches via `lib/queries/*` and renders a client component for interactivity. Business calculations never live inside components — they call `lib/calculations.ts` so they stay independently testable.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create the Next.js app**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --no-turbopack
```
Accept defaults when prompted. This scaffolds `package.json`, `app/`, `tailwind.config.ts`, `tsconfig.json`.

- [ ] **Step 2: Install runtime and dev dependencies**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest @vitejs/plugin-react jsdom
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

Add to `package.json` `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Set the dark, high-contrast theme tokens**

Replace `app/globals.css` contents with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg: #0B0F14;
  --surface: #151B23;
  --surface-2: #1F2937;
  --border: #2A3441;
  --text: #E5E7EB;
  --text-dim: #9CA3AF;
  --accent-green: #34D399;
  --accent-red: #F87171;
  --accent-amber: #FBBF24;
  --accent-blue: #60A5FA;
}

body {
  background: var(--bg);
  color: var(--text);
}
```

- [ ] **Step 5: Verify the app boots**

Run: `npm run dev`
Expected: server starts on `http://localhost:3000`, default Next.js page loads with dark background (from `body` styles). Stop the server with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind and Vitest"
```

---

### Task 2: Supabase project connection and client helpers

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `.env.local`, `.env.local.example`

- [ ] **Step 1: Store the hosted project's credentials**

A Supabase Free-tier project ("Financeiro GM Informatica", ref `wutwfdouywylumywwxrm`) already exists — created directly via the Supabase dashboard (no CLI/Docker available in this environment; see the environment note at the top of this plan). Its URL and keys were provided by the project owner.

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://wutwfdouywylumywwxrm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon/public key provided>
SUPABASE_SERVICE_ROLE_KEY=<the service_role key provided>
```

Create `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 2: Browser Supabase client**

Create `lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Server Supabase client**

Create `lib/supabase/server.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component with no request context; middleware refreshes sessions instead
          }
        },
      },
    }
  );
}
```

- [ ] **Step 4: Verify the hosted project is reachable**

Run:
```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" "https://wutwfdouywylumywwxrm.supabase.co/rest/v1/" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```
Expected: `HTTP 200`. (The same request with the anon key correctly returns 401 with "Only the service_role API key can be used for this endpoint" — that's expected Supabase platform behavior for the root introspection endpoint, not a misconfiguration.)

- [ ] **Step 5: Commit**

```bash
git add lib/supabase .env.local.example .gitignore
git commit -m "chore: add Supabase project connection and client helpers"
```
(`.env.local` stays untracked — it's already covered by `.gitignore`.)

---

### Task 3: Database schema and RLS migrations

**Files:**
- Create: `supabase/migrations/0001_schema.sql`
- Create: `supabase/migrations/0002_rls.sql`

- [ ] **Step 1: Write the schema migration**

Create `supabase/migrations/0001_schema.sql`:
```sql
create extension if not exists "pgcrypto";

create type papel_usuario as enum ('dono', 'gerente', 'viewer');
create type tipo_lancamento as enum ('despesa', 'receita');
create type frente_negocio as enum ('pecas_acessorios', 'computadores', 'assistencia_tecnica', 'outros');
create type forma_pagamento as enum ('pix','dinheiro','boleto','transferencia','cartao_credito','cartao_debito','permuta');
create type status_item_permuta as enum ('em_estoque','revendido','usado_em_conserto','descartado');
create type classificacao_cliente as enum ('padrao','vip','recorrente','inadimplente');
create type tipo_conta_financeira as enum ('caixa','banco','cartao');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  papel papel_usuario not null default 'dono',
  created_at timestamptz not null default now()
);

create table contas_financeiras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo tipo_conta_financeira not null default 'caixa',
  saldo_inicial numeric(12,2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  grupo_dre text not null,
  frente_negocio frente_negocio,
  created_at timestamptz not null default now()
);

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  contato text,
  documento text,
  classificacao classificacao_cliente not null default 'padrao',
  observacao text,
  created_at timestamptz not null default now()
);

create table equipamentos_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  tipo text not null,
  marca_modelo text,
  numero_serie text,
  observacao text,
  created_at timestamptz not null default now()
);

create table fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  contato text,
  documento text,
  tipo text,
  observacao text,
  created_at timestamptz not null default now()
);

create table lancamentos (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  tipo tipo_lancamento not null default 'despesa',
  categoria_id uuid references categorias(id) on delete set null,
  cliente_id uuid references clientes(id) on delete set null,
  fornecedor_id uuid references fornecedores(id) on delete set null,
  conta_financeira_id uuid references contas_financeiras(id) on delete set null,
  equipamento_id uuid references equipamentos_cliente(id) on delete set null,
  valor numeric(12,2) not null default 0,
  custo numeric(12,2),
  vencimento date,
  competencia text,
  recorrencia text,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid not null references lancamentos(id) on delete cascade,
  valor numeric(12,2) not null check (valor > 0),
  taxa numeric(12,2),
  valor_liquido numeric(12,2) generated always as (valor - coalesce(taxa,0)) stored,
  forma_pagamento forma_pagamento,
  data_pagamento date not null,
  comprovante_url text,
  observacao text,
  created_at timestamptz not null default now()
);

create table itens_permuta (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid not null references pagamentos(id) on delete cascade,
  descricao text not null,
  valor_estimado numeric(12,2),
  status status_item_permuta not null default 'em_estoque',
  observacao text,
  created_at timestamptz not null default now()
);

create index idx_lancamentos_vencimento on lancamentos(vencimento);
create index idx_lancamentos_cliente on lancamentos(cliente_id);
create index idx_lancamentos_fornecedor on lancamentos(fornecedor_id);
create index idx_lancamentos_categoria on lancamentos(categoria_id);
create index idx_pagamentos_lancamento on pagamentos(lancamento_id);
create index idx_pagamentos_data on pagamentos(data_pagamento);
create index idx_equipamentos_cliente on equipamentos_cliente(cliente_id);
```

- [ ] **Step 2: Apply the schema migration**

Run: `supabase db reset`
Expected: output ends with `Applying migration 0001_schema.sql...` and no errors. This replays all migrations against the local database.

- [ ] **Step 3: Write the RLS migration**

Create `supabase/migrations/0002_rls.sql`:
```sql
alter table profiles enable row level security;
alter table contas_financeiras enable row level security;
alter table categorias enable row level security;
alter table clientes enable row level security;
alter table equipamentos_cliente enable row level security;
alter table fornecedores enable row level security;
alter table lancamentos enable row level security;
alter table pagamentos enable row level security;
alter table itens_permuta enable row level security;

create policy "profiles: usuário vê e edita o próprio perfil"
  on profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

-- v1: qualquer usuário autenticado tem acesso completo. A checagem
-- "existe um profile para este uid" é o que distingue "autenticado da loja"
-- de "qualquer usuário do projeto Supabase" — importante se o projeto for
-- reaproveitado por outros apps no futuro. Papel (`gerente`/`viewer`) fica
-- pronto para restringir ação por ação quando for necessário.
create policy "contas_financeiras: acesso completo para usuário com perfil"
  on contas_financeiras for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy "categorias: acesso completo para usuário com perfil"
  on categorias for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy "clientes: acesso completo para usuário com perfil"
  on clientes for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy "equipamentos_cliente: acesso completo para usuário com perfil"
  on equipamentos_cliente for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy "fornecedores: acesso completo para usuário com perfil"
  on fornecedores for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy "lancamentos: acesso completo para usuário com perfil"
  on lancamentos for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy "pagamentos: acesso completo para usuário com perfil"
  on pagamentos for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy "itens_permuta: acesso completo para usuário com perfil"
  on itens_permuta for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));
```

- [ ] **Step 4: Apply and verify RLS**

Run: `supabase db reset`
Expected: no errors. Then verify RLS is on by querying as the anonymous role:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "set role anon; select * from lancamentos;"
```
Expected: `0 rows` returned (not an error) — RLS silently filters everything for a role with no matching profile.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations
git commit -m "feat: add core schema and RLS policies"
```

---

### Task 4: Seed categorias, profile trigger, and auth

**Files:**
- Create: `supabase/migrations/0003_seed_categorias.sql`
- Create: `supabase/migrations/0004_profile_trigger.sql`
- Create: `middleware.ts`
- Create: `app/login/page.tsx`
- Create: `app/login/actions.ts`

- [ ] **Step 1: Seed default categorias**

Create `supabase/migrations/0003_seed_categorias.sql`:
```sql
insert into categorias (nome, grupo_dre, frente_negocio) values
  ('Venda de Peças e Acessórios', 'Receita Bruta', 'pecas_acessorios'),
  ('Venda de Computadores', 'Receita Bruta', 'computadores'),
  ('Assistência Técnica', 'Receita Bruta', 'assistencia_tecnica'),
  ('Fornecedores', 'Custo de Produtos e Serviços', null),
  ('Pessoal', 'Despesas Administrativas', null),
  ('Ocupação', 'Despesas Administrativas', null),
  ('Utilidades', 'Despesas Administrativas', null),
  ('Marketing', 'Despesas Comerciais', null),
  ('Impostos', 'Despesas Tributárias', null),
  ('Empréstimos e Financiamentos', 'Despesas Financeiras', null),
  ('Outros', 'Outras Receitas e Despesas', null);
```

- [ ] **Step 2: Auto-create a profile on signup**

Create `supabase/migrations/0004_profile_trigger.sql`:
```sql
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nome, papel)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), 'dono');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 3: Apply migrations**

Run: `supabase db reset`
Expected: no errors; `select * from categorias;` via Studio shows 11 rows.

- [ ] **Step 4: Create the first user**

Run:
```bash
supabase status
```
Open Studio (`http://127.0.0.1:54323`) → Authentication → Add user → create an email/password user for yourself. Confirm in the `profiles` table (Table Editor) that a row was auto-created with `papel = dono`.

- [ ] **Step 5: Session-refresh middleware**

Create `middleware.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 6: Login server action**

Create `app/login/actions.ts`:
```typescript
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    redirect(`/login?erro=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}
```

- [ ] **Step 7: Login page**

Create `app/login/page.tsx`:
```tsx
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <form
        action={login}
        className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-8 w-full max-w-sm"
      >
        <h1 className="text-xl font-semibold mb-6">Loja de Informática</h1>
        {erro && (
          <p className="text-[var(--accent-red)] text-sm mb-4">{erro}</p>
        )}
        <label className="block text-sm text-[var(--text-dim)] mb-1">
          E-mail
        </label>
        <input
          name="email"
          type="email"
          required
          className="w-full mb-4 px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
        />
        <label className="block text-sm text-[var(--text-dim)] mb-1">
          Senha
        </label>
        <input
          name="password"
          type="password"
          required
          className="w-full mb-6 px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
        />
        <button
          type="submit"
          className="w-full bg-[var(--accent-blue)] text-[var(--bg)] font-semibold py-2 rounded"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 8: Verify login flow**

Run: `npm run dev`, open `http://localhost:3000/dashboard`.
Expected: redirected to `/login` (no `dashboard` page exists yet, but the redirect itself proves the middleware works — a 404 after `/login` submits is fine at this stage). Log in with the user created in Step 4.
Expected: redirected to `/dashboard`, which 404s (page not built yet) — confirms auth succeeded since middleware let the request through.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations middleware.ts app/login
git commit -m "feat: add categorias seed, profile trigger, and auth"
```

---

### Task 5: Business logic — `lib/calculations.ts` (TDD)

**Files:**
- Create: `lib/calculations.ts`
- Test: `lib/calculations.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/calculations.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  totalPago,
  saldo,
  status,
  valorLiquido,
  margem,
  round2,
  type Lancamento,
  type Pagamento,
} from "./calculations";

const lancamento: Lancamento = {
  id: "l1",
  tipo: "despesa",
  valor: 100,
  custo: null,
  vencimento: "2026-08-10",
};

describe("round2", () => {
  it("rounds to two decimal places", () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(10.001)).toBe(10);
  });
});

describe("totalPago", () => {
  it("sums only payments for the given lancamento", () => {
    const pagamentos: Pagamento[] = [
      { id: "p1", lancamento_id: "l1", valor: 40, taxa: null, valor_liquido: 40, data_pagamento: "2026-08-01" },
      { id: "p2", lancamento_id: "l1", valor: 20, taxa: null, valor_liquido: 20, data_pagamento: "2026-08-02" },
      { id: "p3", lancamento_id: "outro", valor: 999, taxa: null, valor_liquido: 999, data_pagamento: "2026-08-02" },
    ];
    expect(totalPago(pagamentos, "l1")).toBe(60);
  });

  it("returns 0 when there are no payments", () => {
    expect(totalPago([], "l1")).toBe(0);
  });
});

describe("saldo", () => {
  it("subtracts total paid from the lancamento value", () => {
    const pagamentos: Pagamento[] = [
      { id: "p1", lancamento_id: "l1", valor: 40, taxa: null, valor_liquido: 40, data_pagamento: "2026-08-01" },
    ];
    expect(saldo(lancamento, pagamentos)).toBe(60);
  });
});

describe("status", () => {
  it("is quitado when fully paid", () => {
    const pagamentos: Pagamento[] = [
      { id: "p1", lancamento_id: "l1", valor: 100, taxa: null, valor_liquido: 100, data_pagamento: "2026-08-01" },
    ];
    expect(status(lancamento, pagamentos, "2026-08-04")).toBe("quitado");
  });

  it("is atrasado when overdue and unpaid", () => {
    expect(status(lancamento, [], "2026-08-11")).toBe("atrasado");
  });

  it("is parcial when partially paid and not yet due", () => {
    const futureLancamento: Lancamento = { ...lancamento, vencimento: "2026-09-01" };
    const pagamentos: Pagamento[] = [
      { id: "p1", lancamento_id: "l1", valor: 40, taxa: null, valor_liquido: 40, data_pagamento: "2026-08-01" },
    ];
    expect(status(futureLancamento, pagamentos, "2026-08-04")).toBe("parcial");
  });

  it("is aberto when unpaid and not yet due", () => {
    const futureLancamento: Lancamento = { ...lancamento, vencimento: "2026-09-01" };
    expect(status(futureLancamento, [], "2026-08-04")).toBe("aberto");
  });
});

describe("valorLiquido", () => {
  it("subtracts the fee when informed", () => {
    expect(valorLiquido(100, 3.5)).toBe(96.5);
  });

  it("equals the paid value when no fee is informed", () => {
    expect(valorLiquido(100, null)).toBe(100);
  });
});

describe("margem", () => {
  it("is null when cost is not informed", () => {
    expect(margem(lancamento)).toBeNull();
  });

  it("is valor minus custo when informed", () => {
    expect(margem({ ...lancamento, custo: 30 })).toBe(70);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm run test`
Expected: FAIL — `Cannot find module './calculations'` (file doesn't exist yet).

- [ ] **Step 3: Implement `lib/calculations.ts`**

Create `lib/calculations.ts`:
```typescript
export type Lancamento = {
  id: string;
  tipo: "despesa" | "receita";
  valor: number;
  custo: number | null;
  vencimento: string | null; // ISO date, YYYY-MM-DD
};

export type Pagamento = {
  id: string;
  lancamento_id: string;
  valor: number;
  taxa: number | null;
  valor_liquido: number;
  data_pagamento: string;
};

export type StatusLancamento = "atrasado" | "aberto" | "parcial" | "quitado";

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function totalPago(pagamentos: Pagamento[], lancamentoId: string): number {
  return round2(
    pagamentos
      .filter((p) => p.lancamento_id === lancamentoId)
      .reduce((acc, p) => acc + p.valor, 0)
  );
}

export function saldo(lancamento: Lancamento, pagamentos: Pagamento[]): number {
  return round2(lancamento.valor - totalPago(pagamentos, lancamento.id));
}

export function status(
  lancamento: Lancamento,
  pagamentos: Pagamento[],
  hoje: string
): StatusLancamento {
  const pago = totalPago(pagamentos, lancamento.id);
  const restante = saldo(lancamento, pagamentos);
  if (lancamento.valor > 0 && restante <= 0.004) return "quitado";
  if (lancamento.vencimento && lancamento.vencimento < hoje) return "atrasado";
  if (pago > 0) return "parcial";
  return "aberto";
}

export function valorLiquido(valor: number, taxa: number | null): number {
  return round2(valor - (taxa ?? 0));
}

export function margem(lancamento: Lancamento): number | null {
  if (lancamento.custo == null) return null;
  return round2(lancamento.valor - lancamento.custo);
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm run test`
Expected: PASS — all 10 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/calculations.ts lib/calculations.test.ts
git commit -m "feat: add lancamento business logic with unit tests"
```

---

### Task 6: Data layer — lançamentos and pagamentos queries

**Files:**
- Create: `lib/types.ts`
- Create: `lib/format.ts`
- Create: `lib/queries/lancamentos.ts`
- Create: `lib/queries/pagamentos.ts`

- [ ] **Step 1: Shared row types**

Create `lib/types.ts`:
```typescript
export type Categoria = {
  id: string;
  nome: string;
  grupo_dre: string;
  frente_negocio: "pecas_acessorios" | "computadores" | "assistencia_tecnica" | "outros" | null;
};

export type Cliente = {
  id: string;
  nome: string;
  contato: string | null;
  documento: string | null;
  classificacao: "padrao" | "vip" | "recorrente" | "inadimplente";
  observacao: string | null;
};

export type Fornecedor = {
  id: string;
  nome: string;
  contato: string | null;
  documento: string | null;
  tipo: string | null;
};

export type ContaFinanceira = {
  id: string;
  nome: string;
  tipo: "caixa" | "banco" | "cartao";
  saldo_inicial: number;
  ativo: boolean;
};

export type LancamentoRow = {
  id: string;
  descricao: string;
  tipo: "despesa" | "receita";
  categoria_id: string | null;
  cliente_id: string | null;
  fornecedor_id: string | null;
  conta_financeira_id: string | null;
  equipamento_id: string | null;
  valor: number;
  custo: number | null;
  vencimento: string | null;
  competencia: string | null;
  recorrencia: string | null;
  observacao: string | null;
};

export type PagamentoRow = {
  id: string;
  lancamento_id: string;
  valor: number;
  taxa: number | null;
  valor_liquido: number;
  forma_pagamento: string | null;
  data_pagamento: string;
  comprovante_url: string | null;
  observacao: string | null;
};
```

- [ ] **Step 2: Formatting helpers**

Create `lib/format.ts`:
```typescript
export function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function money(n: number | null | undefined): string {
  return brl.format(n ?? 0);
}

export function formatDataBR(iso: string | null): string {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
```

- [ ] **Step 3: Lançamentos queries**

Create `lib/queries/lancamentos.ts`:
```typescript
import { createClient } from "@/lib/supabase/server";
import type { LancamentoRow } from "@/lib/types";

export async function listarLancamentos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lancamentos")
    .select("*")
    .order("vencimento", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data as LancamentoRow[];
}

export async function criarLancamento(
  input: Omit<LancamentoRow, "id">
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lancamentos")
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as LancamentoRow;
}

export async function atualizarLancamento(
  id: string,
  input: Partial<Omit<LancamentoRow, "id">>
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lancamentos")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as LancamentoRow;
}

export async function excluirLancamento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").delete().eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 4: Pagamentos queries**

Create `lib/queries/pagamentos.ts`:
```typescript
import { createClient } from "@/lib/supabase/server";
import type { PagamentoRow } from "@/lib/types";

export async function listarPagamentos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagamentos")
    .select("*")
    .order("data_pagamento", { ascending: false });

  if (error) throw error;
  return data as PagamentoRow[];
}

export async function registrarPagamento(input: {
  lancamento_id: string;
  valor: number;
  taxa: number | null;
  forma_pagamento: string | null;
  data_pagamento: string;
  comprovante_url: string | null;
  observacao: string | null;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagamentos")
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as PagamentoRow;
}

export async function estornarPagamento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pagamentos").delete().eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 5: Manual verification against local Supabase**

With `npm run dev` running and logged in (Task 4), temporarily call `criarLancamento` and `registrarPagamento` from a scratch script:
Run:
```bash
npx tsx -e "
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data, error } = await supabase.from('lancamentos').insert({ descricao: 'Teste', tipo: 'despesa', valor: 50 }).select();
console.log({ data, error });
"
```
Expected: prints `{ data: [ { id: '...', descricao: 'Teste', ... } ], error: null }`. Delete the test row afterwards via Studio's Table Editor.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/format.ts lib/queries/lancamentos.ts lib/queries/pagamentos.ts
git commit -m "feat: add data layer for lancamentos and pagamentos"
```

---

### Task 7: Entradas e Saídas — list page and filters

**Files:**
- Create: `app/lancamentos/page.tsx`
- Create: `app/lancamentos/LancamentosTable.tsx`
- Create: `lib/queries/categorias.ts`
- Create: `lib/queries/contasFinanceiras.ts` (read-only list used by this page's dropdowns)
- Create: `components/StatusTag.tsx`

- [ ] **Step 1: Categoria and conta list queries**

Create `lib/queries/categorias.ts`:
```typescript
import { createClient } from "@/lib/supabase/server";
import type { Categoria } from "@/lib/types";

export async function listarCategorias() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categorias").select("*").order("nome");
  if (error) throw error;
  return data as Categoria[];
}
```

Create `lib/queries/contasFinanceiras.ts`:
```typescript
import { createClient } from "@/lib/supabase/server";
import type { ContaFinanceira } from "@/lib/types";

export async function listarContasFinanceiras() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contas_financeiras")
    .select("*")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return data as ContaFinanceira[];
}
```

- [ ] **Step 2: Status tag component**

Create `components/StatusTag.tsx`:
```tsx
import type { StatusLancamento } from "@/lib/calculations";

const LABEL: Record<StatusLancamento, string> = {
  atrasado: "Atrasada",
  aberto: "Em aberto",
  parcial: "Parcial",
  quitado: "Quitada",
};

const COLOR: Record<StatusLancamento, string> = {
  atrasado: "bg-red-950 text-[var(--accent-red)]",
  aberto: "bg-blue-950 text-[var(--accent-blue)]",
  parcial: "bg-amber-950 text-[var(--accent-amber)]",
  quitado: "bg-emerald-950 text-[var(--accent-green)]",
};

export function StatusTag({ status }: { status: StatusLancamento }) {
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${COLOR[status]}`}>
      {LABEL[status]}
    </span>
  );
}
```

- [ ] **Step 3: Table client component**

Create `app/lancamentos/LancamentosTable.tsx`:
```tsx
"use client";

import { useMemo, useState } from "react";
import { StatusTag } from "@/components/StatusTag";
import { saldo, status as calcStatus, totalPago } from "@/lib/calculations";
import { money, formatDataBR, hoje } from "@/lib/format";
import type { LancamentoRow, PagamentoRow, Categoria } from "@/lib/types";

export function LancamentosTable({
  lancamentos,
  pagamentos,
  categorias,
}: {
  lancamentos: LancamentoRow[];
  pagamentos: PagamentoRow[];
  categorias: Categoria[];
}) {
  const [filtroStatus, setFiltroStatus] = useState<"pendentes" | "atrasado" | "quitado" | "todos">(
    "pendentes"
  );
  const [busca, setBusca] = useState("");
  const hojeStr = hoje();

  const nomeCategoria = (id: string | null) =>
    categorias.find((c) => c.id === id)?.nome ?? "—";

  const linhas = useMemo(() => {
    return lancamentos
      .map((l) => ({
        lancamento: l,
        status: calcStatus(l, pagamentos, hojeStr),
        pago: totalPago(pagamentos, l.id),
        falta: saldo(l, pagamentos),
      }))
      .filter((row) => {
        if (filtroStatus === "pendentes") return row.status !== "quitado";
        if (filtroStatus === "atrasado") return row.status === "atrasado";
        if (filtroStatus === "quitado") return row.status === "quitado";
        return true;
      })
      .filter((row) =>
        busca ? row.lancamento.descricao.toLowerCase().includes(busca.toLowerCase()) : true
      );
  }, [lancamentos, pagamentos, filtroStatus, busca, hojeStr]);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(["pendentes", "atrasado", "quitado", "todos"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltroStatus(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold border border-[var(--border)] ${
              filtroStatus === f ? "bg-[var(--accent-blue)] text-[var(--bg)]" : "text-[var(--text-dim)]"
            }`}
          >
            {f === "pendentes" ? "Pendentes" : f === "atrasado" ? "Atrasadas" : f === "quitado" ? "Quitadas" : "Todas"}
          </button>
        ))}
        <input
          placeholder="Buscar por descrição"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="ml-auto px-3 py-1.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-sm"
        />
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-[var(--text-dim)] text-xs uppercase border-b border-[var(--border)]">
            <th className="py-2">Vencimento</th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>Situação</th>
            <th className="text-right">Valor</th>
            <th className="text-right">Falta</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ lancamento, status, falta }) => (
            <tr key={lancamento.id} className="border-b border-[var(--border)]">
              <td className="py-2">{formatDataBR(lancamento.vencimento)}</td>
              <td className="font-medium">{lancamento.descricao}</td>
              <td className="text-[var(--text-dim)]">{nomeCategoria(lancamento.categoria_id)}</td>
              <td>
                <StatusTag status={status} />
              </td>
              <td className="text-right">{money(lancamento.valor)}</td>
              <td className="text-right font-semibold text-[var(--accent-red)]">{money(falta)}</td>
            </tr>
          ))}
          {linhas.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-[var(--text-dim)]">
                Nenhum lançamento com esses filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Page**

Create `app/lancamentos/page.tsx`:
```tsx
import { listarLancamentos } from "@/lib/queries/lancamentos";
import { listarPagamentos } from "@/lib/queries/pagamentos";
import { listarCategorias } from "@/lib/queries/categorias";
import { LancamentosTable } from "./LancamentosTable";

export default async function LancamentosPage() {
  const [lancamentos, pagamentos, categorias] = await Promise.all([
    listarLancamentos(),
    listarPagamentos(),
    listarCategorias(),
  ]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Entradas e Saídas</h1>
      <LancamentosTable lancamentos={lancamentos} pagamentos={pagamentos} categorias={categorias} />
    </div>
  );
}
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, log in, open `http://localhost:3000/lancamentos`.
Expected: page renders with filter chips and an empty-state table ("Nenhum lançamento com esses filtros."). Insert a test row via Studio Table Editor (`descricao: 'Conta de luz'`, `tipo: 'despesa'`, `valor: 150`, `vencimento` = a past date) → refresh the page → row appears tagged "Atrasada" in red.

- [ ] **Step 6: Commit**

```bash
git add app/lancamentos lib/queries/categorias.ts lib/queries/contasFinanceiras.ts components/StatusTag.tsx
git commit -m "feat: add entradas e saidas list page"
```

---

### Task 8: Modal — novo/editar lançamento

**Files:**
- Create: `components/Modal.tsx`
- Create: `app/lancamentos/actions.ts`
- Create: `app/lancamentos/LancamentoModal.tsx`
- Modify: `app/lancamentos/LancamentosTable.tsx:1-` (add "open modal" trigger)

- [ ] **Step 1: Generic modal shell**

Create `components/Modal.tsx`:
```tsx
"use client";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-start justify-center p-6 overflow-auto z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[var(--surface)] border-t-4 border-[var(--accent-blue)] rounded-lg w-full max-w-lg">
        <div className="p-5 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Server actions for create/update/delete**

Create `app/lancamentos/actions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import {
  criarLancamento,
  atualizarLancamento,
  excluirLancamento,
} from "@/lib/queries/lancamentos";

export async function salvarLancamentoAction(formData: FormData) {
  const id = formData.get("id") as string | null;

  const input = {
    descricao: formData.get("descricao") as string,
    tipo: formData.get("tipo") as "despesa" | "receita",
    categoria_id: (formData.get("categoria_id") as string) || null,
    cliente_id: null,
    fornecedor_id: null,
    conta_financeira_id: (formData.get("conta_financeira_id") as string) || null,
    equipamento_id: null,
    valor: Number(formData.get("valor")),
    custo: formData.get("custo") ? Number(formData.get("custo")) : null,
    vencimento: (formData.get("vencimento") as string) || null,
    competencia: (formData.get("vencimento") as string)?.slice(0, 7) || null,
    recorrencia: null,
    observacao: (formData.get("observacao") as string) || null,
  };

  if (id) {
    await atualizarLancamento(id, input);
  } else {
    await criarLancamento(input);
  }

  revalidatePath("/lancamentos");
}

export async function excluirLancamentoAction(id: string) {
  await excluirLancamento(id);
  revalidatePath("/lancamentos");
}
```

- [ ] **Step 3: Modal component**

Create `app/lancamentos/LancamentoModal.tsx`:
```tsx
"use client";

import { useRef } from "react";
import { Modal } from "@/components/Modal";
import { salvarLancamentoAction, excluirLancamentoAction } from "./actions";
import type { Categoria, LancamentoRow } from "@/lib/types";

export function LancamentoModal({
  open,
  onClose,
  lancamento,
  categorias,
}: {
  open: boolean;
  onClose: () => void;
  lancamento: LancamentoRow | null;
  categorias: Categoria[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Modal open={open} onClose={onClose} title={lancamento ? "Editar lançamento" : "Novo lançamento"}>
      <form
        ref={formRef}
        action={async (formData) => {
          await salvarLancamentoAction(formData);
          onClose();
        }}
        className="grid grid-cols-2 gap-3"
      >
        {lancamento && <input type="hidden" name="id" value={lancamento.id} />}

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Descrição</label>
          <input
            name="descricao"
            defaultValue={lancamento?.descricao}
            required
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Tipo</label>
          <select
            name="tipo"
            defaultValue={lancamento?.tipo ?? "despesa"}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            <option value="despesa">Saída (conta a pagar)</option>
            <option value="receita">Entrada (a receber)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Categoria</label>
          <select
            name="categoria_id"
            defaultValue={lancamento?.categoria_id ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            <option value="">Selecione</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Vencimento</label>
          <input
            type="date"
            name="vencimento"
            defaultValue={lancamento?.vencimento ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            name="valor"
            defaultValue={lancamento?.valor}
            required
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Custo/CMV (opcional)</label>
          <input
            type="number"
            step="0.01"
            name="custo"
            defaultValue={lancamento?.custo ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Observação</label>
          <input
            name="observacao"
            defaultValue={lancamento?.observacao ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div className="col-span-2 flex justify-between mt-2">
          {lancamento ? (
            <button
              type="button"
              onClick={async () => {
                await excluirLancamentoAction(lancamento.id);
                onClose();
              }}
              className="text-[var(--accent-red)] text-sm font-semibold"
            >
              Excluir lançamento
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded">
              Salvar
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 4: Wire the modal into the table (new + edit triggers)**

Modify `app/lancamentos/LancamentosTable.tsx` — add state and a row click handler. Insert after the `const [busca, setBusca] = useState("");` line:
```typescript
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<LancamentoRow | null>(null);
```

Replace the opening `<div>` return wrapper's toolbar `<div className="flex gap-2 mb-4">` block to add a "+ Novo lançamento" button — change:
```tsx
        <input
          placeholder="Buscar por descrição"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="ml-auto px-3 py-1.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-sm"
        />
```
to:
```tsx
        <input
          placeholder="Buscar por descrição"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="px-3 py-1.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-sm"
        />
        <button
          onClick={() => {
            setEditando(null);
            setModalOpen(true);
          }}
          className="ml-auto px-4 py-1.5 rounded bg-[var(--accent-blue)] text-[var(--bg)] text-sm font-semibold"
        >
          + Novo lançamento
        </button>
```

Make each row clickable — change the `<tr key={lancamento.id} className="border-b border-[var(--border)]">` line to:
```tsx
            <tr
              key={lancamento.id}
              onClick={() => {
                setEditando(lancamento);
                setModalOpen(true);
              }}
              className="border-b border-[var(--border)] cursor-pointer hover:bg-[var(--surface-2)]"
            >
```

Add the modal render at the end of the returned JSX, right before the closing `</div>` of the component:
```tsx
      <LancamentoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        lancamento={editando}
        categorias={categorias}
      />
```

Add the import at the top of the file:
```typescript
import { LancamentoModal } from "./LancamentoModal";
import type { LancamentoRow, PagamentoRow, Categoria } from "@/lib/types";
```
(this replaces the existing type-only import line already at the top of the file).

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open `/lancamentos`, click "+ Novo lançamento", fill in "Compra de parafusos", tipo Saída, valor 25, salvar.
Expected: modal closes, new row appears in the table. Click the row → modal reopens pre-filled → click "Excluir lançamento" → row disappears.

- [ ] **Step 6: Commit**

```bash
git add components/Modal.tsx app/lancamentos
git commit -m "feat: add create/edit/delete modal for lancamentos"
```

---

### Task 9: Modal — registrar pagamento (forma + taxa + valor líquido)

**Files:**
- Create: `app/lancamentos/pagamentoActions.ts`
- Create: `app/lancamentos/PagamentoModal.tsx`
- Modify: `app/lancamentos/LancamentosTable.tsx` (add "Pagar" button per row)

- [ ] **Step 1: Server action to register a payment**

Create `app/lancamentos/pagamentoActions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { registrarPagamento, estornarPagamento } from "@/lib/queries/pagamentos";

export async function registrarPagamentoAction(formData: FormData) {
  const taxaRaw = formData.get("taxa") as string;

  await registrarPagamento({
    lancamento_id: formData.get("lancamento_id") as string,
    valor: Number(formData.get("valor")),
    taxa: taxaRaw ? Number(taxaRaw) : null,
    forma_pagamento: (formData.get("forma_pagamento") as string) || null,
    data_pagamento: formData.get("data_pagamento") as string,
    comprovante_url: null,
    observacao: null,
  });

  revalidatePath("/lancamentos");
}

export async function estornarPagamentoAction(id: string) {
  await estornarPagamento(id);
  revalidatePath("/lancamentos");
}
```

- [ ] **Step 2: Payment modal with live valor líquido preview**

Create `app/lancamentos/PagamentoModal.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { registrarPagamentoAction } from "./pagamentoActions";
import { valorLiquido } from "@/lib/calculations";
import { money, hoje } from "@/lib/format";
import type { LancamentoRow } from "@/lib/types";

export function PagamentoModal({
  open,
  onClose,
  lancamento,
  falta,
}: {
  open: boolean;
  onClose: () => void;
  lancamento: LancamentoRow | null;
  falta: number;
}) {
  const [valor, setValor] = useState(0);
  const [taxa, setTaxa] = useState<number | "">("");

  if (!lancamento) return null;

  return (
    <Modal open={open} onClose={onClose} title="Registrar pagamento">
      <form
        action={async (formData) => {
          await registrarPagamentoAction(formData);
          onClose();
        }}
        className="grid grid-cols-2 gap-3"
      >
        <input type="hidden" name="lancamento_id" value={lancamento.id} />
        <p className="col-span-2 text-sm text-[var(--text-dim)]">
          {lancamento.descricao} · falta {money(falta)}
        </p>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Valor pago (R$)</label>
          <input
            type="number"
            step="0.01"
            name="valor"
            defaultValue={falta}
            onChange={(e) => setValor(Number(e.target.value))}
            required
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Data</label>
          <input
            type="date"
            name="data_pagamento"
            defaultValue={hoje()}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Forma de pagamento</label>
          <select
            name="forma_pagamento"
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            <option value="">Não informada</option>
            <option value="pix">Pix</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="boleto">Boleto</option>
            <option value="transferencia">Transferência</option>
            <option value="cartao_credito">Cartão de crédito</option>
            <option value="cartao_debito">Cartão de débito</option>
            <option value="permuta">Permuta</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Taxa paga (opcional)</label>
          <input
            type="number"
            step="0.01"
            name="taxa"
            onChange={(e) => setTaxa(e.target.value ? Number(e.target.value) : "")}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
          <p className="text-xs text-[var(--text-dim)] mt-1">
            Valor líquido: {money(valorLiquido(valor || 0, taxa === "" ? null : taxa))}
          </p>
        </div>

        <div className="col-span-2 flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded">
            Cancelar
          </button>
          <button type="submit" className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded">
            Registrar
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 3: Add "Pagar" trigger to the table**

Modify `app/lancamentos/LancamentosTable.tsx`. Add state below the existing `editando` state:
```typescript
  const [pagando, setPagando] = useState<{ lancamento: LancamentoRow; falta: number } | null>(null);
```

Add a new last column to the `<thead>` row, after the `<th className="text-right">Falta</th>` line:
```tsx
            <th></th>
```

Add a matching cell in the `<tbody>` row, after the `<td className="text-right font-semibold text-[var(--accent-red)]">{money(falta)}</td>` line:
```tsx
              <td className="text-right">
                {falta > 0.004 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPagando({ lancamento, falta });
                    }}
                    className="px-3 py-1 text-xs bg-[var(--accent-green)] text-[var(--bg)] font-semibold rounded"
                  >
                    Pagar
                  </button>
                )}
              </td>
```

Add the modal render next to the existing `<LancamentoModal ... />` element:
```tsx
      <PagamentoModal
        open={!!pagando}
        onClose={() => setPagando(null)}
        lancamento={pagando?.lancamento ?? null}
        falta={pagando?.falta ?? 0}
      />
```

Add the import:
```typescript
import { PagamentoModal } from "./PagamentoModal";
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open `/lancamentos`, click "Pagar" on a row with a balance, choose "Cartão de crédito", type a valor of 100 and taxa of 3.5.
Expected: preview shows "Valor líquido: R$ 96,50" before submitting. Submit → modal closes → row's "Falta" updates.

- [ ] **Step 5: Commit**

```bash
git add app/lancamentos
git commit -m "feat: add payment modal with fee and net value calculation"
```

---

### Task 10: Permutas — item recebido

**Files:**
- Create: `lib/queries/itensPermuta.ts`
- Create: `app/lancamentos/PermutaItemFields.tsx`
- Modify: `app/lancamentos/pagamentoActions.ts` (create the itens_permuta row alongside the payment)
- Modify: `app/lancamentos/PagamentoModal.tsx` (show the fields when forma = permuta)
- Create: `app/permutas/page.tsx`

- [ ] **Step 1: itens_permuta queries**

Create `lib/queries/itensPermuta.ts`:
```typescript
import { createClient } from "@/lib/supabase/server";

export type ItemPermuta = {
  id: string;
  pagamento_id: string;
  descricao: string;
  valor_estimado: number | null;
  status: "em_estoque" | "revendido" | "usado_em_conserto" | "descartado";
  observacao: string | null;
};

export async function listarItensPermuta() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("itens_permuta")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ItemPermuta[];
}

export async function criarItemPermuta(input: {
  pagamento_id: string;
  descricao: string;
  valor_estimado: number | null;
  status: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("itens_permuta").insert(input);
  if (error) throw error;
}
```

- [ ] **Step 2: Extend the payment action to create the permuta item**

Modify `app/lancamentos/pagamentoActions.ts` — replace the whole `registrarPagamentoAction` function with:
```typescript
export async function registrarPagamentoAction(formData: FormData) {
  const taxaRaw = formData.get("taxa") as string;

  const pagamento = await registrarPagamento({
    lancamento_id: formData.get("lancamento_id") as string,
    valor: Number(formData.get("valor")),
    taxa: taxaRaw ? Number(taxaRaw) : null,
    forma_pagamento: (formData.get("forma_pagamento") as string) || null,
    data_pagamento: formData.get("data_pagamento") as string,
    comprovante_url: null,
    observacao: null,
  });

  const permutaDescricao = formData.get("permuta_descricao") as string;
  if (formData.get("forma_pagamento") === "permuta" && permutaDescricao) {
    const valorEstimadoRaw = formData.get("permuta_valor_estimado") as string;
    await criarItemPermuta({
      pagamento_id: pagamento.id,
      descricao: permutaDescricao,
      valor_estimado: valorEstimadoRaw ? Number(valorEstimadoRaw) : null,
      status: "em_estoque",
    });
  }

  revalidatePath("/lancamentos");
  revalidatePath("/permutas");
}
```
Add the import at the top: `import { criarItemPermuta } from "@/lib/queries/itensPermuta";`

- [ ] **Step 3: Permuta fields component**

Create `app/lancamentos/PermutaItemFields.tsx`:
```tsx
export function PermutaItemFields() {
  return (
    <div className="col-span-2 border border-[var(--border)] rounded p-3 bg-[var(--surface-2)]">
      <p className="text-xs text-[var(--text-dim)] mb-2 uppercase tracking-wide">Item recebido em permuta</p>
      <label className="block text-xs text-[var(--text-dim)] mb-1">Descrição do item</label>
      <input
        name="permuta_descricao"
        placeholder="Ex: Notebook Dell usado"
        className="w-full mb-2 px-3 py-2 rounded bg-[var(--surface)] border border-[var(--border)]"
      />
      <label className="block text-xs text-[var(--text-dim)] mb-1">Valor estimado (R$)</label>
      <input
        type="number"
        step="0.01"
        name="permuta_valor_estimado"
        className="w-full px-3 py-2 rounded bg-[var(--surface)] border border-[var(--border)]"
      />
    </div>
  );
}
```

- [ ] **Step 4: Show the fields conditionally in the payment modal**

Modify `app/lancamentos/PagamentoModal.tsx`. Add state below `const [taxa, setTaxa] = useState<number | "">("");`:
```typescript
  const [forma, setForma] = useState("");
```

Change the forma select's opening tag from:
```tsx
          <select
            name="forma_pagamento"
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
```
to:
```tsx
          <select
            name="forma_pagamento"
            value={forma}
            onChange={(e) => setForma(e.target.value)}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
```

Add the conditional fields right after the taxa `<div>` block (before the submit buttons `<div className="col-span-2 flex justify-end gap-2 mt-2">`):
```tsx
        {forma === "permuta" && <PermutaItemFields />}
```

Add the import: `import { PermutaItemFields } from "./PermutaItemFields";`

- [ ] **Step 5: Permutas listing page**

Create `app/permutas/page.tsx`:
```tsx
import { listarItensPermuta } from "@/lib/queries/itensPermuta";
import { money } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  em_estoque: "Em estoque",
  revendido: "Revendido",
  usado_em_conserto: "Usado em conserto",
  descartado: "Descartado",
};

export default async function PermutasPage() {
  const itens = await listarItensPermuta();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Permutas</h1>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-[var(--text-dim)] text-xs uppercase border-b border-[var(--border)]">
            <th className="py-2">Item</th>
            <th>Status</th>
            <th className="text-right">Valor estimado</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr key={item.id} className="border-b border-[var(--border)]">
              <td className="py-2">{item.descricao}</td>
              <td className="text-[var(--text-dim)]">{STATUS_LABEL[item.status]}</td>
              <td className="text-right">{money(item.valor_estimado)}</td>
            </tr>
          ))}
          {itens.length === 0 && (
            <tr>
              <td colSpan={3} className="py-8 text-center text-[var(--text-dim)]">
                Nenhum item de permuta registrado ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, register a payment choosing "Permuta" as forma → the item fields appear → fill "Placa de vídeo usada", valor estimado 300 → registrar.
Expected: navigate to `/permutas` → the item appears with status "Em estoque" and R$ 300,00.

- [ ] **Step 7: Commit**

```bash
git add lib/queries/itensPermuta.ts app/lancamentos app/permutas
git commit -m "feat: add permuta item tracking"
```

---

### Task 11: Comprovantes — Supabase Storage

**Files:**
- Create: `supabase/migrations/0005_storage_comprovantes.sql`
- Create: `app/lancamentos/uploadComprovante.ts`
- Modify: `app/lancamentos/PagamentoModal.tsx` (file input + upload before submit)

- [ ] **Step 1: Storage bucket and policy**

Create `supabase/migrations/0005_storage_comprovantes.sql`:
```sql
insert into storage.buckets (id, name, public) values ('comprovantes', 'comprovantes', false)
on conflict (id) do nothing;

create policy "comprovantes: leitura para usuário com perfil"
  on storage.objects for select
  using (bucket_id = 'comprovantes' and exists (select 1 from profiles where id = auth.uid()));

create policy "comprovantes: upload para usuário com perfil"
  on storage.objects for insert
  with check (bucket_id = 'comprovantes' and exists (select 1 from profiles where id = auth.uid()));
```

- [ ] **Step 2: Apply migration**

Run: `supabase db reset`
Expected: no errors. Verify in Studio → Storage → a `comprovantes` bucket exists (marked private).

- [ ] **Step 3: Client-side upload helper**

Create `app/lancamentos/uploadComprovante.ts`:
```typescript
"use client";

import { createClient } from "@/lib/supabase/client";

export async function uploadComprovante(file: File, lancamentoId: string): Promise<string> {
  const supabase = createClient();
  const path = `${lancamentoId}/${Date.now()}-${file.name}`;

  const { error } = await supabase.storage.from("comprovantes").upload(path, file);
  if (error) throw error;

  return path;
}
```

- [ ] **Step 4: Wire the upload into the payment modal**

Modify `app/lancamentos/PagamentoModal.tsx`. Add state below `const [forma, setForma] = useState("");`:
```typescript
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
```

Add a file input after the taxa `<div>` block and before the `{forma === "permuta" && ...}` line:
```tsx
        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Comprovante (foto ou PDF)</label>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
        </div>
```

Replace the `<form>` opening tag's `action` to upload the file before calling the server action:
```tsx
      <form
        action={async (formData) => {
          setEnviando(true);
          if (arquivo) {
            const path = await uploadComprovante(arquivo, lancamento.id);
            formData.set("comprovante_path", path);
          }
          await registrarPagamentoAction(formData);
          setEnviando(false);
          onClose();
        }}
        className="grid grid-cols-2 gap-3"
      >
```

Add the import: `import { uploadComprovante } from "./uploadComprovante";`

Update the submit button to reflect the uploading state — change:
```tsx
          <button type="submit" className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded">
            Registrar
          </button>
```
to:
```tsx
          <button
            type="submit"
            disabled={enviando}
            className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded disabled:opacity-50"
          >
            {enviando ? "Enviando..." : "Registrar"}
          </button>
```

- [ ] **Step 5: Store the comprovante path on the pagamento**

Modify `app/lancamentos/pagamentoActions.ts` — change the `registrarPagamento` call's `comprovante_url` field from `null` to:
```typescript
    comprovante_url: (formData.get("comprovante_path") as string) || null,
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, register a payment attaching a small test image.
Expected: submit succeeds; check Studio → Storage → `comprovantes` bucket → a file exists under a folder named after the lançamento id. Check the `pagamentos` table → `comprovante_url` holds that same path.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations app/lancamentos
git commit -m "feat: attach payment receipts via Supabase Storage"
```

---

### Task 12: Clientes — data layer (CRUD, equipamentos, LTV)

**Files:**
- Create: `lib/queries/clientes.ts`
- Create: `lib/queries/equipamentos.ts`
- Create: `lib/ltv.ts`
- Test: `lib/ltv.test.ts`

- [ ] **Step 1: Write the failing LTV test**

Create `lib/ltv.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { metricasCliente } from "./ltv";
import type { LancamentoRow, PagamentoRow } from "./types";

const lancamentos: LancamentoRow[] = [
  { id: "l1", descricao: "Conserto 1", tipo: "receita", categoria_id: null, cliente_id: "c1", fornecedor_id: null, conta_financeira_id: null, equipamento_id: null, valor: 200, custo: null, vencimento: "2026-06-01", competencia: "2026-06", recorrencia: null, observacao: null },
  { id: "l2", descricao: "Conserto 2", tipo: "receita", categoria_id: null, cliente_id: "c1", fornecedor_id: null, conta_financeira_id: null, equipamento_id: null, valor: 300, custo: null, vencimento: "2026-07-01", competencia: "2026-07", recorrencia: null, observacao: null },
  { id: "l3", descricao: "Peça avulsa", tipo: "despesa", categoria_id: null, cliente_id: null, fornecedor_id: null, conta_financeira_id: null, equipamento_id: null, valor: 50, custo: null, vencimento: null, competencia: null, recorrencia: null, observacao: null },
];

const pagamentos: PagamentoRow[] = [
  { id: "p1", lancamento_id: "l1", valor: 200, taxa: null, valor_liquido: 200, forma_pagamento: "pix", data_pagamento: "2026-06-01", comprovante_url: null, observacao: null },
  { id: "p2", lancamento_id: "l2", valor: 300, taxa: null, valor_liquido: 300, forma_pagamento: "pix", data_pagamento: "2026-07-01", comprovante_url: null, observacao: null },
];

describe("metricasCliente", () => {
  it("computes LTV as the sum of paid revenue lancamentos for that client", () => {
    const m = metricasCliente("c1", lancamentos, pagamentos);
    expect(m.ltv).toBe(500);
  });

  it("computes ticket medio as LTV divided by number of paid lancamentos", () => {
    const m = metricasCliente("c1", lancamentos, pagamentos);
    expect(m.ticketMedio).toBe(250);
  });

  it("counts frequencia as the number of distinct paid lancamentos", () => {
    const m = metricasCliente("c1", lancamentos, pagamentos);
    expect(m.frequencia).toBe(2);
  });

  it("returns zeroes for a client with no lancamentos", () => {
    const m = metricasCliente("desconhecido", lancamentos, pagamentos);
    expect(m).toEqual({ ltv: 0, ticketMedio: 0, frequencia: 0 });
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm run test`
Expected: FAIL — `Cannot find module './ltv'`.

- [ ] **Step 3: Implement `lib/ltv.ts`**

Create `lib/ltv.ts`:
```typescript
import { round2, totalPago } from "./calculations";
import type { LancamentoRow, PagamentoRow } from "./types";

export type MetricasCliente = {
  ltv: number;
  ticketMedio: number;
  frequencia: number;
};

export function metricasCliente(
  clienteId: string,
  lancamentos: LancamentoRow[],
  pagamentos: PagamentoRow[]
): MetricasCliente {
  const doCliente = lancamentos.filter((l) => l.tipo === "receita" && l.cliente_id === clienteId);

  const pagos = doCliente.filter((l) => totalPago(pagamentos, l.id) > 0);

  const ltv = round2(pagos.reduce((acc, l) => acc + totalPago(pagamentos, l.id), 0));
  const frequencia = pagos.length;
  const ticketMedio = frequencia > 0 ? round2(ltv / frequencia) : 0;

  return { ltv, ticketMedio, frequencia };
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `npm run test`
Expected: PASS — all 4 new tests green, plus the existing `calculations.test.ts` suite still passing.

- [ ] **Step 5: Clientes queries**

Create `lib/queries/clientes.ts`:
```typescript
import { createClient } from "@/lib/supabase/server";
import type { Cliente } from "@/lib/types";

export async function listarClientes() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clientes").select("*").order("nome");
  if (error) throw error;
  return data as Cliente[];
}

export async function buscarCliente(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clientes").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Cliente;
}

export async function criarCliente(input: Omit<Cliente, "id">) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clientes").insert(input).select().single();
  if (error) throw error;
  return data as Cliente;
}

export async function atualizarCliente(id: string, input: Partial<Omit<Cliente, "id">>) {
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update(input).eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 6: Equipamentos queries**

Create `lib/queries/equipamentos.ts`:
```typescript
import { createClient } from "@/lib/supabase/server";

export type EquipamentoCliente = {
  id: string;
  cliente_id: string;
  tipo: string;
  marca_modelo: string | null;
  numero_serie: string | null;
  observacao: string | null;
};

export async function listarEquipamentosDoCliente(clienteId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipamentos_cliente")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as EquipamentoCliente[];
}

export async function criarEquipamento(input: Omit<EquipamentoCliente, "id">) {
  const supabase = await createClient();
  const { error } = await supabase.from("equipamentos_cliente").insert(input);
  if (error) throw error;
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/ltv.ts lib/ltv.test.ts lib/queries/clientes.ts lib/queries/equipamentos.ts
git commit -m "feat: add cliente data layer with LTV calculation"
```

---

### Task 13: Clientes — UI (lista e detalhe)

**Files:**
- Create: `app/clientes/page.tsx`
- Create: `app/clientes/actions.ts`
- Create: `app/clientes/ClienteModal.tsx`
- Create: `app/clientes/[id]/page.tsx`
- Create: `app/clientes/[id]/EquipamentoModal.tsx`
- Create: `app/clientes/[id]/equipamentoActions.ts`

- [ ] **Step 1: Cliente CRUD actions**

Create `app/clientes/actions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { criarCliente, atualizarCliente } from "@/lib/queries/clientes";

export async function salvarClienteAction(formData: FormData) {
  const id = formData.get("id") as string | null;

  const input = {
    nome: formData.get("nome") as string,
    contato: (formData.get("contato") as string) || null,
    documento: (formData.get("documento") as string) || null,
    classificacao: formData.get("classificacao") as "padrao" | "vip" | "recorrente" | "inadimplente",
    observacao: (formData.get("observacao") as string) || null,
  };

  if (id) {
    await atualizarCliente(id, input);
  } else {
    await criarCliente(input);
  }

  revalidatePath("/clientes");
}
```

- [ ] **Step 2: Cliente modal**

Create `app/clientes/ClienteModal.tsx`:
```tsx
"use client";

import { Modal } from "@/components/Modal";
import { salvarClienteAction } from "./actions";
import type { Cliente } from "@/lib/types";

export function ClienteModal({
  open,
  onClose,
  cliente,
}: {
  open: boolean;
  onClose: () => void;
  cliente: Cliente | null;
}) {
  return (
    <Modal open={open} onClose={onClose} title={cliente ? "Editar cliente" : "Novo cliente"}>
      <form
        action={async (formData) => {
          await salvarClienteAction(formData);
          onClose();
        }}
        className="grid grid-cols-2 gap-3"
      >
        {cliente && <input type="hidden" name="id" value={cliente.id} />}

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Nome</label>
          <input
            name="nome"
            defaultValue={cliente?.nome}
            required
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Contato</label>
          <input
            name="contato"
            defaultValue={cliente?.contato ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Documento</label>
          <input
            name="documento"
            defaultValue={cliente?.documento ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Classificação</label>
          <select
            name="classificacao"
            defaultValue={cliente?.classificacao ?? "padrao"}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            <option value="padrao">Padrão</option>
            <option value="vip">VIP</option>
            <option value="recorrente">Recorrente</option>
            <option value="inadimplente">Inadimplente</option>
          </select>
        </div>

        <div className="col-span-2 flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded">
            Cancelar
          </button>
          <button type="submit" className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded">
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 3: Clientes list page**

Create `app/clientes/page.tsx`:
```tsx
import Link from "next/link";
import { listarClientes } from "@/lib/queries/clientes";

const BADGE: Record<string, string> = {
  vip: "bg-amber-950 text-[var(--accent-amber)]",
  recorrente: "bg-blue-950 text-[var(--accent-blue)]",
  inadimplente: "bg-red-950 text-[var(--accent-red)]",
  padrao: "bg-[var(--surface-2)] text-[var(--text-dim)]",
};

export default async function ClientesPage() {
  const clientes = await listarClientes();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Clientes</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {clientes.map((c) => (
          <Link
            key={c.id}
            href={`/clientes/${c.id}`}
            className="block bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 hover:border-[var(--accent-blue)]"
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold">{c.nome}</h3>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${BADGE[c.classificacao]}`}>
                {c.classificacao}
              </span>
            </div>
            <p className="text-sm text-[var(--text-dim)]">{c.contato ?? "Sem contato"}</p>
          </Link>
        ))}
        {clientes.length === 0 && (
          <p className="text-[var(--text-dim)]">Nenhum cliente cadastrado ainda.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Equipamento actions and modal**

Create `app/clientes/[id]/equipamentoActions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { criarEquipamento } from "@/lib/queries/equipamentos";

export async function criarEquipamentoAction(formData: FormData) {
  const clienteId = formData.get("cliente_id") as string;

  await criarEquipamento({
    cliente_id: clienteId,
    tipo: formData.get("tipo") as string,
    marca_modelo: (formData.get("marca_modelo") as string) || null,
    numero_serie: (formData.get("numero_serie") as string) || null,
    observacao: (formData.get("observacao") as string) || null,
  });

  revalidatePath(`/clientes/${clienteId}`);
}
```

Create `app/clientes/[id]/EquipamentoModal.tsx`:
```tsx
"use client";

import { Modal } from "@/components/Modal";
import { criarEquipamentoAction } from "./equipamentoActions";

export function EquipamentoModal({
  open,
  onClose,
  clienteId,
}: {
  open: boolean;
  onClose: () => void;
  clienteId: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Novo equipamento">
      <form
        action={async (formData) => {
          await criarEquipamentoAction(formData);
          onClose();
        }}
        className="grid grid-cols-2 gap-3"
      >
        <input type="hidden" name="cliente_id" value={clienteId} />

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Tipo</label>
          <select name="tipo" className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]">
            <option value="notebook">Notebook</option>
            <option value="desktop">Desktop</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Marca/Modelo</label>
          <input name="marca_modelo" className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]" />
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Número de série</label>
          <input name="numero_serie" className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]" />
        </div>

        <div className="col-span-2 flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded">
            Cancelar
          </button>
          <button type="submit" className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded">
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 5: Cliente detail page**

Create `app/clientes/[id]/page.tsx`:
```tsx
import { buscarCliente } from "@/lib/queries/clientes";
import { listarEquipamentosDoCliente } from "@/lib/queries/equipamentos";
import { listarLancamentos } from "@/lib/queries/lancamentos";
import { listarPagamentos } from "@/lib/queries/pagamentos";
import { metricasCliente } from "@/lib/ltv";
import { money } from "@/lib/format";

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [cliente, equipamentos, lancamentos, pagamentos] = await Promise.all([
    buscarCliente(id),
    listarEquipamentosDoCliente(id),
    listarLancamentos(),
    listarPagamentos(),
  ]);

  const metricas = metricasCliente(id, lancamentos, pagamentos);
  const historico = lancamentos.filter((l) => l.cliente_id === id);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-1">{cliente.nome}</h1>
      <p className="text-[var(--text-dim)] mb-6">{cliente.contato ?? "Sem contato"}</p>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
          <div className="text-xs text-[var(--text-dim)] uppercase">LTV</div>
          <div className="text-xl font-semibold">{money(metricas.ltv)}</div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
          <div className="text-xs text-[var(--text-dim)] uppercase">Ticket médio</div>
          <div className="text-xl font-semibold">{money(metricas.ticketMedio)}</div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
          <div className="text-xs text-[var(--text-dim)] uppercase">Compras/serviços</div>
          <div className="text-xl font-semibold">{metricas.frequencia}</div>
        </div>
      </div>

      <h2 className="font-semibold mb-2">Equipamentos</h2>
      <ul className="mb-8 space-y-1">
        {equipamentos.map((e) => (
          <li key={e.id} className="text-sm text-[var(--text-dim)]">
            {e.tipo} — {e.marca_modelo ?? "sem modelo informado"}
          </li>
        ))}
        {equipamentos.length === 0 && (
          <li className="text-sm text-[var(--text-dim)]">Nenhum equipamento cadastrado.</li>
        )}
      </ul>

      <h2 className="font-semibold mb-2">Histórico</h2>
      <ul className="space-y-1">
        {historico.map((l) => (
          <li key={l.id} className="text-sm flex justify-between border-b border-[var(--border)] py-1">
            <span>{l.descricao}</span>
            <span>{money(l.valor)}</span>
          </li>
        ))}
        {historico.length === 0 && (
          <li className="text-sm text-[var(--text-dim)]">Nenhum lançamento vinculado a este cliente.</li>
        )}
      </ul>
    </div>
  );
}
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open `/clientes`, create a client "Maria Silva" with classificação VIP.
Expected: card appears with amber "vip" badge. Click into the client → detail page shows LTV/ticket médio/frequência as R$ 0,00 / R$ 0,00 / 0 (no history yet). Create a `lancamento` in Studio with `tipo=receita`, `cliente_id` = Maria's id, `valor=150`, register a payment for it in `/lancamentos` → refresh Maria's page → LTV becomes R$ 150,00.

- [ ] **Step 7: Commit**

```bash
git add app/clientes
git commit -m "feat: add clientes list and detail pages with LTV"
```

---

### Task 14: Fornecedores

**Files:**
- Create: `lib/queries/fornecedores.ts`
- Create: `app/fornecedores/page.tsx`
- Create: `app/fornecedores/actions.ts`
- Create: `app/fornecedores/FornecedorModal.tsx`

- [ ] **Step 1: Fornecedores queries**

Create `lib/queries/fornecedores.ts`:
```typescript
import { createClient } from "@/lib/supabase/server";
import type { Fornecedor } from "@/lib/types";

export async function listarFornecedores() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
  if (error) throw error;
  return data as Fornecedor[];
}

export async function criarFornecedor(input: Omit<Fornecedor, "id">) {
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").insert(input);
  if (error) throw error;
}
```

- [ ] **Step 2: Server action**

Create `app/fornecedores/actions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { criarFornecedor } from "@/lib/queries/fornecedores";

export async function criarFornecedorAction(formData: FormData) {
  await criarFornecedor({
    nome: formData.get("nome") as string,
    contato: (formData.get("contato") as string) || null,
    documento: (formData.get("documento") as string) || null,
    tipo: (formData.get("tipo") as string) || null,
  });
  revalidatePath("/fornecedores");
}
```

- [ ] **Step 3: Modal**

Create `app/fornecedores/FornecedorModal.tsx`:
```tsx
"use client";

import { Modal } from "@/components/Modal";
import { criarFornecedorAction } from "./actions";

export function FornecedorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Novo fornecedor">
      <form
        action={async (formData) => {
          await criarFornecedorAction(formData);
          onClose();
        }}
        className="grid grid-cols-2 gap-3"
      >
        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Nome</label>
          <input name="nome" required className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]" />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Contato</label>
          <input name="contato" className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]" />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Documento</label>
          <input name="documento" className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]" />
        </div>
        <div className="col-span-2 flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded">
            Cancelar
          </button>
          <button type="submit" className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded">
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 4: List page with saldo em aberto per fornecedor**

Create `app/fornecedores/page.tsx`:
```tsx
import { listarFornecedores } from "@/lib/queries/fornecedores";
import { listarLancamentos } from "@/lib/queries/lancamentos";
import { listarPagamentos } from "@/lib/queries/pagamentos";
import { saldo } from "@/lib/calculations";
import { money } from "@/lib/format";

export default async function FornecedoresPage() {
  const [fornecedores, lancamentos, pagamentos] = await Promise.all([
    listarFornecedores(),
    listarLancamentos(),
    listarPagamentos(),
  ]);

  const linhas = fornecedores.map((f) => {
    const doFornecedor = lancamentos.filter((l) => l.fornecedor_id === f.id);
    const total = doFornecedor.reduce((acc, l) => acc + l.valor, 0);
    const falta = doFornecedor.reduce((acc, l) => acc + saldo(l, pagamentos), 0);
    return { fornecedor: f, total, falta };
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Fornecedores</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {linhas.map(({ fornecedor, total, falta }) => (
          <div key={fornecedor.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
            <h3 className="font-semibold mb-1">{fornecedor.nome}</h3>
            <p className="text-xs text-[var(--text-dim)] mb-3">{fornecedor.tipo ?? "—"}</p>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-dim)]">Total lançado</span>
              <span>{money(total)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-[var(--text-dim)]">Falta pagar</span>
              <span className={falta > 0.004 ? "text-[var(--accent-red)]" : "text-[var(--accent-green)]"}>
                {money(falta)}
              </span>
            </div>
          </div>
        ))}
        {linhas.length === 0 && <p className="text-[var(--text-dim)]">Nenhum fornecedor cadastrado ainda.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open `/fornecedores`, add "Distribuidora XYZ". Create a `lancamento` in Studio (`tipo=despesa`, `fornecedor_id` = XYZ's id, `valor=800`).
Expected: refresh `/fornecedores` → card shows total lançado R$ 800,00 and falta pagar R$ 800,00 in red.

- [ ] **Step 6: Commit**

```bash
git add lib/queries/fornecedores.ts app/fornecedores
git commit -m "feat: add fornecedores module"
```

---

### Task 15: Dívidas

**Files:**
- Create: `lib/queries/dividas.ts`
- Create: `app/dividas/page.tsx`

- [ ] **Step 1: Dívidas queries**

Create `lib/queries/dividas.ts`:
```typescript
import { createClient } from "@/lib/supabase/server";
import type { LancamentoRow } from "@/lib/types";

export async function listarDividasClientes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lancamentos")
    .select("*")
    .eq("tipo", "receita")
    .not("cliente_id", "is", null)
    .order("vencimento", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as LancamentoRow[];
}

export async function listarDividasLoja() {
  const supabase = await createClient();
  const { data: categoria, error: categoriaError } = await supabase
    .from("categorias")
    .select("id")
    .eq("nome", "Empréstimos e Financiamentos")
    .single();
  if (categoriaError) throw categoriaError;

  const { data, error } = await supabase
    .from("lancamentos")
    .select("*")
    .eq("tipo", "despesa")
    .eq("categoria_id", categoria.id)
    .order("vencimento", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as LancamentoRow[];
}
```

- [ ] **Step 2: Dívidas page with two tabs**

Create `app/dividas/page.tsx`:
```tsx
import { listarDividasClientes, listarDividasLoja } from "@/lib/queries/dividas";
import { listarClientes } from "@/lib/queries/clientes";
import { listarPagamentos } from "@/lib/queries/pagamentos";
import { saldo, status as calcStatus } from "@/lib/calculations";
import { money, formatDataBR, hoje } from "@/lib/format";
import { StatusTag } from "@/components/StatusTag";

export default async function DividasPage() {
  const [dividasClientes, dividasLoja, clientes, pagamentos] = await Promise.all([
    listarDividasClientes(),
    listarDividasLoja(),
    listarClientes(),
    listarPagamentos(),
  ]);

  const hojeStr = hoje();
  const nomeCliente = (id: string | null) => clientes.find((c) => c.id === id)?.nome ?? "—";

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Dívidas</h1>

      <h2 className="font-semibold mb-2">Clientes devendo</h2>
      <table className="w-full text-sm border-collapse mb-8">
        <thead>
          <tr className="text-left text-[var(--text-dim)] text-xs uppercase border-b border-[var(--border)]">
            <th className="py-2">Cliente</th>
            <th>Vencimento</th>
            <th>Situação</th>
            <th className="text-right">Falta</th>
          </tr>
        </thead>
        <tbody>
          {dividasClientes
            .filter((l) => saldo(l, pagamentos) > 0.004)
            .map((l) => (
              <tr key={l.id} className="border-b border-[var(--border)]">
                <td className="py-2">{nomeCliente(l.cliente_id)}</td>
                <td>{formatDataBR(l.vencimento)}</td>
                <td>
                  <StatusTag status={calcStatus(l, pagamentos, hojeStr)} />
                </td>
                <td className="text-right font-semibold text-[var(--accent-red)]">{money(saldo(l, pagamentos))}</td>
              </tr>
            ))}
        </tbody>
      </table>

      <h2 className="font-semibold mb-2">Dívidas da loja (empréstimos e financiamentos)</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-[var(--text-dim)] text-xs uppercase border-b border-[var(--border)]">
            <th className="py-2">Descrição</th>
            <th>Vencimento</th>
            <th>Situação</th>
            <th className="text-right">Falta</th>
          </tr>
        </thead>
        <tbody>
          {dividasLoja
            .filter((l) => saldo(l, pagamentos) > 0.004)
            .map((l) => (
              <tr key={l.id} className="border-b border-[var(--border)]">
                <td className="py-2">{l.descricao}</td>
                <td>{formatDataBR(l.vencimento)}</td>
                <td>
                  <StatusTag status={calcStatus(l, pagamentos, hojeStr)} />
                </td>
                <td className="text-right font-semibold text-[var(--accent-red)]">{money(saldo(l, pagamentos))}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

In Studio, create a `lancamento` with `tipo=receita`, `cliente_id` set, `valor=400`, no payment. Create another with `tipo=despesa`, `categoria_id` = the "Empréstimos e Financiamentos" category id, `valor=1000`.
Run: `npm run dev`, open `/dividas`.
Expected: first row appears under "Clientes devendo" with falta R$ 400,00; second appears under "Dívidas da loja" with falta R$ 1.000,00.

- [ ] **Step 4: Commit**

```bash
git add lib/queries/dividas.ts app/dividas
git commit -m "feat: add dividas view over lancamentos"
```

---

### Task 16: Relatórios — por categoria e frente de negócio

**Files:**
- Create: `lib/queries/relatorios.ts`
- Create: `app/relatorios/page.tsx`

- [ ] **Step 1: Write the failing test for the aggregation logic**

Create `lib/relatorios.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { agruparPorFrenteNegocio } from "./relatorios-calc";
import type { LancamentoRow, PagamentoRow, Categoria } from "./types";

const categorias: Categoria[] = [
  { id: "cat-pecas", nome: "Venda de Peças", grupo_dre: "Receita Bruta", frente_negocio: "pecas_acessorios" },
  { id: "cat-pc", nome: "Venda de Computadores", grupo_dre: "Receita Bruta", frente_negocio: "computadores" },
];

const lancamentos: LancamentoRow[] = [
  { id: "l1", descricao: "Venda 1", tipo: "receita", categoria_id: "cat-pecas", cliente_id: null, fornecedor_id: null, conta_financeira_id: null, equipamento_id: null, valor: 100, custo: 40, vencimento: null, competencia: null, recorrencia: null, observacao: null },
  { id: "l2", descricao: "Venda 2", tipo: "receita", categoria_id: "cat-pc", cliente_id: null, fornecedor_id: null, conta_financeira_id: null, equipamento_id: null, valor: 500, custo: 300, vencimento: null, competencia: null, recorrencia: null, observacao: null },
];

const pagamentos: PagamentoRow[] = [];

describe("agruparPorFrenteNegocio", () => {
  it("sums valor and custo per frente de negocio and computes margem", () => {
    const resultado = agruparPorFrenteNegocio(lancamentos, categorias, pagamentos);
    expect(resultado.find((r) => r.frente === "pecas_acessorios")).toEqual({
      frente: "pecas_acessorios",
      receita: 100,
      custo: 40,
      margem: 60,
    });
    expect(resultado.find((r) => r.frente === "computadores")).toEqual({
      frente: "computadores",
      receita: 500,
      custo: 300,
      margem: 200,
    });
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm run test`
Expected: FAIL — `Cannot find module './relatorios-calc'`.

- [ ] **Step 3: Implement the aggregation function**

Create `lib/relatorios-calc.ts`:
```typescript
import { round2 } from "./calculations";
import type { LancamentoRow, Categoria, PagamentoRow } from "./types";

export type LinhaFrenteNegocio = {
  frente: "pecas_acessorios" | "computadores" | "assistencia_tecnica" | "outros";
  receita: number;
  custo: number;
  margem: number;
};

export function agruparPorFrenteNegocio(
  lancamentos: LancamentoRow[],
  categorias: Categoria[],
  _pagamentos: PagamentoRow[]
): LinhaFrenteNegocio[] {
  const frenteDaCategoria = new Map(categorias.map((c) => [c.id, c.frente_negocio]));

  const acumulado = new Map<string, { receita: number; custo: number }>();

  for (const l of lancamentos) {
    if (l.tipo !== "receita") continue;
    const frente = l.categoria_id ? frenteDaCategoria.get(l.categoria_id) : null;
    if (!frente) continue;

    const atual = acumulado.get(frente) ?? { receita: 0, custo: 0 };
    atual.receita += l.valor;
    atual.custo += l.custo ?? 0;
    acumulado.set(frente, atual);
  }

  return Array.from(acumulado.entries()).map(([frente, { receita, custo }]) => ({
    frente: frente as LinhaFrenteNegocio["frente"],
    receita: round2(receita),
    custo: round2(custo),
    margem: round2(receita - custo),
  }));
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Relatórios queries (categoria report reuses existing data)**

Create `lib/queries/relatorios.ts`:
```typescript
import { listarLancamentos } from "./lancamentos";
import { listarPagamentos } from "./pagamentos";
import { listarCategorias } from "./categorias";
import { agruparPorFrenteNegocio } from "@/lib/relatorios-calc";
import { saldo, status as calcStatus, totalPago } from "@/lib/calculations";
import { hoje } from "@/lib/format";

export async function relatorioPorCategoria() {
  const [lancamentos, pagamentos, categorias] = await Promise.all([
    listarLancamentos(),
    listarPagamentos(),
    listarCategorias(),
  ]);

  const hojeStr = hoje();
  const nomeCategoria = new Map(categorias.map((c) => [c.id, c.nome]));

  const acumulado = new Map<string, { total: number; pago: number; vencido: number }>();

  for (const l of lancamentos) {
    const nome = l.categoria_id ? nomeCategoria.get(l.categoria_id) ?? "Outros" : "Outros";
    const atual = acumulado.get(nome) ?? { total: 0, pago: 0, vencido: 0 };
    atual.total += l.valor;
    atual.pago += totalPago(pagamentos, l.id);
    if (calcStatus(l, pagamentos, hojeStr) === "atrasado") atual.vencido += saldo(l, pagamentos);
    acumulado.set(nome, atual);
  }

  return Array.from(acumulado.entries()).map(([categoria, dados]) => ({ categoria, ...dados }));
}

export async function relatorioPorFrenteNegocio() {
  const [lancamentos, pagamentos, categorias] = await Promise.all([
    listarLancamentos(),
    listarPagamentos(),
    listarCategorias(),
  ]);
  return agruparPorFrenteNegocio(lancamentos, categorias, pagamentos);
}
```

- [ ] **Step 6: Relatórios page**

Create `app/relatorios/page.tsx`:
```tsx
import { relatorioPorCategoria, relatorioPorFrenteNegocio } from "@/lib/queries/relatorios";
import { money } from "@/lib/format";

const FRENTE_LABEL: Record<string, string> = {
  pecas_acessorios: "Peças e Acessórios",
  computadores: "Computadores",
  assistencia_tecnica: "Assistência Técnica",
  outros: "Outros",
};

export default async function RelatoriosPage() {
  const [porCategoria, porFrente] = await Promise.all([relatorioPorCategoria(), relatorioPorFrenteNegocio()]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Relatórios</h1>

      <h2 className="font-semibold mb-2">Por frente de negócio</h2>
      <table className="w-full text-sm border-collapse mb-8">
        <thead>
          <tr className="text-left text-[var(--text-dim)] text-xs uppercase border-b border-[var(--border)]">
            <th className="py-2">Frente</th>
            <th className="text-right">Receita</th>
            <th className="text-right">Custo</th>
            <th className="text-right">Margem</th>
          </tr>
        </thead>
        <tbody>
          {porFrente.map((r) => (
            <tr key={r.frente} className="border-b border-[var(--border)]">
              <td className="py-2">{FRENTE_LABEL[r.frente]}</td>
              <td className="text-right">{money(r.receita)}</td>
              <td className="text-right">{money(r.custo)}</td>
              <td className="text-right font-semibold text-[var(--accent-green)]">{money(r.margem)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="font-semibold mb-2">Por categoria</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-[var(--text-dim)] text-xs uppercase border-b border-[var(--border)]">
            <th className="py-2">Categoria</th>
            <th className="text-right">Total</th>
            <th className="text-right">Pago</th>
            <th className="text-right">Vencido</th>
          </tr>
        </thead>
        <tbody>
          {porCategoria.map((r) => (
            <tr key={r.categoria} className="border-b border-[var(--border)]">
              <td className="py-2">{r.categoria}</td>
              <td className="text-right">{money(r.total)}</td>
              <td className="text-right">{money(r.pago)}</td>
              <td className="text-right text-[var(--accent-red)]">{money(r.vencido)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, open `/relatorios`.
Expected: "Por frente de negócio" shows rows for categories that have `frente_negocio` set on lançamentos with `tipo=receita` (use the test data from Task 9's manual verification, or add a new receita lançamento with `categoria_id` = "Venda de Computadores" and a `custo`). "Por categoria" shows every category with any lançamento.

- [ ] **Step 8: Commit**

```bash
git add lib/relatorios-calc.ts lib/relatorios.test.ts lib/queries/relatorios.ts app/relatorios
git commit -m "feat: add reports by categoria and frente de negocio"
```

---

### Task 17: Contas financeiras

**Files:**
- Create: `lib/queries/contasFinanceiras.ts` (extend — create/update already scaffolded read-only version in Task 7)
- Create: `app/contas/page.tsx`
- Create: `app/contas/actions.ts`
- Create: `app/contas/ContaModal.tsx`

- [ ] **Step 1: Extend contas financeiras queries with create/update**

Modify `lib/queries/contasFinanceiras.ts` — add below the existing `listarContasFinanceiras` function:
```typescript
export async function criarContaFinanceira(input: {
  nome: string;
  tipo: "caixa" | "banco" | "cartao";
  saldo_inicial: number;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("contas_financeiras").insert(input);
  if (error) throw error;
}
```

- [ ] **Step 2: Server action**

Create `app/contas/actions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { criarContaFinanceira } from "@/lib/queries/contasFinanceiras";

export async function criarContaAction(formData: FormData) {
  await criarContaFinanceira({
    nome: formData.get("nome") as string,
    tipo: formData.get("tipo") as "caixa" | "banco" | "cartao",
    saldo_inicial: Number(formData.get("saldo_inicial") || 0),
  });
  revalidatePath("/contas");
}
```

- [ ] **Step 3: Modal**

Create `app/contas/ContaModal.tsx`:
```tsx
"use client";

import { Modal } from "@/components/Modal";
import { criarContaAction } from "./actions";

export function ContaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Nova conta/caixa">
      <form
        action={async (formData) => {
          await criarContaAction(formData);
          onClose();
        }}
        className="grid grid-cols-2 gap-3"
      >
        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Nome</label>
          <input name="nome" required className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]" />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Tipo</label>
          <select name="tipo" className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]">
            <option value="caixa">Caixa físico</option>
            <option value="banco">Conta bancária</option>
            <option value="cartao">Cartão</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Saldo inicial (R$)</label>
          <input type="number" step="0.01" name="saldo_inicial" defaultValue={0} className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]" />
        </div>
        <div className="col-span-2 flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded">
            Cancelar
          </button>
          <button type="submit" className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded">
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 4: Page with per-account balance**

Create `app/contas/page.tsx`:
```tsx
import { listarContasFinanceiras } from "@/lib/queries/contasFinanceiras";
import { listarLancamentos } from "@/lib/queries/lancamentos";
import { listarPagamentos } from "@/lib/queries/pagamentos";
import { money } from "@/lib/format";

export default async function ContasPage() {
  const [contas, lancamentos, pagamentos] = await Promise.all([
    listarContasFinanceiras(),
    listarLancamentos(),
    listarPagamentos(),
  ]);

  const saldoDaConta = (contaId: string) => {
    const conta = contas.find((c) => c.id === contaId)!;
    const daConta = lancamentos.filter((l) => l.conta_financeira_id === contaId);
    const movimentado = daConta.reduce((acc, l) => {
      const pagoDoLancamento = pagamentos
        .filter((p) => p.lancamento_id === l.id)
        .reduce((a, p) => a + p.valor, 0);
      return acc + (l.tipo === "receita" ? pagoDoLancamento : -pagoDoLancamento);
    }, 0);
    return conta.saldo_inicial + movimentado;
  };

  const saldoConsolidado = contas.reduce((acc, c) => acc + saldoDaConta(c.id), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Contas e caixas</h1>
        <div className="text-right">
          <div className="text-xs text-[var(--text-dim)] uppercase">Saldo consolidado</div>
          <div className="text-xl font-semibold">{money(saldoConsolidado)}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {contas.map((c) => (
          <div key={c.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
            <h3 className="font-semibold mb-1">{c.nome}</h3>
            <p className="text-xs text-[var(--text-dim)] mb-3 uppercase">{c.tipo}</p>
            <div className="text-lg font-semibold">{money(saldoDaConta(c.id))}</div>
          </div>
        ))}
        {contas.length === 0 && <p className="text-[var(--text-dim)]">Nenhuma conta cadastrada ainda.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open `/contas`, add "Caixa Loja" (tipo caixa, saldo inicial 500) and "Banco PJ" (tipo banco, saldo inicial 2000).
Expected: both cards show, saldo consolidado = R$ 2.500,00. Link a paid `lancamento` (`tipo=receita`, `valor=100`) to "Caixa Loja" via `conta_financeira_id` in Studio and register its payment → refresh → Caixa Loja shows R$ 600,00, consolidado R$ 2.600,00.

- [ ] **Step 6: Commit**

```bash
git add lib/queries/contasFinanceiras.ts app/contas
git commit -m "feat: add contas financeiras module with balances"
```

---

### Task 18: Dashboard

**Files:**
- Create: `lib/queries/dashboard.ts`
- Create: `app/dashboard/page.tsx`
- Create: `components/Kpi.tsx`
- Create: `app/layout.tsx` (add nav — modify existing scaffold file)

- [ ] **Step 1: Dashboard aggregation query**

Create `lib/queries/dashboard.ts`:
```typescript
import { listarLancamentos } from "./lancamentos";
import { listarPagamentos } from "./pagamentos";
import { listarClientes } from "./clientes";
import { listarContasFinanceiras } from "./contasFinanceiras";
import { saldo, status as calcStatus, totalPago } from "@/lib/calculations";
import { hoje } from "@/lib/format";

export async function dadosDashboard() {
  const [lancamentos, pagamentos, clientes, contas] = await Promise.all([
    listarLancamentos(),
    listarPagamentos(),
    listarClientes(),
    listarContasFinanceiras(),
  ]);

  const hojeStr = hoje();
  const despesas = lancamentos.filter((l) => l.tipo === "despesa");

  const atrasados = despesas.filter((l) => calcStatus(l, pagamentos, hojeStr) === "atrasado");
  const totalAtrasado = atrasados.reduce((acc, l) => acc + saldo(l, pagamentos), 0);

  const em7dias = new Date();
  em7dias.setDate(em7dias.getDate() + 7);
  const limite = em7dias.toISOString().slice(0, 10);
  const venceSemana = despesas.filter(
    (l) => l.vencimento && l.vencimento >= hojeStr && l.vencimento <= limite && calcStatus(l, pagamentos, hojeStr) !== "quitado"
  );
  const totalSemana = venceSemana.reduce((acc, l) => acc + saldo(l, pagamentos), 0);

  const mesAtual = hojeStr.slice(0, 7);
  const receitaMes = lancamentos
    .filter((l) => l.tipo === "receita" && l.vencimento?.slice(0, 7) === mesAtual)
    .reduce((acc, l) => acc + totalPago(pagamentos, l.id), 0);

  const saldoConsolidado = contas.reduce((acc, c) => {
    const daConta = lancamentos.filter((l) => l.conta_financeira_id === c.id);
    const movimentado = daConta.reduce((a, l) => {
      const pago = totalPago(pagamentos, l.id);
      return a + (l.tipo === "receita" ? pago : -pago);
    }, 0);
    return acc + c.saldo_inicial + movimentado;
  }, 0);

  const clientesInadimplentes = clientes.filter((c) => c.classificacao === "inadimplente").length;

  const semanas: { inicio: string; entradas: number; saidas: number }[] = [];
  for (let i = 3; i >= 0; i--) {
    const fim = new Date();
    fim.setDate(fim.getDate() - i * 7);
    const inicio = new Date(fim);
    inicio.setDate(inicio.getDate() - 6);
    const inicioStr = inicio.toISOString().slice(0, 10);
    const fimStr = fim.toISOString().slice(0, 10);

    const pagamentosNaSemana = pagamentos.filter((p) => p.data_pagamento >= inicioStr && p.data_pagamento <= fimStr);
    const entradas = pagamentosNaSemana
      .filter((p) => lancamentos.find((l) => l.id === p.lancamento_id)?.tipo === "receita")
      .reduce((acc, p) => acc + p.valor, 0);
    const saidas = pagamentosNaSemana
      .filter((p) => lancamentos.find((l) => l.id === p.lancamento_id)?.tipo === "despesa")
      .reduce((acc, p) => acc + p.valor, 0);

    semanas.push({ inicio: inicioStr, entradas, saidas });
  }

  return {
    saldoConsolidado,
    totalAtrasado,
    contasAtrasadas: atrasados.length,
    totalSemana,
    receitaMes,
    clientesInadimplentes,
    semanas,
  };
}
```

- [ ] **Step 2: KPI component**

Create `components/Kpi.tsx`:
```tsx
export function Kpi({
  label,
  valor,
  tone = "neutral",
}: {
  label: string;
  valor: string;
  tone?: "neutral" | "red" | "amber" | "green";
}) {
  const color = {
    neutral: "text-[var(--text)]",
    red: "text-[var(--accent-red)]",
    amber: "text-[var(--accent-amber)]",
    green: "text-[var(--accent-green)]",
  }[tone];

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
      <div className="text-xs text-[var(--text-dim)] uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${color}`}>{valor}</div>
    </div>
  );
}
```

- [ ] **Step 3: Dashboard page**

Create `app/dashboard/page.tsx`:
```tsx
import { dadosDashboard } from "@/lib/queries/dashboard";
import { Kpi } from "@/components/Kpi";
import { money, formatDataBR } from "@/lib/format";

export default async function DashboardPage() {
  const d = await dadosDashboard();
  const maiorSemana = Math.max(1, ...d.semanas.map((s) => Math.max(s.entradas, s.saidas)));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Kpi label="Saldo consolidado" valor={money(d.saldoConsolidado)} />
        <Kpi label="Atrasado" valor={money(d.totalAtrasado)} tone="red" />
        <Kpi label="Vence em 7 dias" valor={money(d.totalSemana)} tone="amber" />
        <Kpi label="Receita do mês" valor={money(d.receitaMes)} tone="green" />
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5 mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-4">
          Fluxo de caixa — últimas 4 semanas
        </h2>
        <div className="flex gap-4 items-end h-40">
          {d.semanas.map((s) => (
            <div key={s.inicio} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex gap-1 items-end h-32 w-full justify-center">
                <div
                  className="w-4 bg-[var(--accent-green)] rounded-t"
                  style={{ height: `${Math.max(2, (s.entradas / maiorSemana) * 100)}%` }}
                />
                <div
                  className="w-4 bg-[var(--accent-red)] rounded-t"
                  style={{ height: `${Math.max(2, (s.saidas / maiorSemana) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-[var(--text-dim)]">{formatDataBR(s.inicio)}</span>
            </div>
          ))}
        </div>
      </div>

      {(d.contasAtrasadas > 0 || d.clientesInadimplentes > 0) && (
        <div className="bg-[var(--surface)] border border-[var(--accent-red)] rounded-lg p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-red)] mb-3">
            Precisa de atenção
          </h2>
          <ul className="space-y-1 text-sm">
            {d.contasAtrasadas > 0 && (
              <li>
                {d.contasAtrasadas} conta(s) vencida(s) — {money(d.totalAtrasado)}
              </li>
            )}
            {d.clientesInadimplentes > 0 && <li>{d.clientesInadimplentes} cliente(s) marcado(s) como inadimplente</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: App shell with navigation**

Modify `app/layout.tsx` — replace its full contents with:
```tsx
import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Loja de Informática — Financeiro",
};

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/lancamentos", label: "Entradas e Saídas" },
  { href: "/permutas", label: "Permutas" },
  { href: "/clientes", label: "Clientes" },
  { href: "/dividas", label: "Dívidas" },
  { href: "/fornecedores", label: "Fornecedores" },
  { href: "/relatorios", label: "Relatórios" },
  { href: "/contas", label: "Contas" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen">
        <nav className="w-56 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] p-4 hidden md:block">
          <p className="text-sm font-semibold mb-4">Loja de Informática</p>
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block px-2 py-1.5 rounded text-sm text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Redirect the root path to the dashboard**

Modify `app/page.tsx` — replace its full contents (the `create-next-app` starter page) with:
```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, log in, land on `/dashboard`.
Expected: sidebar nav with all 8 sections; KPIs show real numbers from the data entered across previous tasks; the 4-week bar chart renders green (entradas) and red (saídas) bars; if there's an overdue lançamento, the "Precisa de atenção" panel appears with a red border. Click through each nav item and confirm no page errors.

- [ ] **Step 7: Commit**

```bash
git add lib/queries/dashboard.ts app/dashboard components/Kpi.tsx app/layout.tsx app/page.tsx
git commit -m "feat: add dashboard with kpis, cash flow chart, and alerts"
```

---

### Task 19: Deploy

**Files:**
- Create: `.github/workflows/none` — not needed; deployment is manual via Vercel CLI/dashboard for this task.

- [ ] **Step 1: Create the Supabase production project**

Via the Supabase dashboard (not local), create a new project for the store. Note the project's URL, anon key, and service role key.

- [ ] **Step 2: Push migrations to production**

Run:
```bash
supabase link --project-ref <seu-project-ref>
supabase db push
```
Expected: all 5 migrations apply cleanly to the production database (same schema verified locally in Tasks 3–4, 11).

- [ ] **Step 3: Create the production storage bucket policies**

Confirm via Supabase dashboard → Storage that the `comprovantes` bucket and its two policies exist (they were included in migration `0005_storage_comprovantes.sql`, applied by the `db push` in Step 2).

- [ ] **Step 4: Deploy to Vercel**

Run:
```bash
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel --prod
```
Use the production Supabase project's values (from Step 1) when prompted for each env var.
Expected: deployment succeeds and prints a production URL.

- [ ] **Step 5: Create the first production user**

Via the Supabase dashboard (production project) → Authentication → Add user, create the store owner's login. Confirm a matching row appears in `profiles` with `papel = dono`.

- [ ] **Step 6: Verify end-to-end in production**

Open the Vercel production URL, log in, create a test `lancamento`, register a payment, confirm it appears on `/dashboard`. Delete the test data afterward via Studio.

- [ ] **Step 7: Commit any deployment config changes**

```bash
git add -A
git commit -m "chore: finalize production deployment configuration"
```
(Skip this commit if Step 4 produced no tracked file changes — `vercel link` writes to `.vercel/`, which should be added to `.gitignore` first if not already ignored.)

---

## Notes for the implementer

- Every task after Task 5 depends on the schema from Task 3 and the auth setup from Task 4 — do not reorder.
- `lib/calculations.ts`, `lib/ltv.ts`, and `lib/relatorios-calc.ts` are the only places with business math. If a number looks wrong anywhere in the UI, check there first before touching a component.
- The spec's future-scope items (Bling, automações, Telegram) are intentionally not tasked here — see spec section 8 for the extension points when that work is scheduled.
