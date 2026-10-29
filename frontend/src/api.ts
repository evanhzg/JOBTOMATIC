import { Job, CandidateProfile, SystemSettings, SystemStats, SearchQuery, ActivityLog } from './types';

const API_BASE = '/api';

export async function fetchStats(): Promise<SystemStats> {
  const res = await fetch(`${API_BASE}/stats`);
  return res.json();
}

export async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${API_BASE}/jobs`);
  return res.json();
}

export async function fetchJob(id: number): Promise<Job> {
  const res = await fetch(`${API_BASE}/jobs/${id}`);
  return res.json();
}

export async function updateJobStatus(id: number, status: string): Promise<void> {
  await fetch(`${API_BASE}/jobs/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
}

export async function tailorJob(id: number): Promise<any> {
  const res = await fetch(`${API_BASE}/jobs/${id}/tailor`, { method: 'POST' });
  return res.json();
}

export async function improveJobCV(id: number): Promise<any> {
  const res = await fetch(`${API_BASE}/jobs/${id}/improve-cv`, { method: 'POST' });
  return res.json();
}

export async function applyImprovements(id: number): Promise<any> {
  const res = await fetch(`${API_BASE}/jobs/${id}/apply-improvements`, { method: 'POST' });
  return res.json();
}

export async function batchValidate(): Promise<any> {
  const res = await fetch(`${API_BASE}/jobs/batch-validate`, { method: 'POST' });
  return res.json();
}

export async function applyJob(id: number): Promise<any> {
  const res = await fetch(`${API_BASE}/jobs/${id}/apply`, { method: 'POST' });
  return res.json();
}

export async function simulateReply(id: number): Promise<any> {
  const res = await fetch(`${API_BASE}/jobs/${id}/simulate-reply`, { method: 'POST' });
  return res.json();
}

export async function deleteJob(id: number): Promise<void> {
  await fetch(`${API_BASE}/jobs/${id}`, { method: 'DELETE' });
}

export async function fetchSearchQueries(): Promise<SearchQuery[]> {
  const res = await fetch(`${API_BASE}/search-queries`);
  return res.json();
}

export async function addSearchQuery(query: {
  query_text: string;
  location: string;
  radius_km: number;
  contract_types: string[];
  platforms: string[];
}): Promise<void> {
  await fetch(`${API_BASE}/search-queries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query)
  });
}

export async function deleteSearchQuery(id: number): Promise<void> {
  await fetch(`${API_BASE}/search-queries/${id}`, { method: 'DELETE' });
}

export async function runSearchNow(): Promise<void> {
  await fetch(`${API_BASE}/search-queries/run-now`, { method: 'POST' });
}

export async function fetchProfile(): Promise<CandidateProfile> {
  const res = await fetch(`${API_BASE}/profile`);
  return res.json();
}

export async function updateProfile(profile: CandidateProfile): Promise<void> {
  await fetch(`${API_BASE}/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile)
  });
}

export async function fetchSettings(): Promise<SystemSettings> {
  const res = await fetch(`${API_BASE}/settings`);
  return res.json();
}

export async function updateSettings(settings: Partial<SystemSettings>): Promise<void> {
  await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
}

export async function setAiProvider(provider: 'agy' | 'claude' | 'codex'): Promise<void> {
  await fetch(`${API_BASE}/settings/set-provider?provider=${provider}`, { method: 'POST' });
}

export async function toggleBatchValidation(): Promise<{ wait_for_batch_validation: boolean }> {
  const res = await fetch(`${API_BASE}/settings/toggle-batch-validation`, { method: 'POST' });
  return res.json();
}

export async function toggleAutopilot(): Promise<{ is_autopilot_enabled: boolean }> {
  const res = await fetch(`${API_BASE}/settings/toggle-autopilot`, { method: 'POST' });
  return res.json();
}

export async function togglePause(): Promise<{ is_paused: boolean }> {
  const res = await fetch(`${API_BASE}/settings/toggle-pause`, { method: 'POST' });
  return res.json();
}

export async function testEmailConnection(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/email/test-connection`, { method: 'POST' });
  return res.json();
}

export async function fetchLogs(): Promise<ActivityLog[]> {
  const res = await fetch(`${API_BASE}/logs`);
  return res.json();
}

export async function fetchMasterCVHtml(): Promise<{ html: string }> {
  const res = await fetch(`${API_BASE}/profile/preview-html`);
  return res.json();
}

export async function uploadOriginalCv(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/profile/upload-cv`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Échec upload CV' }));
    throw new Error(err.detail || 'Erreur lors de l\'import du CV');
  }
  return res.json();
}

export async function inspectCvEfficiency(): Promise<any> {
  const res = await fetch(`${API_BASE}/profile/inspect-efficiency`, {
    method: 'POST'
  });
  return res.json();
}

export async function generateMetricVariants(metricId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/profile/generate-variants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metric_id: metricId })
  });
  return res.json();
}

export async function translateCv(targetLanguage: string = 'en'): Promise<any> {
  const res = await fetch(`${API_BASE}/profile/translate-cv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_language: targetLanguage })
  });
  if (!res.ok) {
    throw new Error('Erreur lors de la traduction du CV');
  }
  return res.json();
}
