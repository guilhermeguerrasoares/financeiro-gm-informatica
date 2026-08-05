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
