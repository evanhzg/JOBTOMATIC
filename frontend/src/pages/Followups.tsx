import { useState } from "react";
import { api, Followup, Settings } from "../lib/api";
import { useLive } from "../lib/live";
import { clock, relative } from "../lib/format";
import { Empty, SectionTitle, useAction } from "../components/ui";
import { Send, Check, X, Copy, CalendarClock } from "lucide-react";

export default function Followups({ openJob }: { openJob: (id: number) => void }) {
  const { data: items, reload } = useLive<Followup[]>("/followups?include_done=true", ["followups", "job_updated"], 60000);
  const { data: settings } = useLive<Settings>("/settings", ["settings"], 300000);
  const todo = (items || []).filter((f) => f.status === "manual" || f.status === "failed");
  const scheduled = (items || []).filter((f) => f.status === "scheduled");
  const done = (items || []).filter((f) => f.status === "sent").slice(0, 30);

  return (
    <div>
      <SectionTitle kicker={settings ? `Relances à J+${(settings.followup_delays_days || []).join(" et J+")} · ${settings.followup_auto_send ? "envoi automatique par email" : "brouillons à valider"} · entre ${settings.followup_window?.[0]} h et ${settings.followup_window?.[1]} h${settings.followup_skip_weekends ? ", jours ouvrés" : ""}` : ""}>
        Relances
      </SectionTitle>
      {items && !items.length && <Empty title="Aucune relance">Dès qu'une candidature est envoyée, Plonge programme les relances. Elles s'annulent seules si le recruteur répond.</Empty>}

      {todo.length > 0 && (
        <section className="mb-8">
          <h3 className="display mb-2 text-[28px]">À faire vous-même · {todo.length}</h3>
          <p className="mb-3 text-[12.5px] text-muted">Candidatures faites sur un site (pas d'email connu) ou Gmail non configuré : copiez le texte, envoyez-le, puis cochez.</p>
          <div className="grid gap-3 lg:grid-cols-2">{todo.map((f) => <Card key={f.id} f={f} reload={reload} openJob={openJob} />)}</div>
        </section>
      )}

      {scheduled.length > 0 && (
        <section className="mb-8">
          <h3 className="display mb-2 text-[28px]">Programmées · {scheduled.length}</h3>
          <div className="border-[1.5px] border-ink">
            {scheduled.map((f, i) => (
              <div key={f.id} className={`grid items-center gap-2 px-3 py-2.5 md:grid-cols-[150px_1fr_auto] ${i ? "border-t-[1.5px] border-ink" : ""}`}>
                <div className="font-mono text-[12px] font-bold uppercase"><CalendarClock size={12} className="mr-1 inline" />{clock(f.due_at)}</div>
                <button className="min-w-0 text-left" onClick={() => openJob(f.job_id)}>
                  <span className="font-display text-[16px] font-bold">{f.title}</span>
                  <span className="text-[12.5px] text-muted"> · {f.company} · relance n°{f.seq} · {f.channel === "email" ? `email à ${f.contact_email}` : "à faire vous-même"}</span>
                </button>
                <div className="flex gap-1">
                  <Reschedule f={f} reload={reload} />
                  <SendNow f={f} reload={reload} />
                  <Cancel f={f} reload={reload} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h3 className="display mb-2 text-[28px]">Envoyées</h3>
          <div className="space-y-1">
            {done.map((f) => (
              <div key={f.id} className="leader text-[11.5px]"><span>{f.title} · {f.company} · n°{f.seq}</span><span className="dots" /><span>{relative(f.sent_at)}</span></div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Card({ f, reload, openJob }: { f: Followup; reload: () => void; openJob: (id: number) => void }) {
  const [subject, setSubject] = useState(f.subject || "");
  const [body, setBody] = useState(f.body || "");
  const { busy, run } = useAction();
  const save = () => (subject !== (f.subject || "") || body !== (f.body || "")) && api(`/followups/${f.id}`, { method: "PATCH", body: { subject, body } });
  return (
    <div className="border-[1.5px] border-ink bg-cream p-3">
      <button className="text-left" onClick={() => openJob(f.job_id)}>
        <div className="font-display text-[18px] font-bold leading-tight">{f.title}</div>
        <div className="text-[12.5px] text-muted">{f.company} · relance n°{f.seq} · candidature {relative(f.applied_at)}</div>
      </button>
      {f.status === "failed" && <div className="mt-2 text-[12px] text-alert">Échec : {f.error}</div>}
      {!body ? (
        <div className="mt-2">
          <button className="btn btn-sm" disabled={busy === "draft"} onClick={() => run("draft", async () => { await api(`/followups/${f.id}/draft`, { method: "POST" }); reload(); }, "Brouillon rédigé")}>Rédiger avec l'IA</button>
        </div>
      ) : (
        <>
          <input className="field mt-2 text-[13px]" value={subject} onChange={(e) => setSubject(e.target.value)} onBlur={save} />
          <textarea className="field mt-2 min-h-[130px] text-[13px]" value={body} onChange={(e) => setBody(e.target.value)} onBlur={save} />
        </>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {body && <button className="btn btn-sm" onClick={() => run("copy", () => navigator.clipboard.writeText(`${subject}\n\n${body}`), "Copié")}><Copy size={12} />Copier</button>}
        {f.contact_email && body && <SendNow f={f} reload={reload} label="Envoyer par email" />}
        {f.url && <a className="btn btn-sm" href={f.url} target="_blank" rel="noreferrer">Offre</a>}
        <button className="btn-ink btn-sm" onClick={() => run("done", async () => { await api(`/followups/${f.id}/done`, { method: "POST" }); reload(); }, "Relance notée comme faite")}><Check size={12} />Fait</button>
        <Cancel f={f} reload={reload} />
      </div>
    </div>
  );
}

function SendNow({ f, reload, label }: { f: Followup; reload: () => void; label?: string }) {
  const { busy, run } = useAction();
  return (
    <button className="btn btn-sm" disabled={busy === "s"} title="Rédiger (si besoin) et envoyer maintenant"
      onClick={() => run("s", async () => { await api(`/followups/${f.id}/send`, { method: "POST" }); reload(); }, "Relance traitée")}>
      <Send size={12} />{label || "Maintenant"}
    </button>
  );
}

function Cancel({ f, reload }: { f: Followup; reload: () => void }) {
  const { run } = useAction();
  return <button className="btn btn-sm" title="Annuler cette relance" onClick={() => run("c", async () => { await api(`/followups/${f.id}`, { method: "DELETE" }); reload(); })}><X size={12} /></button>;
}

function Reschedule({ f, reload }: { f: Followup; reload: () => void }) {
  const { run } = useAction();
  const local = f.due_at.slice(0, 16);
  return (
    <input type="datetime-local" className="field !w-auto !py-0.5 font-mono text-[11px]" defaultValue={local}
      onBlur={(e) => e.target.value && e.target.value !== local && run("r", async () => { await api(`/followups/${f.id}`, { method: "PATCH", body: { due_at: e.target.value + ":00" } }); reload(); }, "Relance déplacée")} />
  );
}
