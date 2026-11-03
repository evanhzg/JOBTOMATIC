import { useEffect, useMemo, useRef, useState } from "react";
import { api, CvState, Profile, Suggestion, Task } from "../lib/api";
import { useEvents, useLive } from "../lib/live";
import { relative } from "../lib/format";
import { Bar, Empty, SectionTitle, useAction } from "../components/ui";
import { Upload, Wand2, Save, Eye, Check, X, RotateCw, Pencil } from "lucide-react";

const AXES: Record<string, string> = {
  pertinence: "Pertinence pour la cible",
  impact: "Impact & concret",
  mots_cles: "Mots-clés attendus",
  lisibilite: "Lisibilité",
  accroche: "Accroche",
};

export default function CvStudio() {
  const { data, reload } = useLive<CvState>("/cv", ["cv_updated", "profile_updated"], 120000);
  const [pendingTask, setPendingTask] = useState<number | null>(null);
  const [taskState, setTaskState] = useState<Task | null>(null);
  useEvents((type, d) => {
    if (type === "task" && d && d.id === pendingTask) {
      setTaskState(d);
      if (d.status === "done" || d.status === "failed") reload();
    }
  });

  if (!data) return <div className="font-mono uppercase">Chargement…</div>;
  if (!data.master) return <UploadPanel onDone={(t) => { setPendingTask(t); reload(); }} first />;

  return (
    <div>
      <SectionTitle kicker={`Version principale : ${data.master.label} · ${relative(data.master.created_at)}`}
        right={<UploadPanel onDone={(t) => { setPendingTask(t); reload(); }} />}>
        Votre CV
      </SectionTitle>
      {taskState && (taskState.status === "queued" || taskState.status === "running") && (
        <div className="mb-4 border-[1.5px] border-navy bg-wash px-3 py-2 font-mono text-[12px] uppercase text-navy">
          {taskState.label} : {taskState.status === "running" ? "en cours…" : taskState.run_after ? "en attente de l'IA (reprise automatique)" : "dans la file"}
        </div>
      )}
      <Optimizer data={data} onTask={setPendingTask} taskState={taskState} reload={reload} />
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1fr]">
        <Versions data={data} reload={reload} />
        <ProfileForm profile={data.profile} onTask={setPendingTask} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- upload

function UploadPanel({ onDone, first }: { onDone: (taskId: number) => void; first?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const { busy, run } = useAction();
  const pick = () => input.current?.click();
  const send = (f: File) => run("up", async () => {
    const form = new FormData();
    form.append("file", f);
    const r = await api<{ task_id: number }>("/cv/upload", { form });
    onDone(r.task_id);
  }, "CV importé — lecture du profil en cours");
  const control = (
    <>
      <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
      <button className={first ? "btn-ink" : "btn btn-sm"} onClick={pick} disabled={busy === "up"}><Upload size={13} />{busy ? "Import…" : first ? "Importer mon CV (PDF)" : "Importer un nouveau CV"}</button>
    </>
  );
  if (!first) return control;
  return (
    <Empty title="Importez votre CV">
      Exportez-le en PDF depuis Canva, Word ou autre. Plonge garde exactement son design : polices, couleurs, colonnes, photo.
      Seul le texte est adapté à chaque offre.
      <div className="mt-4">{control}</div>
    </Empty>
  );
}

// ---------------------------------------------------------------- optimizer

function Optimizer({ data, onTask, taskState, reload }: { data: CvState; onTask: (id: number) => void; taskState: Task | null; reload: () => void }) {
  const audit = data.master!.audit;
  const [target, setTarget] = useState(audit?.target || data.profile.target_roles?.join(", ") || "");
  const [accepted, setAccepted] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ token: string; pages: number; result: any; measured: any } | null>(null);
  const [label, setLabel] = useState("");
  const { busy, run } = useAction();
  const debounce = useRef<number | null>(null);

  useEffect(() => { setAccepted({}); setPreview(null); }, [audit?.at]);

  // Live preview of the accepted changes, rendered in the real design.
  useEffect(() => {
    if (debounce.current) window.clearTimeout(debounce.current);
    if (!Object.keys(accepted).length) { setPreview(null); return; }
    debounce.current = window.setTimeout(async () => {
      try { setPreview(await api("/cv/preview", { body: { edits: accepted } })); } catch { /* shown on save */ }
    }, 600);
  }, [accepted]);

  const auditing = taskState && (taskState.status === "queued" || taskState.status === "running") && taskState.kind === "audit";
  const overflow: string[] = preview?.result?.overflow || [];
  const short: string[] = preview?.result?.short || [];
  const measured = audit?.measured || data.master!.measured;
  const after = preview?.measured;

  return (
    <section className="border-[1.5px] border-ink">
      <header className="grid gap-3 border-b-[1.5px] border-ink p-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h3 className="display text-[30px]">Optimiseur</h3>
          <p className="mt-1 max-w-2xl text-[13px] text-muted">Audit honnête de votre CV pour une cible, puis réécritures bloc par bloc. Chaque proposition
            s'aperçoit dans votre vrai design avant d'être gardée. Rien n'est inventé : ce qui manque devient une question.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[260px]"><span className="field-label">Cible</span>
            <input className="field" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="ex : serveur en brasserie, développeur web junior" />
          </label>
          <button className="btn-ink" disabled={!!auditing || busy === "audit"}
            onClick={() => run("audit", async () => { const r = await api<{ task_id: number }>("/cv/audit", { body: { target } }); onTask(r.task_id); })}>
            <Wand2 size={13} />{auditing ? "Audit en cours…" : audit ? "Refaire l'audit" : "Lancer l'audit"}
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,430px)]">
        <div className="border-ink p-4 lg:border-r-[1.5px]">
          {!audit ? (
            <p className="py-8 text-center font-mono text-[12px] uppercase text-muted">Lancez un audit pour obtenir des propositions.</p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
                <div className="space-y-3">
                  {Object.entries(audit.scores).map(([k, v]) => (
                    <div key={k}>
                      <Bar value={v.score} label={AXES[k] || k} />
                      <div className="mt-0.5 text-[11.5px] text-muted">{v.why}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="label mb-2">Mesures (calculées, pas estimées)</div>
                  <Measure k="Mots-clés de la cible présents" v={measured.couverture_mots_cles_pct} after={after?.couverture_mots_cles_pct} unit="%" />
                  <Measure k="Puces commençant par une action" v={measured.puces_verbe_action_pct} after={after?.puces_verbe_action_pct} unit="%" />
                  <Measure k="Puces avec un chiffre" v={measured.puces_chiffrees_pct} after={after?.puces_chiffrees_pct} unit="%" />
                  <Measure k="Puces trop longues" v={measured.puces_trop_longues} after={after?.puces_trop_longues} />
                  {!!measured.mots_cles_absents?.length && (
                    <div className="mt-2 text-[12px]"><span className="label">Absents : </span>{measured.mots_cles_absents.join(", ")}</div>
                  )}
                  <p className="mt-3 border-l-[3px] border-navy pl-3 text-[13px] italic">{audit.verdict}</p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="label">{audit.suggestions.length} proposition(s) — {Object.keys(accepted).length} retenue(s)</div>
                <div className="flex gap-2">
                  <button className="btn-ghost" onClick={() => setAccepted(Object.fromEntries(audit.suggestions.filter((s) => s.fits).map((s) => [s.id, s.text])))}>Tout retenir</button>
                  <button className="btn-ghost" onClick={() => setAccepted({})}>Tout retirer</button>
                </div>
              </div>
              <div className="mt-2 space-y-2">
                {audit.suggestions.map((s) => (
                  <SuggestionRow key={s.id} s={s} value={accepted[s.id]} overflow={overflow.includes(s.id)} short={short.includes(s.id)} editing={editing === s.id}
                    onEdit={() => setEditing(editing === s.id ? null : s.id)}
                    onChange={(v) => setAccepted((a) => {
                      const n = { ...a };
                      if (v === null) delete n[s.id]; else n[s.id] = v;
                      return n;
                    })} />
                ))}
              </div>
              {!!audit.questions?.length && (
                <div className="dashed mt-5 p-3">
                  <div className="label mb-1">Pour aller plus loin, l'IA a besoin de vous</div>
                  <ul className="space-y-1 text-[13px]">{audit.questions.map((q, i) => <li key={i}>— {q}</li>)}</ul>
                  <div className="mt-2 text-[12px] text-muted">Ajoutez ces informations dans le texte d'une proposition (bouton crayon), elles seront gardées.</div>
                </div>
              )}
            </>
          )}
        </div>

        <aside className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="label flex items-center gap-1.5"><Eye size={12} />{preview ? "Aperçu avec vos choix" : "Version actuelle"}</div>
            <span className="flex gap-1">
              {overflow.length > 0 && <span className="chip border-alert text-alert">{overflow.length} trop long(s)</span>}
              {short.length > 0 && <span className="chip-soft">{short.length} laisse(nt) un blanc</span>}
            </span>
          </div>
          <div className="border-[1.5px] border-ink bg-cream">
            {Array.from({ length: preview?.pages || data.master!.pages }).map((_, n) => (
              <img key={`${preview?.token}-${n}`} className="w-full" alt={`CV page ${n + 1}`}
                src={preview ? `/api/cv/preview/${preview.token}/page/${n}.png?dpi=120` : `/api/cv/versions/${data.master!.id}/page/${n}.png?dpi=120`} />
            ))}
          </div>
          {Object.keys(accepted).length > 0 && (
            <div className="mt-3 grid gap-2">
              <input className="field" placeholder="Nom de la version (ex : Restauration — nov.)" value={label} onChange={(e) => setLabel(e.target.value)} />
              <button className="btn-navy" disabled={busy === "save" || overflow.length > 0}
                onClick={() => run("save", async () => { await api("/cv/save", { body: { edits: accepted, label: label || `Optimisée — ${target}` } }); setAccepted({}); reload(); }, "Nouvelle version enregistrée et utilisée pour les candidatures")}>
                <Save size={13} />Enregistrer comme version principale
              </button>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function Measure({ k, v, after, unit = "" }: { k: string; v: any; after?: any; unit?: string }) {
  if (v === undefined || v === null) return null;
  const changed = after !== undefined && after !== null && after !== v;
  return (
    <div className="leader text-[11.5px]">
      <span>{k}</span><span className="dots" />
      <span className="font-bold">{v}{unit}{changed && <span className="text-navy"> → {after}{unit}</span>}</span>
    </div>
  );
}

function SuggestionRow({ s, value, onChange, overflow, short, editing, onEdit }: {
  s: Suggestion; value?: string; onChange: (v: string | null) => void; overflow: boolean; short: boolean; editing: boolean; onEdit: () => void;
}) {
  const on = value !== undefined;
  const text = value ?? s.text;
  const len = text.replace(/\*\*/g, "").length;
  return (
    <div className={`border-[1.5px] p-2.5 ${on ? "border-navy bg-wash" : "border-ink bg-cream"}`}>
      <div className="flex items-start gap-2">
        <button onClick={() => onChange(on ? null : s.text)} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border-[1.5px] ${on ? "border-navy bg-navy text-cream" : "border-ink"}`}
          aria-label={on ? "Retirer" : "Retenir"}>{on ? <Check size={12} /> : null}</button>
        <div className="min-w-0 flex-1 text-[12.5px]">
          <div className="text-muted line-through decoration-ink/40">{s.before.replace(/\*\*/g, "")}</div>
          {editing ? (
            <textarea className="field mt-1 min-h-[64px] text-[12.5px]" value={text} onChange={(e) => onChange(e.target.value)} />
          ) : (
            <div className="mt-1 font-medium">{text.replace(/\*\*/g, "")}</div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase">
            <span className="chip-soft">{AXES[s.axis] || s.axis}</span>
            <span className={s.gain === "fort" ? "chip-navy" : "chip-soft"}>gain {s.gain}</span>
            <span className={len > s.max_chars || overflow ? "text-alert" : "text-muted"}>{len}/{s.max_chars} car.{overflow ? " — ne rentre pas" : ""}</span>
            {short && <span className="text-[#9a6b00]">plus court que l'original : laisse un blanc</span>}
            <span className="text-navy normal-case">{s.why}</span>
          </div>
        </div>
        <button onClick={onEdit} className="shrink-0 p-1 hover:text-navy" aria-label="Modifier">{editing ? <X size={13} /> : <Pencil size={13} />}</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- versions & profile

function Versions({ data, reload }: { data: CvState; reload: () => void }) {
  const { run } = useAction();
  return (
    <section>
      <h3 className="display text-[28px]">Versions</h3>
      <p className="mb-3 text-[12.5px] text-muted">La version principale sert de base à chaque CV adapté.</p>
      <div className="border-[1.5px] border-ink">
        {data.versions.map((v, i) => (
          <div key={v.id} className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${i ? "border-t-[1.5px] border-ink" : ""} ${v.is_master ? "bg-wash" : ""}`}>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[16px] font-bold">{v.label}</div>
              <div className="font-mono text-[10.5px] uppercase text-muted">{v.kind === "original" ? "original importé" : `${v.edited_blocks} bloc(s) optimisé(s)`} · {relative(v.created_at)}</div>
            </div>
            <a className="btn-ghost" href={`/api/cv/versions/${v.id}.pdf`} target="_blank" rel="noreferrer">PDF</a>
            {v.is_master ? <span className="chip-navy">principale</span> : (
              <>
                <button className="btn btn-sm" onClick={() => run("m", async () => { await api(`/cv/versions/${v.id}/master`, { method: "POST" }); reload(); }, "Version principale changée")}>Utiliser</button>
                <button className="btn-ghost" onClick={() => run("d", async () => { await api(`/cv/versions/${v.id}`, { method: "DELETE" }); reload(); })}>Supprimer</button>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ProfileForm({ profile, onTask }: { profile: Profile; onTask: (id: number) => void }) {
  const [p, setP] = useState<Profile>(profile);
  useEffect(() => setP(profile), [profile]);
  const { busy, run } = useAction();
  const set = (k: keyof Profile, v: any) => setP((x) => ({ ...x, [k]: v }));
  const roles = useMemo(() => (p.target_roles || []).join(", "), [p.target_roles]);
  return (
    <section>
      <div className="flex items-end justify-between gap-2">
        <h3 className="display text-[28px]">Profil</h3>
        <button className="btn-ghost" onClick={() => run("rf", async () => { const r = await api<{ task_id: number }>("/cv/profile-refresh", { method: "POST" }); onTask(r.task_id); }, "Relecture du CV lancée")}>
          <RotateCw size={11} />Relire depuis le CV
        </button>
      </div>
      <p className="mb-3 text-[12.5px] text-muted">Lu automatiquement dans votre CV, utilisé pour noter les offres. L'email ci-dessous remplace celui du PDF sur chaque CV envoyé.</p>
      <div className="grid gap-3 border-[1.5px] border-ink p-3 sm:grid-cols-2">
        <F label="Nom" v={p.full_name} on={(v) => set("full_name", v)} />
        <F label="Email de candidature" v={p.email} on={(v) => set("email", v)} />
        <F label="Téléphone" v={p.phone} on={(v) => set("phone", v)} />
        <F label="Ville" v={p.city} on={(v) => set("city", v)} />
        <label className="sm:col-span-2"><span className="field-label">Postes visés (séparés par des virgules)</span>
          <input className="field" defaultValue={roles} key={roles} onBlur={(e) => set("target_roles", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
        </label>
        <label className="sm:col-span-2"><span className="field-label">Résumé</span>
          <textarea className="field min-h-[70px]" value={p.summary} onChange={(e) => set("summary", e.target.value)} />
        </label>
        <div className="sm:col-span-2">
          <button className="btn-ink" disabled={busy === "save"} onClick={() => run("save", () => api("/profile", { method: "PUT", body: p }), "Profil enregistré")}><Save size={13} />Enregistrer</button>
        </div>
      </div>
    </section>
  );
}

function F({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return <label><span className="field-label">{label}</span><input className="field" value={v || ""} onChange={(e) => on(e.target.value)} /></label>;
}
