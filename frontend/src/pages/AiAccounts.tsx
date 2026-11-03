import { useState } from "react";
import { api, Account, Pool, Task } from "../lib/api";
import { useEvents, useLive } from "../lib/live";
import { clock, countdown, relative, useTick } from "../lib/format";
import { SectionTitle, Toggle, useAction } from "../components/ui";
import { Plus, Copy, FlaskConical, ShieldCheck, Unlock, Trash2, ArrowUp, ArrowDown, RotateCw, X } from "lucide-react";

const STATUS: Record<string, [string, string]> = {
  ok: ["Disponible", "chip-navy"],
  limited: ["Limite atteinte", "chip-on"],
  needs_login: ["Connexion requise", "chip border-alert text-alert"],
  error: ["Erreur", "chip border-alert text-alert"],
  unknown: ["Pas encore utilisé", "chip-soft"],
};

const AUTH_LABEL: Record<string, string> = {
  default: "Session déjà connectée sur ce PC",
  token: "Jeton longue durée (claude setup-token)",
  config_dir: "Compte séparé (dossier dédié)",
  api_key: "Clé API",
};

export default function AiAccounts() {
  useTick(1000);
  const { data: pool, reload } = useLive<Pool>("/ai/accounts", ["ai_account", "ai_pool", "ai_waiting"], 20000);
  const { data: queue, reload: reloadQueue } = useLive<{ counts: Record<string, number>; tasks: Task[]; waiting_until: string | null }>("/tasks", ["task", "ai_waiting"], 20000);
  const [adding, setAdding] = useState(false);
  const { run } = useAction();
  const waitingUntil = pool?.resume_at || queue?.waiting_until;

  return (
    <div>
      <SectionTitle kicker="Plonge alterne entre vos comptes. Quand l'un atteint sa limite de session, le suivant prend le relais ; si tous sont limités, le travail attend et reprend tout seul.">
        IA & comptes
      </SectionTitle>

      <div className={`mb-6 grid border-[1.5px] md:grid-cols-[1.4fr_1fr_1fr] ${waitingUntil ? "border-navy" : "border-ink"}`}>
        <div className={`p-4 ${waitingUntil ? "bg-navy text-cream" : ""}`}>
          <div className="label">État</div>
          <div className="display mt-1 text-[30px]">
            {!pool ? "…" : waitingUntil ? `Reprise dans ${countdown(waitingUntil)}` : pool.available ? "Prête" : "Aucun compte utilisable"}
          </div>
          <div className="mt-1 font-mono text-[11.5px] uppercase">
            {waitingUntil ? `Tous les comptes sont limités · redémarrage automatique à ${clock(waitingUntil)}` : `${pool?.available ?? 0} compte(s) disponible(s) sur ${pool?.total ?? 0}`}
          </div>
        </div>
        <div className="border-ink p-4 md:border-l-[1.5px]"><div className="label">File d'attente</div>
          <div className="font-display text-[36px] font-extrabold leading-none">{queue?.counts.queued ?? 0}</div>
          <div className="font-mono text-[11px] uppercase text-muted">{queue?.counts.running ? "1 en cours" : "rien en cours"} · {queue?.counts.failed ?? 0} échec(s)</div>
        </div>
        <div className="border-ink p-4 md:border-l-[1.5px]"><div className="label">Appels aujourd'hui</div>
          <div className="font-display text-[36px] font-extrabold leading-none">{(pool?.accounts || []).reduce((n, a) => n + (a.calls_today || 0), 0)}</div>
          <div className="font-mono text-[11px] uppercase text-muted">tous comptes confondus</div>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h3 className="display text-[28px]">Comptes liés</h3>
        <button className="btn-ink" onClick={() => setAdding(true)}><Plus size={13} />Lier un compte</button>
      </div>
      {adding && <AddAccount onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); }} />}

      <div className="border-[1.5px] border-ink">
        {(pool?.accounts || []).map((a, i, arr) => (
          <AccountRow key={a.id} a={a} first={i === 0} last={i === arr.length - 1} reload={reload}
            move={(dir) => {
              const other = arr[i + dir];
              if (!other) return;
              run("mv", async () => {
                await api(`/ai/accounts/${a.id}`, { method: "PATCH", body: { priority: other.priority } });
                await api(`/ai/accounts/${other.id}`, { method: "PATCH", body: { priority: a.priority === other.priority ? a.priority + dir : a.priority } });
                reload();
              });
            }} />
        ))}
      </div>

      <h3 className="display mb-2 mt-10 text-[28px]">Travaux de l'IA</h3>
      <div className="border-[1.5px] border-ink">
        {(queue?.tasks || []).length === 0 && <div className="p-4 font-mono text-[11px] uppercase text-muted">Rien en attente.</div>}
        {(queue?.tasks || []).map((t, i) => (
          <div key={t.id} className={`grid items-center gap-2 px-3 py-2 md:grid-cols-[130px_1fr_auto] ${i ? "border-t-[1.5px] border-ink" : ""}`}>
            <span className={t.status === "running" ? "chip-navy" : t.status === "failed" ? "chip border-alert text-alert" : t.status === "done" ? "chip-soft" : "chip"}>
              {t.status === "queued" ? (t.run_after ? `attend ${clock(t.run_after)}` : "en file") : t.status === "running" ? "en cours" : t.status === "done" ? "terminé" : t.status === "failed" ? "échec" : "annulé"}
            </span>
            <div className="min-w-0 text-[13px]">
              <b>{t.label}</b>{t.job_title && <span className="text-muted"> · {t.job_title}{t.job_company ? ` (${t.job_company})` : ""}</span>}
              {t.last_error && t.status !== "done" && <div className="truncate text-[11.5px] text-muted" title={t.last_error}>{t.last_error}</div>}
            </div>
            <div className="flex gap-1">
              {(t.status === "failed" || (t.status === "queued" && t.run_after)) && <button className="btn btn-sm" onClick={() => run("rt", async () => { await api(`/tasks/${t.id}/retry`, { method: "POST" }); reloadQueue(); })}><RotateCw size={12} />Réessayer</button>}
              {t.status === "queued" && <button className="btn btn-sm" onClick={() => run("cx", async () => { await api(`/tasks/${t.id}/cancel`, { method: "POST" }); reloadQueue(); })}><X size={12} /></button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountRow({ a, first, last, reload, move }: { a: Account; first: boolean; last: boolean; reload: () => void; move: (d: number) => void }) {
  const { busy, run } = useAction();
  const [label, cls] = STATUS[a.status] || STATUS.unknown;
  const limited = a.status === "limited" && a.limited_until;
  return (
    <div className={`grid gap-3 p-3 lg:grid-cols-[auto_1.3fr_1fr_auto] lg:items-center ${first ? "" : "border-t-[1.5px] border-ink"} ${a.enabled ? "" : "opacity-55"}`}>
      <div className="flex flex-col">
        <button className="p-0.5 disabled:opacity-20" disabled={first} onClick={() => move(-1)} aria-label="Monter"><ArrowUp size={13} /></button>
        <button className="p-0.5 disabled:opacity-20" disabled={last} onClick={() => move(1)} aria-label="Descendre"><ArrowDown size={13} /></button>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-[18px] font-bold">{a.label}</span>
          <span className={cls}>{label}{limited ? ` · ${countdown(a.limited_until)}` : ""}</span>
        </div>
        <div className="font-mono text-[10.5px] uppercase text-muted">{a.provider_label} · {AUTH_LABEL[a.auth] || a.auth}{a.model ? ` · modèle ${a.model}` : ""}</div>
        {limited && <div className="text-[12px]">Reprise automatique à {clock(a.limited_until)}</div>}
        {a.last_error && a.status !== "ok" && <div className="mt-0.5 line-clamp-2 text-[11.5px] text-muted" title={a.last_error}>{a.last_error}</div>}
        {a.login_command && (a.status === "needs_login" || a.status === "unknown") && (
          <div className="mt-1 flex items-center gap-2">
            <code className="truncate border-[1.5px] border-ink bg-cream px-2 py-0.5 font-mono text-[11px]">{a.login_command}</code>
            <button className="btn-ghost" onClick={() => run("cp", () => navigator.clipboard.writeText(a.login_command), "Commande copiée")}><Copy size={11} /></button>
          </div>
        )}
      </div>
      <div className="space-y-0.5 font-mono text-[11px] uppercase">
        <div className="leader text-[11px]"><span>Appels aujourd'hui</span><span className="dots" /><span className="font-bold">{a.calls_today ?? 0}</span></div>
        <div className="leader text-[11px]"><span>Total</span><span className="dots" /><span className="font-bold">{a.calls_total ?? 0}</span></div>
        <div className="leader text-[11px]"><span>Dernier succès</span><span className="dots" /><span className="font-bold">{a.last_ok_at ? relative(a.last_ok_at) : "—"}</span></div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Toggle on={!!a.enabled} onChange={(v) => run("en", async () => { await api(`/ai/accounts/${a.id}`, { method: "PATCH", body: { enabled: v } }); reload(); })} />
        <button className="btn btn-sm" disabled={busy === "test"} title="Envoie un tout petit message (consomme un appel)"
          onClick={() => run("test", async () => { const r = await api<any>(`/ai/accounts/${a.id}/test`, { method: "POST" }); reload(); if (!r.ok) throw new Error(r.error); return r; }, "Compte opérationnel")}>
          <FlaskConical size={12} />{busy === "test" ? "Test…" : "Tester"}
        </button>
        {a.provider !== "agy" && a.provider !== "anthropic_api" && (
          <button className="btn btn-sm" title="Vérifie la connexion sans consommer d'appel"
            onClick={() => run("chk", async () => { const r = await api<any>(`/ai/accounts/${a.id}/check`, { method: "POST" }); reload(); if (!r.logged_in) throw new Error(`Non connecté : ${r.detail}`); return r; }, "Connecté")}>
            <ShieldCheck size={12} />Connexion
          </button>
        )}
        {a.provider === "codex" && a.auth === "config_dir" && a.status !== "ok" && <DeviceLogin a={a} reload={reload} />}
        {(a.status === "limited" || a.status === "error" || a.status === "needs_login") && (
          <button className="btn btn-sm" title="Retenter tout de suite (si la limite est déjà levée)" onClick={() => run("cl", async () => { await api(`/ai/accounts/${a.id}/clear-limit`, { method: "POST" }); reload(); }, "Compte remis en service")}><Unlock size={12} /></button>
        )}
        {a.auth !== "default" && <button className="btn btn-sm" onClick={() => run("rm", async () => { await api(`/ai/accounts/${a.id}`, { method: "DELETE" }); reload(); })} aria-label="Supprimer"><Trash2 size={12} /></button>}
      </div>
    </div>
  );
}

function DeviceLogin({ a, reload }: { a: Account; reload: () => void }) {
  const [info, setInfo] = useState<{ state: string; url?: string; code?: string } | null>(null);
  const { run } = useAction();
  useEvents((type, d) => {
    if (type === "ai_login" && d.account_id === a.id) {
      setInfo(d);
      if (d.state === "done") reload();
    }
  });
  if (info?.state === "waiting" && (info.url || info.code))
    return (
      <div className="w-full border-[1.5px] border-navy bg-wash p-2 text-[12px]">
        Ouvrez <a className="font-bold underline" href={info.url} target="_blank" rel="noreferrer">{info.url}</a> et saisissez le code
        <span className="ml-1 bg-navy px-1.5 font-mono font-bold text-cream">{info.code}</span>
      </div>
    );
  return <button className="btn-navy btn-sm" onClick={() => run("dl", async () => setInfo(await api(`/ai/accounts/${a.id}/login`, { method: "POST" })))}>Se connecter</button>;
}

function AddAccount({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [provider, setProvider] = useState<"claude" | "codex" | "anthropic_api" | "agy">("claude");
  const [auth, setAuth] = useState("token");
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState("");
  const [model, setModel] = useState("");
  const { busy, run } = useAction();
  const auths: Record<string, string[]> = { claude: ["token", "config_dir"], codex: ["config_dir", "api_key"], anthropic_api: ["api_key"], agy: ["config_dir"] };
  const pick = (p: typeof provider) => { setProvider(p); setAuth(auths[p][0]); };
  const help: Record<string, string> = {
    "claude:token": "Dans un terminal : « claude setup-token », connectez-vous avec l'autre compte Claude, puis collez le jeton ici.",
    "claude:config_dir": "Plonge crée un dossier dédié. Il restera à lancer une fois la commande de connexion affichée (copiable) dans un terminal.",
    "codex:config_dir": "Plonge crée un dossier dédié ; cliquez ensuite sur « Se connecter » : un code s'affiche, à saisir sur le site d'OpenAI.",
    "codex:api_key": "Clé API OpenAI (facturée à l'usage).",
    "anthropic_api:api_key": "Clé API Anthropic (console.anthropic.com), facturée à l'usage.",
    "agy:config_dir": "Dossier dédié : lancez la commande affichée une fois pour vous connecter avec l'autre compte Google.",
  };
  return (
    <div className="mb-4 border-[1.5px] border-ink bg-cream p-4 shadow-[6px_6px_0_var(--ink)]">
      <div className="mb-3 flex items-center justify-between"><h4 className="display text-[24px]">Lier un compte</h4><button className="btn btn-sm" onClick={onClose}><X size={13} /></button></div>
      <div className="grid gap-3 md:grid-cols-2">
        <div><span className="field-label">Service</span>
          <div className="seg flex-wrap">{(["claude", "codex", "anthropic_api", "agy"] as const).map((p) => <button key={p} data-on={provider === p} onClick={() => pick(p)}>{{ claude: "Claude", codex: "Codex", anthropic_api: "API Anthropic", agy: "Antigravity" }[p]}</button>)}</div>
        </div>
        <div><span className="field-label">Connexion</span>
          <div className="seg flex-wrap">{auths[provider].map((x) => <button key={x} data-on={auth === x} onClick={() => setAuth(x)}>{AUTH_LABEL[x]}</button>)}</div>
        </div>
        <p className="text-[12.5px] text-muted md:col-span-2">{help[`${provider}:${auth}`]}</p>
        <label><span className="field-label">Nom</span><input className="field" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex : Claude — compte perso 2" /></label>
        <label><span className="field-label">Modèle (optionnel)</span><input className="field" value={model} onChange={(e) => setModel(e.target.value)} placeholder={provider === "claude" ? "sonnet" : provider === "anthropic_api" ? "claude-sonnet-5-5" : "par défaut"} /></label>
        {(auth === "token" || auth === "api_key") && (
          <label className="md:col-span-2"><span className="field-label">{auth === "token" ? "Jeton" : "Clé API"}</span><input className="field font-mono" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} /></label>
        )}
        <div className="md:col-span-2">
          <button className="btn-ink" disabled={busy === "add" || ((auth === "token" || auth === "api_key") && !secret.trim())}
            onClick={() => run("add", async () => { await api("/ai/accounts", { body: { provider, auth, label, secret, model, priority: 100 } }); onDone(); }, "Compte lié")}>Lier ce compte</button>
        </div>
      </div>
    </div>
  );
}
