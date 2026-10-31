const TZ = "America/Araguaina";

export function palmasClock(date: Date): { hour: number; minute: number; dayKey: string } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

export function isInsideWindow(date: Date, start = "08:00", end = "18:00"): boolean {
  const { hour, minute } = palmasClock(date);
  const current = hour * 60 + minute;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return current >= sh * 60 + sm && current <= eh * 60 + em;
}

/** Next 08:00 in Palmas, expressed as a UTC ISO instant. */
export function nextDaytimeIso(date: Date, start = "08:00"): string {
  const { dayKey, hour, minute } = palmasClock(date);
  const [sh, sm] = start.split(":").map(Number);
  const current = hour * 60 + minute;
  const startMin = sh * 60 + sm;
  const [year, month, day] = dayKey.split("-").map(Number);
  const extra = current <= startMin ? 0 : 1;
  const utc = new Date(Date.UTC(year, month - 1, day + extra, sh + 3, sm, 0));
  return utc.toISOString();
}

export function formatPalmas(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
