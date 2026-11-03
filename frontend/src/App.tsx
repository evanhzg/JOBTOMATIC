import { useEffect, useState } from "react";
import { api, Status } from "./lib/api";
import { useConnected, useLive } from "./lib/live";
import { clock, countdown, useTick } from "./lib/format";
import { Logo, ToastProvider, Toggle, useAction } from "./components/ui";
import Board from "./pages/Board";
import Offers from "./pages/Offers";
import CvStudio from "./pages/CvStudio";
import Searches from "./pages/Searches";
import Followups from "./pages/Followups";
import AiAccounts from "./pages/AiAccounts";
import SettingsPage from "./pages/Settings";
import JobDetail from "./pages/JobDetail";

const TABS = [
  { id: "tableau", label: "Tableau" },
  { id: "offres", label: "Offres" },
  { id: "cv", label: "CV" },
  { id: "recherches", label: "Recherches" },
  { id: "relances", label: "Relances" },
  { id: "ia", label: "IA & comptes" },
  { id: "reglages", label: "Réglages" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function useHashState(): [TabId, number | null, (t: TabId, job?: number | null) => void] {
  const read = () => {
    const [t, j] = location.hash.replace("#", "").split("/");
    const tab = (TABS.find((x) => x.id === t)?.id ?? "tableau") as TabId;
    return [tab, j ? Number(j) : null] as const;
  };
  const [state, setState] = useState(read);
  useEffect(() => {
    const h = () => setState(read());
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  const go = (t: TabId, job: number | null = null) => {
    location.hash = job ? `${t}/${job}` : t;
  };
  return [state[0], state[1], go];
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}

function Shell() {
  const [tab, jobId, go] = useHashState();
  const { data: status, reload } = useLive<Status>("/status", ["status", "ai_pool", "ai_account", "task", "ai_waiting", "settings", "followups"], 30000);
  const openJob = (id: number) => go(tab, id);

  return (
    <div className="mx-auto max-w-[1500px] px-3 pb-10 pt-3 sm:px-6 sm:pt-6">
      <div className="frame bg-paper/60">
        <Masthead status={status} reload={reload} go={go} />
        <nav className="grid grid-cols-4 border-b-[1.5px] border-ink sm:grid-cols-7">
          {TABS.map((t, i) => (
            <button key={t.id} onClick={() => go(t.id)}
              className={`border-ink py-3 font-mono text-[12.5px] font-bold uppercase tracking-[0.06em] transition-colors
                ${i ? "border-l-[1.5px]" : ""} ${i >= 4 ? "max-sm:border-t-[1.5px]" : ""} ${i === 4 ? "max-sm:border-l-0" : ""}
                ${tab === t.id ? "bg-ink text-cream" : "hover:bg-wash"}`}>
              {t.label}
              {t.id === "relances" && status && status.followups_manual > 0 && (
                <span className="ml-1.5 bg-navy px-1 text-cream">{status.followups_manual}</span>
              )}
            </button>
          ))}
        </nav>
        <main className="p-4 sm:p-7">
          {tab === "tableau" && <Board status={status} openJob={openJob} go={go} />}
          {tab === "offres" && <Offers openJob={openJob} />}
          {tab === "cv" && <CvStudio />}
          {tab === "recherches" && <Searches />}
          {tab === "relances" && <Followups openJob={openJob} />}
          {tab === "ia" && <AiAccounts />}
          {tab === "reglages" && <SettingsPage />}
        </main>
        <footer className="grid border-t-[1.5px] border-ink font-mono text-[11px] uppercase sm:grid-cols-3">
          <div className="px-4 py-2.5">Plonge — chasse d'emploi automatique</div>
          <div className="border-ink px-4 py-2.5 sm:border-l-[1.5px]">Le CV garde son design · l'IA n'invente rien</div>
          <div className="border-ink px-4 py-2.5 sm:border-l-[1.5px]">Données locales · {new Date().getFullYear()}</div>
        </footer>
      </div>
      <JobDetail jobId={jobId} onClose={() => go(tab)} />
    </div>
  );
}

function Masthead({ status, reload, go }: { status: Status | null; reload: () => void; go: (t: TabId) => void }) {
  useTick(1000);
  const connected = useConnected();
  const { run } = useAction();
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const set = (values: Record<string, unknown>) => run("set", async () => {
    await api("/settings", { method: "PUT", body: values });
    reload();
  });
  const ai = status?.ai;
  const waiting = ai?.state === "waiting" || !!status?.queue.waiting_until;
  const resume = ai?.resume_at || status?.queue.waiting_until;

  return (
    <header className="grid border-b-[1.5px] border-ink lg:grid-cols-[220px_1fr_300px]">
      <div className="flex items-center justify-center border-ink p-4 max-lg:hidden lg:border-r-[1.5px]">
        <Logo size={128} />
      </div>
      <div className="flex flex-col items-center justify-center px-4 py-5 text-center">
        <div className="kicker flex items-center gap-2">
          <Logo size={26} className="lg:hidden" />
          {today}
          <span title={connected ? "Connecté en direct" : "Reconnexion…"} className={`inline-block h-2 w-2 ${connected ? "bg-navy" : "bg-alert animate-pulse"}`} />
        </div>
        <h1 className="mt-1 font-mono text-[clamp(52px,9vw,104px)] font-bold leading-none tracking-[0.12em]">PLONGE</h1>
        <div className="mt-2 font-mono text-[clamp(13px,1.6vw,19px)] font-bold uppercase tracking-[0.08em]">Candidatures fraîches, CV sur mesure</div>
      </div>
      <div className="grid grid-rows-[auto_auto_1fr] border-t-[1.5px] border-ink text-[13px] lg:border-l-[1.5px] lg:border-t-0">
        <div className="flex items-center justify-between gap-2 px-4 py-2.5">
          <Toggle on={!!status?.autopilot} onChange={(v) => set({ autopilot_enabled: v })} label="Pilote auto" />
          <button className={status?.paused ? "btn-navy btn-sm" : "btn btn-sm"} onClick={() => set({ paused: !status?.paused })}>
            {status?.paused ? "Reprendre" : "Pause"}
          </button>
        </div>
        <button onClick={() => go("ia")} className={`border-t-[1.5px] border-ink px-4 py-2 text-left ${waiting ? "bg-navy text-cream" : "hover:bg-wash"}`}>
          <div className="label">IA · {ai ? `${ai.available}/${ai.total} comptes dispo` : "…"}</div>
          <div className="font-mono text-[12px]">
            {!ai ? "…" : waiting && resume ? `Limite atteinte · reprise auto dans ${countdown(resume)}`
              : ai.state === "down" ? "Aucun compte utilisable" : status?.queue.running ? `En cours : ${status.queue.running.label}`
              : (status?.queue.counts.queued ?? 0) > 0 ? `${status?.queue.counts.queued} tâche(s) en file` : "Prête"}
          </div>
        </button>
        <div className="space-y-1 border-t-[1.5px] border-ink px-4 py-2">
          <Row k="Prochaine recherche" v={status?.searches_running.length ? "en cours…" : status?.next_search_at ? clock(status.next_search_at) : "—"} />
          <Row k="Prochaine relance" v={status?.next_followup_at ? clock(status.next_followup_at) : "—"} />
          <Row k="Envois aujourd'hui" v={status ? `${status.applications_today}/${status.daily_limit}` : "—"} />
        </div>
      </div>
    </header>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="leader text-[11.5px]">
      <span>{k}</span>
      <span className="dots" />
      <span className="font-bold">{v}</span>
    </div>
  );
}
