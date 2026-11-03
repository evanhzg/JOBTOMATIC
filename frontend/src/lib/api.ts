// Typed client for the Plonge API (same origin; Vite proxies /api and /ws in dev).

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const init: RequestInit = { method: opts.method || (opts.body || opts.form ? "POST" : "GET") };
  if (opts.form) init.body = opts.form;
  else if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
    init.headers = { "Content-Type": "application/json" };
  }
  const res = await fetch(`/api${path}`, init);
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const j = await res.json();
      msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j);
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, msg);
  }
  const ct = res.headers.get("content-type") || "";
  return (ct.includes("json") ? res.json() : res.text()) as Promise<T>;
}

export type JobStatus = "new" | "ready" | "applied" | "answered" | "interview" | "archived";

export interface Followup {
  id: number;
  job_id: number;
  seq: number;
  due_at: string;
  status: "scheduled" | "sent" | "manual" | "cancelled" | "failed";
  channel: "email" | "manual";
  subject?: string;
  body?: string;
  sent_at?: string;
  error?: string;
  title?: string;
  company?: string;
  contact_email?: string;
  applied_at?: string;
  job_status?: string;
  url?: string;
}

export interface Job {
  id: number;
  source: string;
  source_label: string;
  title: string;
  company: string;
  location: string;
  contract_type: string;
  url: string;
  apply_url: string;
  contact_email: string;
  salary: string;
  posted_at?: string;
  remote?: number | null;
  status: JobStatus;
  archived_reason?: string;
  match_score: number | null;
  ai_summary?: string;
  match_reasons?: string[];
  strengths?: string[];
  gaps?: string[];
  is_school_ad?: number;
  school_reason?: string;
  ats_before?: number | null;
  ats_after?: number | null;
  apply_method?: string;
  applied_at?: string;
  answer_at?: string;
  answer_class?: string;
  answer_snippet?: string;
  starred?: number;
  notes?: string;
  created_at: string;
  description_preview?: string;
  description?: string;
  has_cv?: boolean;
  cv_pages?: number;
  next_followup?: { status: string; due_at: string; seq: number } | null;
  tailor?: {
    changes: { id: string; before: string; after: string; why: string }[];
    dropped: string[];
    notes: string;
    keywords_found: string[];
    keywords_missing: string[];
  };
  cover_letter?: string;
  email_subject?: string;
  followups?: Followup[];
  tasks?: { id: number; kind: string; status: string; last_error?: string; run_after?: string }[];
}

export interface Search {
  id: number;
  label: string;
  query: string;
  locations: string[];
  radius_km: number;
  contract_types: string[];
  remote: string;
  max_age_days: number;
  sources: string[];
  exclude_keywords: string[];
  include_keywords: string[];
  active: number | boolean;
  interval_mins: number | null;
  last_run_at?: string;
  next_run_at?: string;
  last_report?: { key: string; label: string; ok: boolean; count: number; error: string; skipped: string; location: string; duration_ms: number }[];
  total_found: number;
  new_last_run: number;
  running?: boolean;
}

export interface Source {
  key: string;
  label: string;
  help: string;
  required_credentials: string[];
  optional_credentials?: string[];
  configured: boolean;
}

export interface Account {
  id: number;
  provider: "claude" | "codex" | "agy" | "anthropic_api";
  provider_label: string;
  label: string;
  auth: string;
  config_dir?: string;
  model?: string;
  priority: number;
  enabled: number;
  status: "ok" | "limited" | "needs_login" | "error" | "unknown";
  limited_until?: string | null;
  last_error?: string | null;
  last_ok_at?: string;
  last_used_at?: string;
  calls_today: number;
  calls_total: number;
  has_secret: boolean;
  login_command: string;
}

export interface Pool {
  accounts: Account[];
  available: number;
  total: number;
  state: "ok" | "waiting" | "down";
  resume_at: string | null;
}

export interface Task {
  id: number;
  kind: string;
  label: string;
  job_id?: number;
  job_title?: string;
  job_company?: string;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  attempts: number;
  run_after?: string | null;
  last_error?: string | null;
  priority: number;
  updated_at: string;
}

export interface Status {
  autopilot: boolean;
  paused: boolean;
  auto_search: boolean;
  next_search_at: string | null;
  searches_running: number[];
  next_followup_at: string | null;
  followups_scheduled: number;
  followups_manual: number;
  ai: { available: number; total: number; state: "ok" | "waiting" | "down"; resume_at: string | null };
  ai_accounts: { id: number; label: string; provider: string; status: string; limited_until?: string | null; enabled: number }[];
  queue: { counts: Record<string, number>; running: { label: string; job_id?: number } | null; waiting_until: string | null };
  applications_today: number;
  daily_limit: number;
}

export interface Unit {
  id: string;
  page: number;
  kind: string;
  locked: boolean;
  text: string;
  rich: string;
  max_chars: number;
  min_chars: number;
  n_lines: number;
}

export interface Suggestion {
  id: string;
  text: string;
  axis: string;
  why: string;
  gain: string;
  before: string;
  max_chars: number;
  fits: boolean;
}

export interface Audit {
  target: string;
  scores: Record<string, { score: number; why: string }>;
  verdict: string;
  measured: Record<string, any>;
  suggestions: Suggestion[];
  questions: string[];
  at: string;
}

export interface CvState {
  master: null | { id: number; label: string; kind: string; audit: Audit | null; pages: number; created_at: string; measured: Record<string, any> };
  versions: { id: number; label: string; kind: string; is_master: number; created_at: string; edited_blocks: number }[];
  units: Unit[];
  profile: Profile;
}

export interface Profile {
  full_name: string;
  email: string;
  phone: string;
  city: string;
  headline: string;
  summary: string;
  skills: string[];
  experiences: any[];
  education: any[];
  languages: string[];
  preferences: Record<string, any>;
  target_roles: string[];
}

export type Settings = Record<string, any>;
