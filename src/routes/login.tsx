import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const result =
      mode === "up"
        ? await authClient.signUp.email({ email, password, name: name || "Luís", callbackURL: "/painel" })
        : await authClient.signIn.email({ email, password, callbackURL: "/painel" });
    setPending(false);
    if (result.error) {
      setError(result.error.message || "Não foi possível entrar.");
      return;
    }
    window.location.assign("/painel");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <p className="text-xs tracking-[0.22em] text-teal uppercase">Âncora</p>
      <h1 className="mt-3 text-4xl text-paper">Entrar no painel</h1>
      <p className="mt-3 text-muted">
        Fora do construtor, a conta é e-mail e senha neste banco. O primeiro acesso reivindica o ambiente. Google e X só funcionam com o corretor da plataforma.
      </p>
      {authEnabled ? (
        <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
          {mode === "up" ? (
            <label className="text-sm text-muted">
              Nome
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-ink-2 px-3 text-paper"
              />
            </label>
          ) : null}
          <label className="text-sm text-muted">
            E-mail
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-ink-2 px-3 text-paper"
            />
          </label>
          <label className="text-sm text-muted">
            Senha
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-ink-2 px-3 text-paper"
            />
          </label>
          {error ? <p className="text-sm text-copper">{error}</p> : null}
          <button type="submit" disabled={pending} className="min-h-11 rounded-full bg-teal px-4 font-semibold text-ink">
            {pending ? "Aguarde…" : mode === "up" ? "Criar conta" : "Entrar"}
          </button>
          <button
            type="button"
            className="min-h-11 rounded-full border border-line px-4 text-paper"
            onClick={() => setMode(mode === "up" ? "in" : "up")}
          >
            {mode === "up" ? "Já tenho conta" : "Criar a primeira conta"}
          </button>
          {GROK_PROVIDERS.map((provider) => (
            <button
              key={provider.providerId}
              type="button"
              onClick={() => signIn(provider.providerId, { callbackURL: "/painel" })}
              className="min-h-11 rounded-full border border-line bg-ink-2 px-4 text-paper"
            >
              Continuar com {provider.label}
            </button>
          ))}
        </form>
      ) : (
        <p className="mt-8 text-sm text-muted">O acesso está desligado.</p>
      )}
    </main>
  );
}
