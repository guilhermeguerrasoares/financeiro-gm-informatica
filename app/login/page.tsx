import Image from "next/image";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form
        action={login}
        className="glass glow-ring rounded-2xl p-8 w-full max-w-sm flex flex-col items-center"
      >
        <Image src="/logo.png" alt="GM Stúdio Gamer" width={180} height={120} priority className="mb-4" />
        <p className="text-sm text-[var(--text-dim)] mb-6">Gestão financeira</p>

        {erro && (
          <p className="w-full text-[var(--accent-red)] text-sm mb-4 text-center">{erro}</p>
        )}

        <label className="block w-full text-sm text-[var(--text-dim)] mb-1">
          E-mail
        </label>
        <input
          name="email"
          type="email"
          required
          className="w-full mb-4 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-cyan)]"
        />
        <label className="block w-full text-sm text-[var(--text-dim)] mb-1">
          Senha
        </label>
        <input
          name="password"
          type="password"
          required
          className="w-full mb-6 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-cyan)]"
        />
        <button
          type="submit"
          className="w-full text-[var(--bg)] font-semibold py-2 rounded-lg"
          style={{ background: "var(--brand-gradient)" }}
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
