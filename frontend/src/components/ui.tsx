import { ReactNode, useEffect, useState, createContext, useContext, useCallback } from "react";
import { X } from "lucide-react";

/** Simplified Wash Rotom: front-loading washer, porthole face, plasma bolts. */
export function Logo({ size = 64, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} fill="none" stroke="currentColor"
      strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Plonge">
      <path d="M44 33 L36 22 L46 21 L38 8" />
      <path d="M76 33 L84 22 L74 21 L82 8" />
      <path d="M22 66 L11 60 L15 72 L5 70" />
      <path d="M98 66 L109 60 L105 72 L115 70" />
      <rect x="22" y="33" width="76" height="76" rx="13" />
      <path d="M22 50 H98" />
      <circle cx="86" cy="41.5" r="1.6" fill="currentColor" />
      <circle cx="60" cy="80" r="20" />
      <ellipse cx="52.5" cy="77" rx="3.4" ry="5.2" fill="var(--navy)" stroke="var(--navy)" strokeWidth="2" />
      <ellipse cx="67.5" cy="77" rx="3.4" ry="5.2" fill="var(--navy)" stroke="var(--navy)" strokeWidth="2" />
      <path d="M54 88 Q60 92 66 88" strokeWidth="4.5" />
    </svg>
  );
}

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!on)}
      className="inline-flex items-center gap-2 disabled:opacity-40" aria-pressed={on}>
      <span className={`relative h-[18px] w-[34px] border-[1.5px] border-ink ${on ? "bg-ink" : "bg-cream"}`}>
        <span className={`absolute top-[2px] h-[11px] w-[11px] transition-all ${on ? "left-[18px] bg-cream" : "left-[2px] bg-ink"}`} />
      </span>
      {label && <span className="label">{label}</span>}
    </button>
  );
}

export function Score({ value, size = "md" }: { value: number | null | undefined; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-14 w-14 text-[22px]" : size === "sm" ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-[13px]";
  if (value === null || value === undefined)
    return <span className={`inline-flex ${dims} items-center justify-center border-[1.5px] border-dashed border-ink/50 font-mono text-muted`} title="Pas encore évaluée">?</span>;
  const cls = value >= 75 ? "bg-navy text-cream border-navy" : value >= 55 ? "bg-cream text-ink border-ink" : "bg-transparent text-muted border-ink/40";
  return <span className={`inline-flex ${dims} shrink-0 items-center justify-center border-[1.5px] font-mono font-bold ${cls}`} title="Adéquation estimée par l'IA">{value}</span>;
}

export function SectionTitle({ children, kicker, right }: { children: ReactNode; kicker?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="display text-[clamp(30px,4vw,52px)]">{children}</h2>
        {kicker && <div className="kicker mt-2">{kicker}</div>}
      </div>
      {right}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="dashed flex flex-col items-center gap-2 px-6 py-10 text-center">
      <Logo size={46} className="text-ink/70" />
      <div className="display text-[22px]">{title}</div>
      {children && <div className="max-w-md text-[13px] text-muted">{children}</div>}
    </div>
  );
}

export function Modal({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" onMouseDown={onClose}>
      <div className={`relative h-full w-full overflow-y-auto border-l-[1.5px] border-ink bg-paper ${wide ? "max-w-[1180px]" : "max-w-[720px]"}`}
        onMouseDown={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="btn btn-sm absolute right-4 top-4 z-10 bg-cream" aria-label="Fermer"><X size={14} /></button>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- toasts

type Toast = { id: number; text: string; kind: "ok" | "err" | "info" };
const ToastCtx = createContext<(text: string, kind?: Toast["kind"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "err" ? 7000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`frame px-3 py-2 text-[13px] shadow-[4px_4px_0_var(--ink)] ${t.kind === "err" ? "bg-alert text-cream" : t.kind === "info" ? "bg-cream" : "bg-navy text-cream border-navy"}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Run an async action with a busy flag and an error toast. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(async (key: string, fn: () => Promise<any>, ok?: string) => {
    setBusy(key);
    try {
      const r = await fn();
      if (ok) toast(ok);
      return r;
    } catch (e: any) {
      toast(e.message || String(e), "err");
    } finally {
      setBusy(null);
    }
  }, [toast]);
  return { busy, run };
}

export function Leader({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="leader">
      <span>{left}</span>
      <span className="dots" />
      <span className="text-right">{right}</span>
    </div>
  );
}

export function Bar({ value, label }: { value: number; label?: ReactNode }) {
  return (
    <div>
      {label && <div className="mb-1 flex justify-between font-mono text-[11px] uppercase"><span>{label}</span><span className="font-bold">{value}</span></div>}
      <div className="h-[9px] border-[1.5px] border-ink bg-cream">
        <div className={`h-full ${value >= 75 ? "bg-navy" : "bg-ink"}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
