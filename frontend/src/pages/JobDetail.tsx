import { useEffect, useState } from "react";
import { api, Job } from "../lib/api";
import { useLive } from "../lib/live";
import { clock, relative, STATUS_LABEL } from "../lib/format";
import { Modal, Score, useAction, Leader } from "../components/ui";
import { ExternalLink, FileDown, Wand2, Send, Check, Trash2, Star, RotateCw, Archive } from "lucide-react";

export default function JobDetail({ jobId, onClose }: { jobId: number | null; onClose: () => void }) {
  return (
    <Modal open={jobId !== null} onClose={onClose} wide>
      {jobId !== null && <Detail id={jobId} onClose={onClose} />}
    </Modal>
  );
}

function Detail({ id, onClose }: { id: number; onClose: () => void }) {
  const { data: job, reload } = useLive<Job>(`/jobs/${id}`, ["job_updated", "task", "followups"], 30000);
  const { busy, run } = useAction();
  const [letter, setLetter] = useState("");
  const [subject, setSubject] = useState("");
  const [email, setEmail] = useState("");
  const [cvKey, setCvKey] = useState(0);
  useEffect(() => {
    if (!job) return;
    setLetter(job.cover_letter || "");
    setSubject(job.email_subject || "");
    setEmail(job.contact_email || "");
    setCvKey(Date.now());
  }, [job?.cover_letter, job?.email_subject, job?.contact_email, job?.tailor?.changes?.length, job?.id]);

  if (!job) return <div className="p-10 font-mono uppercase">Chargement…</div>;
  const pending = (job.tasks || []).find((t) => t.status === "queued" || t.status === "running");
  const failed = (job.tasks || []).find((t) => t.status === "failed");
  const patch = (values: Record<string, unknown>, ok?: string) => run("patch", async () => { await api(`/jobs/${id}`, { method: "PATCH", body: values }); reload(); }, ok);
  const canSend = job.status === "new" || job.status === "ready";

  return (
    <div>
      {/* header */}
      <div className="border-b-[1.5px] border-ink p-6 pr-16">
        <div className="kicker flex flex-wrap gap-x-3 gap-y-1">
          <span>{job.source_label}</span><span>·</span><span>{STATUS_LABEL[job.status]}</span><span>·</span>
          <span>publiée {relative(job.posted_at || job.created_at)}</span>
        </div>
        <h2 className="display mt-2 text-[clamp(28px,3.4vw,46px)]">{job.title}</h2>
        <div className="mt-2 text-[15px]">{job.company || "Employeur non affiché"} — {job.location}</div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {job.contract_type && <span className="chip-on">{job.contract_type}</span>}
          {job.salary && <span className="chip">{job.salary}</span>}
          {job.url && <a className="btn btn-sm" href={job.url} target="_blank" rel="noreferrer"><ExternalLink size={12} />Voir l'offre</a>}
          <button className="btn btn-sm" onClick={() => patch({ starred: !job.starred })}><Star size={12} className={job.starred ? "fill-ink" : ""} />{job.starred ? "Suivie" : "Suivre"}</button>
          <select className="field !w-auto !py-1 font-mono text-[12px] uppercase" value={job.status} onChange={(e) => patch({ status: e.target.value }, "Étape modifiée")}>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {job.status !== "archived" && <button className="btn btn-sm" onClick={() => patch({ status: "archived", archived_reason: "Écartée à la main" })}><Archive size={12} />Écarter</button>}
          <button className="btn btn-sm" onClick={() => run("del", async () => { await api(`/jobs/${id}`, { method: "DELETE" }); onClose(); }, "Offre supprimée")}><Trash2 size={12} /></button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.05fr]">
        {/* left: assessment + description */}
        <div className="border-ink p-6 lg:border-r-[1.5px]">
          <div className="flex items-start gap-4">
            <Score value={job.match_score} size="lg" />
            <div className="flex-1">
              <div className="label">Avis de l'IA</div>
              <p className="mt-1 text-[14px]">{job.ai_summary || (pending ? "Évaluation en cours…" : "Pas encore évaluée.")}</p>
              <button className="btn-ghost mt-2" disabled={!!pending} onClick={() => run("score", () => api(`/jobs/${id}/score`, { method: "POST" }), "Réévaluation lancée")}>
                <RotateCw size={11} />Réévaluer
              </button>
            </div>
          </div>
          {!!job.is_school_ad && <div className="mt-4 border-[1.5px] border-alert p-3 text-[13px] text-alert"><b>Publicité d'école probable :</b> {job.school_reason}</div>}
          {(job.strengths?.length || job.gaps?.length) ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <List title="Atouts" items={job.strengths || []} />
              <List title="Manques" items={job.gaps || []} />
            </div>
          ) : null}
          <div className="mt-6">
            <div className="label mb-2">Description</div>
            <div className="max-h-[440px] overflow-y-auto whitespace-pre-line border-[1.5px] border-ink bg-cream p-3 text-[13.5px] leading-relaxed">
              {job.description || "—"}
            </div>
          </div>
          {job.answer_snippet && (
            <div className="mt-6 border-[1.5px] border-navy bg-wash p-3">
              <div className="label text-navy">Réponse reçue {relative(job.answer_at)} · {job.answer_class}</div>
              <p className="mt-1 whitespace-pre-line text-[13px]">{job.answer_snippet}</p>
            </div>
          )}
        </div>

        {/* right: CV + letter + send */}
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="display text-[28px]">CV sur mesure</h3>
            <div className="flex gap-2">
              <button className="btn-ink btn-sm" disabled={!!pending || busy === "tailor"}
                onClick={() => run("tailor", () => api(`/jobs/${id}/tailor`, { method: "POST" }), "Adaptation lancée")}>
                <Wand2 size={12} />{job.has_cv ? "Refaire" : "Adapter mon CV"}
              </button>
              {job.has_cv && <a className="btn btn-sm" href={`/api/jobs/${id}/cv.pdf?download=true`}><FileDown size={12} />PDF</a>}
            </div>
          </div>
          {pending && (
            <div className="mt-3 border-[1.5px] border-navy bg-wash px-3 py-2 font-mono text-[12px] uppercase text-navy">
              {pending.status === "running" ? "L'IA travaille…" : pending.run_after ? `En attente de l'IA — reprise auto ${clock(pending.run_after)}` : "Dans la file d'attente…"}
            </div>
          )}
          {failed && !pending && <div className="mt-3 border-[1.5px] border-alert px-3 py-2 text-[12.5px] text-alert">Échec : {failed.last_error}</div>}

          {job.has_cv ? (
            <>
              {job.ats_after != null && (
                <div className="mt-4 grid grid-cols-2 border-[1.5px] border-ink">
                  <div className="p-3"><div className="label">Mots-clés de l'offre — avant</div><div className="font-display text-[30px] font-extrabold">{job.ats_before}%</div></div>
                  <div className="border-l-[1.5px] border-ink bg-navy p-3 text-cream"><div className="label">Après adaptation</div><div className="font-display text-[30px] font-extrabold">{job.ats_after}%</div></div>
                </div>
              )}
              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <a href={`/api/jobs/${id}/cv.pdf`} target="_blank" rel="noreferrer" className="block border-[1.5px] border-ink bg-cream" title="Ouvrir le PDF">
                  {Array.from({ length: job.cv_pages || 1 }).map((_, n) => (
                    <img key={n} src={`/api/jobs/${id}/cv/page/${n}.png?dpi=130&v=${cvKey}`} alt={`CV page ${n + 1}`} className="w-full" />
                  ))}
                </a>
                <div className="min-w-0">
                  <div className="label mb-2">{job.tailor?.changes.length ?? 0} bloc(s) réécrit(s)</div>
                  <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                    {(job.tailor?.changes || []).map((c) => (
                      <div key={c.id} className="border-[1.5px] border-ink bg-cream p-2 text-[12px]">
                        <div className="text-muted line-through decoration-ink/40">{c.before.replace(/\*\*/g, "")}</div>
                        <div className="mt-1 font-medium">{c.after.replace(/\*\*/g, "")}</div>
                        {c.why && <div className="mt-1 font-mono text-[10px] uppercase text-navy">{c.why}</div>}
                      </div>
                    ))}
                  </div>
                  {!!job.tailor?.keywords_missing?.length && (
                    <div className="mt-3 text-[12px]"><span className="label">Absents du CV (non inventés) : </span>{job.tailor.keywords_missing.join(", ")}</div>
                  )}
                </div>
              </div>
            </>
          ) : !pending && (
            <p className="mt-3 text-[13px] text-muted">L'IA réécrit les blocs utiles de votre vrai CV (accroche, profil, puces) dans leur emplacement d'origine, sans toucher au design ni inventer d'expérience.</p>
          )}

          <div className="mt-7">
            <h3 className="display text-[28px]">Lettre & envoi</h3>
            <label className="mt-3 block"><span className="field-label">Email du recruteur</span>
              <input className="field" value={email} placeholder="non publié dans l'offre — candidature sur le site" onChange={(e) => setEmail(e.target.value)}
                onBlur={() => email !== (job.contact_email || "") && patch({ contact_email: email.trim() }, "Email enregistré")} />
            </label>
            <label className="mt-3 block"><span className="field-label">Objet</span>
              <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} onBlur={() => subject !== (job.email_subject || "") && patch({ email_subject: subject })} />
            </label>
            <label className="mt-3 block"><span className="field-label">Lettre de motivation (corps de l'email)</span>
              <textarea className="field min-h-[230px] leading-relaxed" value={letter} onChange={(e) => setLetter(e.target.value)}
                onBlur={() => letter !== (job.cover_letter || "") && patch({ cover_letter: letter }, "Lettre enregistrée")} />
            </label>
            {canSend && (
              <div className="mt-3 flex flex-wrap gap-2">
                {job.contact_email ? (
                  <button className="btn-navy" disabled={!job.has_cv || busy === "send"}
                    onClick={() => run("send", async () => { await api(`/jobs/${id}/apply`, { method: "POST" }); reload(); }, `Candidature envoyée à ${job.contact_email}`)}>
                    <Send size={13} />Envoyer à {job.contact_email}
                  </button>
                ) : (
                  <>
                    <a className="btn-navy" href={job.apply_url || job.url} target="_blank" rel="noreferrer"><ExternalLink size={13} />Postuler sur le site</a>
                    <button className="btn" disabled={busy === "mark"} onClick={() => run("mark", async () => { await api(`/jobs/${id}/mark-applied`, { method: "POST" }); reload(); }, "Marquée comme envoyée, relances programmées")}>
                      <Check size={13} />J'ai postulé
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {!!job.followups?.length && (
            <div className="mt-7">
              <h3 className="display text-[28px]">Relances</h3>
              <div className="mt-2 space-y-1.5">
                {job.followups.map((f) => (
                  <Leader key={f.id} left={`Relance n°${f.seq} · ${f.channel === "email" ? "email" : "à faire vous-même"}`}
                    right={f.status === "scheduled" ? clock(f.due_at) : f.status === "sent" ? `envoyée ${relative(f.sent_at)}` : f.status === "manual" ? "à faire" : f.status === "cancelled" ? "annulée" : "échec"} />
                ))}
              </div>
            </div>
          )}
          <label className="mt-7 block"><span className="field-label">Notes</span>
            <textarea className="field min-h-[70px]" defaultValue={job.notes || ""} onBlur={(e) => e.target.value !== (job.notes || "") && patch({ notes: e.target.value })} />
          </label>
        </div>
      </div>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="label mb-1">{title}</div>
      <ul className="space-y-1 text-[13px]">
        {items.map((s, i) => <li key={i} className="flex gap-2"><span className="font-mono">—</span><span>{s}</span></li>)}
        {!items.length && <li className="text-muted">—</li>}
      </ul>
    </div>
  );
}
