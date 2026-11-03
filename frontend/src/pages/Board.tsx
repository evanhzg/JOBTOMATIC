import { useMemo, useState } from "react";
import { api, Job, Status } from "../lib/api";
import { useLive } from "../lib/live";
import { STATUS_LABEL } from "../lib/format";
import JobCard from "../components/JobCard";
import { Empty, useAction } from "../components/ui";
import { Send } from "lucide-react";

const COLUMNS: { id: string; hint: string }[] = [
  { id: "new", hint: "Trouvées par les recherches, notées par l'IA" },
  { id: "ready", hint: "CV adapté + lettre, en attente de votre feu vert" },
  { id: "applied", hint: "Envoyées — relances programmées" },
  { id: "answered", hint: "Le recruteur a répondu" },
  { id: "interview", hint: "Entretiens décrochés" },
];

export default function Board({ status, openJob, go }: { status: Status | null; openJob: (id: number) => void; go: (t: any) => void }) {
  const { data: jobs, reload } = useLive<Job[]>("/jobs", ["job_updated", "jobs_changed", "job_deleted", "followups"], 45000);
  const { busy, run } = useAction();
  const [minScore, setMinScore] = useState(0);

  const by = useMemo(() => {
    const m: Record<string, Job[]> = {};
    for (const c of COLUMNS) m[c.id] = [];
    for (const j of jobs || []) {
      if (j.status === "new" && (j.match_score ?? 100) < minScore) continue;
      m[j.status]?.push(j);
    }
    return m;
  }, [jobs, minScore]);

  const readyEmail = (jobs || []).filter((j) => j.status === "ready" && j.contact_email).length;
  const unscored = (jobs || []).filter((j) => j.status === "new" && j.match_score === null).length;

  if (jobs && jobs.length === 0)
    return (
      <Empty title="Aucune offre pour l'instant">
        Créez une recherche (métier, villes, contrats) : Plonge interroge France Travail, La bonne alternance et vos
        autres sources, puis l'IA note chaque offre.
        <div className="mt-4"><button className="btn-ink" onClick={() => go("recherches")}>Créer une recherche</button></div>
      </Empty>
    );

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-[1.5px] border-[1.5px] border-ink bg-ink md:grid-cols-5">
        <Kpi n={by.new?.length ?? 0} label="à trier" sub={unscored ? `${unscored} pas encore notée(s)` : "toutes notées"} />
        <Kpi n={by.ready?.length ?? 0} label="CV prêts" sub={readyEmail ? `${readyEmail} envoyables par email` : "aucun envoi en attente"} />
        <Kpi n={status?.applications_today ?? 0} label="envoyées aujourd'hui" sub={`limite ${status?.daily_limit ?? "—"}`} />
        <Kpi n={status?.followups_manual ?? 0} label="relances à faire" sub={`${status?.followups_scheduled ?? 0} programmées`} />
        <Kpi n={(by.answered?.length ?? 0) + (by.interview?.length ?? 0)} label="réponses" sub={`${by.interview?.length ?? 0} entretien(s)`} />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="label">Score min. découvertes</span>
          <input type="range" min={0} max={90} step={5} value={minScore} onChange={(e) => setMinScore(+e.target.value)} className="accent-[var(--ink)]" />
          <span className="font-mono text-[12px] font-bold">{minScore}</span>
        </div>
        <button className="btn-navy" disabled={!readyEmail || busy === "send"}
          onClick={() => run("send", async () => {
            const r = await api<{ sent: number; errors: string[] }>("/jobs/apply-ready", { method: "POST" });
            reload();
            if (r.errors.length) throw new Error(`${r.sent} envoyée(s). ${r.errors[0]}`);
            return r;
          }, "Candidatures envoyées")}>
          <Send size={13} /> Envoyer les {readyEmail} CV prêts par email
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {COLUMNS.map((c) => (
          <section key={c.id} className="flex min-h-[260px] min-w-0 flex-col border-[1.5px] border-ink">
            <header className="border-b-[1.5px] border-ink px-3 pb-2 pt-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="display text-[24px]">{STATUS_LABEL[c.id]}</h3>
                <span className="font-mono text-[18px] font-bold">{by[c.id]?.length ?? 0}</span>
              </div>
              <div className="kicker mt-1 text-[10.5px] text-muted">{c.hint}</div>
            </header>
            <div className="flex max-h-[68vh] flex-1 flex-col gap-2 overflow-y-auto p-2">
              {(by[c.id] || []).map((j) => <JobCard key={j.id} job={j} onOpen={() => openJob(j.id)} compact={c.id !== "new"} />)}
              {jobs && (by[c.id] || []).length === 0 && <div className="m-auto py-6 font-mono text-[11px] uppercase text-muted">— vide —</div>}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Kpi({ n, label, sub }: { n: number; label: string; sub: string }) {
  return (
    <div className="bg-paper px-4 py-3 max-md:last:col-span-2">
      <div className="font-display text-[40px] font-extrabold leading-none">{n}</div>
      <div className="label mt-1">{label}</div>
      <div className="font-mono text-[10.5px] uppercase text-muted">{sub}</div>
    </div>
  );
}
