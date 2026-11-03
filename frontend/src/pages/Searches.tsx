import { useState } from "react";
import { api, Search, Source } from "../lib/api";
import { useLive } from "../lib/live";
import { clock, CONTRACTS, relative } from "../lib/format";
import { Empty, SectionTitle, Toggle, useAction } from "../components/ui";
import { Play, Plus, Trash2, Pencil, X, KeyRound } from "lucide-react";

const QUICK_CITIES = ["Rouen", "Le Havre", "Caen", "Paris", "Lyon", "Annecy", "Télétravail"];
const REMOTE: [string, string][] = [["any", "Peu importe"], ["hybrid_ok", "Hybride OK"], ["remote_only", "Télétravail seulement"], ["onsite", "Sur site"]];

const blank = (): Omit<Search, "id" | "total_found" | "new_last_run"> => ({
  label: "", query: "", locations: ["Lyon"], radius_km: 30, contract_types: [], remote: "any", max_age_days: 14,
  sources: [], exclude_keywords: [], include_keywords: [], active: true, interval_mins: null,
});

export default function Searches() {
  const { data: searches, reload } = useLive<Search[]>("/searches", ["searches_changed", "search_running", "jobs_changed"], 30000);
  const { data: sources, reload: reloadSources } = useLive<Source[]>("/sources", [], 300000);
  const [editing, setEditing] = useState<null | (ReturnType<typeof blank> & { id?: number })>(null);
  const { busy, run } = useAction();

  return (
    <div>
      <SectionTitle kicker="Chaque recherche est relancée automatiquement ; les nouvelles offres sont notées par l'IA"
        right={<div className="flex gap-2">
          <button className="btn" disabled={!searches?.length} onClick={() => run("all", () => api("/searches/run-all", { method: "POST" }), "Toutes les recherches sont lancées")}><Play size={13} />Tout relancer</button>
          <button className="btn-ink" onClick={() => setEditing(blank())}><Plus size={13} />Nouvelle recherche</button>
        </div>}>
        Recherches
      </SectionTitle>

      {editing && <SearchForm value={editing} sources={sources || []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}

      {searches && searches.length === 0 && !editing && (
        <Empty title="Aucune recherche">Décrivez un métier, des villes et des contrats. Exemple : « serveur », Lyon + Annecy, CDI/Saisonnier.</Empty>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {(searches || []).map((s) => (
          <article key={s.id} className={`border-[1.5px] border-ink ${s.active ? "" : "opacity-60"}`}>
            <header className="flex flex-wrap items-start justify-between gap-3 border-b-[1.5px] border-ink p-3">
              <div className="min-w-0">
                <h3 className="display truncate text-[26px]">{s.label || s.query}</h3>
                <div className="kicker mt-1 text-[11px]">
                  « {s.query} » · {(s.locations.length ? s.locations : ["France"]).join(", ")} · {s.radius_km} km · {s.max_age_days} j
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(s.contract_types.length ? s.contract_types : ["Tous contrats"]).map((c) => <span key={c} className="chip">{c}</span>)}
                  {s.remote !== "any" && <span className="chip-soft">{REMOTE.find((r) => r[0] === s.remote)?.[1]}</span>}
                  {s.exclude_keywords.map((k) => <span key={k} className="chip-soft line-through">{k}</span>)}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2 max-sm:w-full max-sm:flex-row max-sm:justify-between">
                <Toggle on={!!s.active} onChange={(v) => run("t", async () => { await api(`/searches/${s.id}`, { method: "PUT", body: { ...s, active: v } }); reload(); })} label="Auto" />
                <div className="flex gap-1">
                  <button className="btn btn-sm" disabled={s.running} onClick={() => run("r", () => api(`/searches/${s.id}/run`, { method: "POST" }), "Recherche lancée")}><Play size={12} />{s.running ? "En cours…" : "Lancer"}</button>
                  <button className="btn btn-sm" onClick={() => setEditing({ ...s, active: !!s.active })} aria-label="Modifier"><Pencil size={12} /></button>
                  <button className="btn btn-sm" onClick={() => run("d", async () => { await api(`/searches/${s.id}`, { method: "DELETE" }); reload(); })} aria-label="Supprimer"><Trash2 size={12} /></button>
                </div>
              </div>
            </header>
            <div className="grid grid-cols-3 border-b-[1.5px] border-ink font-mono text-[11px] uppercase">
              <div className="p-2.5"><div className="text-muted">Dernière</div><div className="font-bold">{relative(s.last_run_at)}</div></div>
              <div className="border-l-[1.5px] border-ink p-2.5"><div className="text-muted">Prochaine</div><div className="font-bold">{s.active ? clock(s.next_run_at) : "désactivée"}</div></div>
              <div className="border-l-[1.5px] border-ink p-2.5"><div className="text-muted">Nouvelles</div><div className="font-bold">{s.new_last_run} · total {s.total_found}</div></div>
            </div>
            <div className="p-3">
              <div className="label mb-1.5">Sources au dernier passage</div>
              {!s.last_report?.length ? <div className="font-mono text-[11px] uppercase text-muted">Pas encore lancée</div> : (
                <div className="space-y-1">
                  {s.last_report.map((r, i) => (
                    <div key={i} className="leader text-[11.5px]" title={r.error || r.skipped}>
                      <span className="min-w-0 truncate">{r.label} · {r.location}</span><span className="dots min-w-[12px]" />
                      <span className={`font-bold ${r.ok ? "" : r.skipped ? "text-muted" : "text-alert"}`}>
                        {r.ok ? `${r.count} offre(s)` : r.skipped ? r.skipped : `erreur : ${r.error.slice(0, 60)}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      <SourcesPanel sources={sources || []} reload={reloadSources} busy={busy} run={run} />
    </div>
  );
}

function SearchForm({ value, sources, onClose, onSaved }: { value: ReturnType<typeof blank> & { id?: number }; sources: Source[]; onClose: () => void; onSaved: () => void }) {
  const [s, setS] = useState(value);
  const [city, setCity] = useState("");
  const { busy, run } = useAction();
  const set = (k: string, v: any) => setS((x) => ({ ...x, [k]: v }));
  const toggleIn = (k: "contract_types" | "sources" | "locations", v: string) =>
    set(k, (s[k] as string[]).includes(v) ? (s[k] as string[]).filter((x) => x !== v) : [...(s[k] as string[]), v]);
  const addCity = () => { const c = city.trim(); if (c && !s.locations.includes(c)) set("locations", [...s.locations, c]); setCity(""); };

  return (
    <div className="mb-6 border-[1.5px] border-ink bg-cream shadow-[6px_6px_0_var(--ink)]">
      <div className="flex items-center justify-between border-b-[1.5px] border-ink p-3">
        <h3 className="display text-[26px]">{s.id ? "Modifier la recherche" : "Nouvelle recherche"}</h3>
        <button className="btn btn-sm" onClick={onClose}><X size={13} /></button>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <label><span className="field-label">Métier / mots-clés *</span>
          <input className="field" value={s.query} onChange={(e) => set("query", e.target.value)} placeholder="serveur, commis de cuisine, développeur web…" autoFocus />
        </label>
        <label><span className="field-label">Nom (optionnel)</span>
          <input className="field" value={s.label} onChange={(e) => set("label", e.target.value)} placeholder="ex : Restauration Lyon" />
        </label>
        <div className="md:col-span-2">
          <span className="field-label">Villes (une recherche par ville ; vide = toute la France)</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {s.locations.map((c) => <button key={c} className="chip-on" onClick={() => toggleIn("locations", c)}>{c} ×</button>)}
            <input className="field !w-44 !py-1" value={city} onChange={(e) => setCity(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCity())} placeholder="+ ville, Entrée" />
            {QUICK_CITIES.filter((c) => !s.locations.includes(c)).map((c) => <button key={c} className="chip-soft hover:border-ink hover:text-ink" onClick={() => set("locations", [...s.locations, c])}>+ {c}</button>)}
          </div>
        </div>
        <label><span className="field-label">Rayon : {s.radius_km} km</span>
          <input type="range" min={0} max={100} step={5} value={s.radius_km} onChange={(e) => set("radius_km", +e.target.value)} className="w-full accent-[var(--ink)]" />
        </label>
        <label><span className="field-label">Publiées depuis : {s.max_age_days} jours max</span>
          <input type="range" min={1} max={31} value={s.max_age_days} onChange={(e) => set("max_age_days", +e.target.value)} className="w-full accent-[var(--ink)]" />
        </label>
        <div><span className="field-label">Contrats (aucun = tous)</span>
          <div className="flex flex-wrap gap-1.5">{CONTRACTS.map((c) => <button key={c} className={s.contract_types.includes(c) ? "chip-on" : "chip"} onClick={() => toggleIn("contract_types", c)}>{c}</button>)}</div>
        </div>
        <div><span className="field-label">Télétravail</span>
          <div className="seg">{REMOTE.map(([k, l]) => <button key={k} data-on={s.remote === k} onClick={() => set("remote", k)}>{l}</button>)}</div>
        </div>
        <label><span className="field-label">Exclure les offres contenant (virgules)</span>
          <input className="field" defaultValue={s.exclude_keywords.join(", ")} onBlur={(e) => set("exclude_keywords", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} placeholder="nuit, CACES, senior" />
        </label>
        <label><span className="field-label">Doit contenir l'un de (optionnel)</span>
          <input className="field" defaultValue={s.include_keywords.join(", ")} onBlur={(e) => set("include_keywords", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} placeholder="React, brasserie" />
        </label>
        <div className="md:col-span-2"><span className="field-label">Sources (aucune cochée = toutes celles configurées)</span>
          <div className="flex flex-wrap gap-1.5">
            {sources.map((src) => (
              <button key={src.key} disabled={!src.configured} title={src.configured ? src.help : "Identifiants requis : voir plus bas"}
                className={s.sources.includes(src.key) ? "chip-on" : "chip disabled:opacity-40"} onClick={() => toggleIn("sources", src.key)}>{src.label}</button>
            ))}
          </div>
        </div>
        <label><span className="field-label">Relancer toutes les</span>
          <select className="field" value={s.interval_mins ?? ""} onChange={(e) => set("interval_mins", e.target.value ? +e.target.value : null)}>
            <option value="">Réglage global</option><option value="60">1 heure</option><option value="180">3 heures</option><option value="360">6 heures</option><option value="720">12 heures</option><option value="1440">24 heures</option>
          </select>
        </label>
        <div className="flex items-end justify-end gap-2">
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn-ink" disabled={!s.query.trim() || busy === "save"} onClick={() => run("save", async () => {
            if (s.id) await api(`/searches/${s.id}`, { method: "PUT", body: s }); else await api("/searches", { body: s });
            onSaved();
          }, s.id ? "Recherche modifiée" : "Recherche créée et lancée")}>{s.id ? "Enregistrer" : "Créer et lancer"}</button>
        </div>
      </div>
    </div>
  );
}

function SourcesPanel({ sources, reload, busy, run }: { sources: Source[]; reload: () => void; busy: string | null; run: (k: string, f: () => Promise<any>, ok?: string) => Promise<any> }) {
  const [vals, setVals] = useState<Record<string, Record<string, string>>>({});
  return (
    <section className="mt-10">
      <h3 className="display text-[30px]">Sources</h3>
      <p className="mb-3 max-w-3xl text-[13px] text-muted">Plonge n'utilise que des sources publiques ou des API officielles, et n'invente jamais d'offre :
        si une source échoue, c'est affiché tel quel. Pour Indeed ou LinkedIn, importez l'offre par son lien (onglet Offres).</p>
      <div className="grid gap-3 md:grid-cols-2">
        {sources.map((s) => {
          const keys = [...s.required_credentials, ...(s.optional_credentials || [])];
          return (
            <div key={s.key} className="border-[1.5px] border-ink p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-display text-[19px] font-bold">{s.label}</div>
                <span className={s.configured ? "chip-navy" : "chip border-alert text-alert"}>{s.configured ? "active" : "clé requise"}</span>
              </div>
              <p className="mt-1 text-[12.5px] text-muted">{s.help}</p>
              {keys.length > 0 && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {keys.map((k) => (
                    <label key={k}><span className="field-label">{k}{s.required_credentials.includes(k) ? " *" : " (optionnel)"}</span>
                      <input className="field" type="password" placeholder={(s as any).has_credentials?.includes(k) ? "•••••• enregistré" : ""}
                        onChange={(e) => setVals((v) => ({ ...v, [s.key]: { ...(v[s.key] || {}), [k]: e.target.value } }))} />
                    </label>
                  ))}
                  <div className="sm:col-span-2">
                    <button className="btn btn-sm" disabled={!vals[s.key] || busy === s.key}
                      onClick={() => run(s.key, async () => { await api("/sources/credentials", { method: "PUT", body: { [s.key]: vals[s.key] } }); setVals((v) => ({ ...v, [s.key]: undefined as any })); reload(); }, "Identifiants enregistrés")}>
                      <KeyRound size={12} />Enregistrer
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
