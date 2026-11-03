import { useMemo, useState } from "react";
import { api, Job } from "../lib/api";
import { useLive } from "../lib/live";
import { CONTRACTS, relative, STATUS_LABEL } from "../lib/format";
import { Empty, Score, SectionTitle, useAction } from "../components/ui";
import { Download, Search as SearchIcon, Star } from "lucide-react";

type Sort = "score" | "date" | "company";

export default function Offers({ openJob }: { openJob: (id: number) => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [contract, setContract] = useState("");
  const [source, setSource] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState<Sort>("score");
  const { data: jobs } = useLive<Job[]>(`/jobs?archived=${showArchived}`, ["job_updated", "jobs_changed", "job_deleted"], 60000);

  const sources = useMemo(() => Array.from(new Set((jobs || []).map((j) => j.source_label))).sort(), [jobs]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let l = (jobs || []).filter((j) =>
      (!status || j.status === status) && (!contract || j.contract_type === contract) && (!source || j.source_label === source)
      && (j.match_score ?? 0) >= minScore
      && (!needle || `${j.title} ${j.company} ${j.location} ${j.description_preview}`.toLowerCase().includes(needle)));
    l = [...l].sort((a, b) => sort === "score" ? (b.match_score ?? -1) - (a.match_score ?? -1)
      : sort === "date" ? (b.posted_at || b.created_at).localeCompare(a.posted_at || a.created_at)
      : (a.company || "").localeCompare(b.company || ""));
    return l;
  }, [jobs, q, status, contract, source, minScore, sort]);

  return (
    <div>
      <SectionTitle kicker={`${list.length} offre(s) affichée(s) sur ${jobs?.length ?? 0}`}>Les offres du jour</SectionTitle>
      <ImportBox />

      <div className="mb-4 grid gap-3 border-[1.5px] border-ink p-3 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <label className="relative">
          <span className="field-label">Rechercher</span>
          <SearchIcon size={14} className="absolute bottom-2.5 left-2.5" />
          <input className="field pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="titre, entreprise, ville, mot-clé…" />
        </label>
        <Select label="Étape" value={status} onChange={setStatus} options={[["", "Toutes"], ...Object.entries(STATUS_LABEL).filter(([k]) => showArchived || k !== "archived")]} />
        <Select label="Contrat" value={contract} onChange={setContract} options={[["", "Tous"], ...CONTRACTS.map((c) => [c, c] as [string, string])]} />
        <Select label="Source" value={source} onChange={setSource} options={[["", "Toutes"], ...sources.map((s) => [s, s] as [string, string])]} />
        <Select label="Trier par" value={sort} onChange={(v) => setSort(v as Sort)} options={[["score", "Adéquation"], ["date", "Plus récentes"], ["company", "Entreprise"]]} />
        <div className="flex items-center gap-3 md:col-span-5">
          <span className="label">Score minimum</span>
          <input type="range" min={0} max={95} step={5} value={minScore} onChange={(e) => setMinScore(+e.target.value)} className="w-48 accent-[var(--ink)]" />
          <span className="font-mono text-[12px] font-bold">{minScore}</span>
          <label className="ml-auto flex items-center gap-2 font-mono text-[11px] uppercase">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Inclure les archivées
          </label>
        </div>
      </div>

      {jobs && list.length === 0 ? <Empty title="Rien ne correspond">Élargissez les filtres ou lancez une recherche.</Empty> : (
        <div className="border-[1.5px] border-ink">
          {list.map((j, i) => (
            <button key={j.id} onClick={() => openJob(j.id)}
              className={`grid w-full grid-cols-[auto_1fr] items-start gap-3 px-3 py-3 text-left hover:bg-wash md:grid-cols-[auto_1fr_170px_150px] ${i ? "border-t-[1.5px] border-ink" : ""}`}>
              <Score value={j.match_score} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {!!j.starred && <Star size={13} className="fill-navy text-navy" />}
                  <span className="font-display text-[18px] font-bold leading-tight">{j.title}</span>
                </div>
                <div className="text-[13px] text-muted">{j.company || "Employeur non affiché"} · {j.location}</div>
                {j.ai_summary ? <div className="mt-1 line-clamp-2 text-[12.5px]">{j.ai_summary}</div>
                  : <div className="mt-1 line-clamp-2 text-[12.5px] text-muted">{j.description_preview}</div>}
                {j.archived_reason && <div className="mt-1 font-mono text-[11px] uppercase text-alert">Archivée : {j.archived_reason}</div>}
              </div>
              <div className="flex flex-wrap content-start gap-1 max-md:col-start-2">
                {j.contract_type && <span className="chip">{j.contract_type}</span>}
                <span className="chip-soft">{j.source_label}</span>
                {j.salary && <span className="chip-soft">{j.salary.slice(0, 26)}</span>}
              </div>
              <div className="text-right font-mono text-[11px] uppercase max-md:col-start-2 max-md:text-left">
                <div className="font-bold">{STATUS_LABEL[j.status]}</div>
                <div className="text-muted">{relative(j.posted_at || j.created_at)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label>
      <span className="field-label">{label}</span>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function ImportBox() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const { busy, run } = useAction();
  return (
    <div className="dashed mb-4 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="label">Une offre vue ailleurs (Indeed, LinkedIn, site carrière…) ?</div>
          <div className="text-[12.5px] text-muted">Collez le lien, ou le texte de l'offre si le site bloque la lecture : l'IA l'ajoute et la note.</div>
        </div>
        <button className="btn btn-sm" onClick={() => setOpen(!open)}><Download size={13} />{open ? "Fermer" : "Importer une offre"}</button>
      </div>
      {open && (
        <div className="mt-3 grid gap-2">
          <input className="field" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <textarea className="field min-h-[90px]" placeholder="…ou collez ici le texte complet de l'offre" value={text} onChange={(e) => setText(e.target.value)} />
          <div>
            <button className="btn-ink" disabled={busy === "imp" || (!url.trim() && !text.trim())}
              onClick={() => run("imp", async () => {
                await api("/jobs/import", { body: { url, text } });
                setUrl(""); setText(""); setOpen(false);
              }, "Import lancé : l'offre apparaîtra dans Découvertes")}>Importer</button>
          </div>
        </div>
      )}
    </div>
  );
}
