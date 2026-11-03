import { useEffect, useState } from "react";
import { api, Settings } from "../lib/api";
import { useEvents, useLive } from "../lib/live";
import { clock } from "../lib/format";
import { SectionTitle, Toggle, useAction } from "../components/ui";
import { Save, PlugZap } from "lucide-react";

type Log = { id: number; level: string; message: string; timestamp: string; job_id?: number };

export default function SettingsPage() {
  const { data, reload } = useLive<Settings>("/settings", ["settings"], 300000);
  const [s, setS] = useState<Settings | null>(null);
  const [pw, setPw] = useState("");
  const { busy, run } = useAction();
  useEffect(() => { if (data) setS(data); }, [data]);
  if (!s) return <div className="font-mono uppercase">Chargement…</div>;
  const set = (k: string, v: any) => setS((x) => ({ ...x!, [k]: v }));
  const save = () => run("save", async () => {
    const body: Settings = { ...s };
    delete body.gmail_app_password_set;
    if (pw) body.gmail_app_password = pw; else delete body.gmail_app_password;
    await api("/settings", { method: "PUT", body });
    setPw("");
    reload();
  }, "Réglages enregistrés");

  return (
    <div>
      <SectionTitle right={<button className="btn-ink" onClick={save} disabled={busy === "save"}><Save size={13} />Enregistrer</button>}>Réglages</SectionTitle>
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Pilote automatique" note="Ce que Plonge fait seul quand le pilote auto est activé (en haut à droite).">
          <Toggle on={!!s.auto_search} onChange={(v) => set("auto_search", v)} label="Relancer les recherches seul" />
          <Num label="Intervalle par défaut (minutes)" v={s.search_interval_mins} on={(v) => set("search_interval_mins", v)} min={30} />
          <Toggle on={!!s.auto_score} onChange={(v) => set("auto_score", v)} label="Noter les nouvelles offres (IA)" />
          <Num label="Adapter le CV au-dessus du score" v={s.match_threshold} on={(v) => set("match_threshold", v)} min={0} max={100} />
          <Toggle on={!!s.require_validation} onChange={(v) => set("require_validation", v)} label="Attendre mon feu vert avant d'envoyer" />
          <Num label="Envois max par jour" v={s.daily_application_limit} on={(v) => set("daily_application_limit", v)} min={1} max={100} />
          <Toggle on={!!s.hide_school_ads} onChange={(v) => set("hide_school_ads", v)} label="Écarter les pubs d'écoles / CFA" />
        </Panel>

        <Panel title="Gmail" note="Envoi des candidatures et relances, lecture des réponses. Utilisez un mot de passe d'application Google (myaccount.google.com → Sécurité → Mots de passe des applications).">
          <Text label="Adresse Gmail d'envoi" v={s.gmail_address} on={(v) => set("gmail_address", v)} />
          <label><span className="field-label">Mot de passe d'application {s.gmail_app_password_set ? "(enregistré)" : ""}</span>
            <input className="field font-mono" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={s.gmail_app_password_set ? "•••• •••• •••• ••••" : "16 caractères"} />
          </label>
          <Text label="Nom affiché (optionnel)" v={s.sender_name} on={(v) => set("sender_name", v)} />
          <Toggle on={!!s.imap_enabled} onChange={(v) => set("imap_enabled", v)} label="Détecter les réponses (lecture seule)" />
          <button className="btn btn-sm self-start" disabled={busy === "test"} onClick={() => run("test", async () => {
            const r = await api<{ status: string; message: string }>("/settings/email-test", { method: "POST" });
            if (r.status !== "success") throw new Error(r.message);
            return r;
          }, "Connexion Gmail OK")}><PlugZap size={12} />Tester la connexion</button>
        </Panel>

        <Panel title="Relances" note="Programmées à l'envoi d'une candidature, annulées automatiquement dès qu'une réponse arrive.">
          <Toggle on={!!s.followups_enabled} onChange={(v) => set("followups_enabled", v)} label="Programmer des relances" />
          <Text label="Délais en jours (virgules)" v={(s.followup_delays_days || []).join(", ")}
            on={(v) => set("followup_delays_days", v.split(",").map((x: string) => parseInt(x.trim())).filter((n: number) => n > 0))} />
          <Toggle on={!!s.followup_auto_send} onChange={(v) => set("followup_auto_send", v)} label="Envoyer seul (sinon : brouillon à valider)" />
          <div className="grid grid-cols-2 gap-2">
            <Num label="Entre (heure)" v={s.followup_window?.[0]} on={(v) => set("followup_window", [v, s.followup_window?.[1] ?? 11])} min={6} max={20} />
            <Num label="Et (heure)" v={s.followup_window?.[1]} on={(v) => set("followup_window", [s.followup_window?.[0] ?? 9, v])} min={7} max={21} />
          </div>
          <Toggle on={!!s.followup_skip_weekends} onChange={(v) => set("followup_skip_weekends", v)} label="Jours ouvrés uniquement" />
        </Panel>
      </div>
      <Journal />
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="border-[1.5px] border-ink">
      <header className="border-b-[1.5px] border-ink p-3"><h3 className="display text-[26px]">{title}</h3><p className="mt-1 text-[12px] text-muted">{note}</p></header>
      <div className="flex flex-col gap-3 p-3">{children}</div>
    </section>
  );
}

function Num({ label, v, on, min, max }: { label: string; v: number; on: (v: number) => void; min?: number; max?: number }) {
  return <label><span className="field-label">{label}</span><input className="field font-mono" type="number" value={v ?? ""} min={min} max={max} onChange={(e) => on(+e.target.value)} /></label>;
}

function Text({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return <label><span className="field-label">{label}</span><input className="field" value={v ?? ""} onChange={(e) => on(e.target.value)} /></label>;
}

function Journal() {
  const { data, setData } = useLive<Log[]>("/logs?limit=120", [], 120000);
  useEvents((type, d) => {
    if (type === "log") setData((l) => [{ id: Date.now(), ...d }, ...(l || [])].slice(0, 200));
  });
  const color: Record<string, string> = { ERROR: "text-alert", WARNING: "text-[#9a6b00]", SUCCESS: "text-navy" };
  return (
    <section className="mt-8">
      <h3 className="display mb-2 text-[28px]">Journal</h3>
      <div className="max-h-[420px] overflow-y-auto border-[1.5px] border-ink bg-cream p-3 font-mono text-[12px] leading-relaxed">
        {(data || []).map((l) => (
          <div key={l.id} className="flex gap-3">
            <span className="shrink-0 text-muted">{clock(l.timestamp)}</span>
            <span className={`shrink-0 font-bold ${color[l.level] || ""}`}>{l.level.slice(0, 4)}</span>
            <span>{l.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
