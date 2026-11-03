import { useEffect, useState } from "react";

const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

export function parse(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso.includes("T") || iso.includes("Z") ? iso : iso.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

export function relative(iso?: string | null): string {
  const d = parse(iso);
  if (!d) return "—";
  const s = (d.getTime() - Date.now()) / 1000;
  const a = Math.abs(s);
  if (a < 45) return s > 0 ? "dans un instant" : "à l'instant";
  if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (a < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function clock(iso?: string | null): string {
  const d = parse(iso);
  if (!d) return "—";
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  const t = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return same ? t : `${d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} ${t}`;
}

export function shortDate(iso?: string | null): string {
  const d = parse(iso);
  return d ? d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "—";
}

export function countdown(iso?: string | null): string {
  const d = parse(iso);
  if (!d) return "";
  let s = Math.max(0, Math.round((d.getTime() - Date.now()) / 1000));
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  if (h >= 24) return `${Math.floor(h / 24)} j ${h % 24} h`;
  if (h) return `${h} h ${String(m).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Re-render every `ms` (for countdowns). */
export function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => set((x) => x + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

export const STATUS_LABEL: Record<string, string> = {
  new: "Découvertes",
  ready: "CV prêts",
  applied: "Envoyées",
  answered: "Réponses",
  interview: "Entretiens",
  archived: "Archivées",
};

export const CONTRACTS = ["CDI", "CDD", "Intérim", "Alternance", "Stage", "Freelance", "Saisonnier"];
