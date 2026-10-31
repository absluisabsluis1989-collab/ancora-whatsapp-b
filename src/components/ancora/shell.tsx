import { Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { loadBoard } from "@/lib/ancora/fns";

const NAV = [
  { to: "/painel", label: "Operação", exact: true },
  { to: "/painel/conversas", label: "Conversas", exact: false },
  { to: "/painel/fila", label: "Fila", exact: false },
  { to: "/painel/laboratorio", label: "Lab", exact: false },
  { to: "/painel/contrato", label: "Docs", exact: false },
] as const;

export function PainelFrame() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-xs tracking-[0.18em] text-teal uppercase">Âncora B</p>
        <h1 className="mt-3 text-4xl text-paper">WhatsApp de Luís</h1>
        <p className="mt-3 text-muted">Conferindo a sessão…</p>
      </main>
    );
  }
  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
        <h1 className="text-4xl text-paper">Painel reservado</h1>
        <p className="mt-3 text-muted">Entre para ver conversas, fila e pendências.</p>
        <Link
          to="/login"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-teal px-5 font-semibold text-ink"
        >
          Entrar
        </Link>
      </main>
    );
  }
  return <Shell />;
}

function Shell() {
  const { user } = useCurrentUserState();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    let last = 0;
    let stop = false;
    const tick = () => {
      loadBoard()
        .then((board) => {
          if (stop || board.forbidden) return;
          const open = board.notices.filter((notice) => !notice.readAt).length;
          if (open > last && localStorage.getItem("ancora-sound") === "1") beep();
          if (open > last && typeof Notification !== "undefined" && Notification.permission === "granted") {
            const newest = board.notices.find((notice) => !notice.readAt);
            if (newest) new Notification(newest.title, { body: newest.body });
          }
          last = open;
          setUnread(open);
        })
        .catch(() => undefined);
    };
    tick();
    const timer = window.setInterval(tick, 15000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [user?.id]);

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pl-52">
      <aside className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink-2 md:inset-y-0 md:right-auto md:w-52 md:border-t-0 md:border-r">
        <div className="hidden px-4 py-6 md:block">
          <p className="text-xs tracking-[0.18em] text-teal uppercase">Âncora B</p>
          <p className="mt-2 text-paper">Luís</p>
          <div className="mt-4">
            <UserButton />
          </div>
        </div>
        <nav className="grid grid-cols-5 md:grid-cols-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              className="flex min-h-14 flex-col items-center justify-center text-xs text-muted data-[status=active]:text-paper md:min-h-11 md:flex-row md:justify-start md:px-4"
            >
              {item.label}
              {item.to === "/painel" && unread > 0 ? <span className="text-copper md:ml-2">{unread}</span> : null}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="mx-auto max-w-5xl px-4 py-5">
        <Outlet />
      </div>
    </div>
  );
}

function beep() {
  const audio = new AudioContext();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = 660;
  gain.gain.value = 0.04;
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + 0.12);
}
