export type JobStatus = 
  | 'discovered' 
  | 'tailored' 
  | 'applied' 
  | 'answer_received' 
  | 'interview' 
  | 'archived';

export interface CVImprovementSuggestions {
  current_score: number;
  projected_score: number;
  critique: string;
  missing_keywords: string[];
  enhanced_headline: string;
  boosted_summary: string;
  skills_to_add: string[];
  boosted_bullet_points: string[];
}

export interface Job {
  id: number;
  external_id: string;
  title: string;
  company: string;
  location: string;
  contract_type: string;
  description: string;
  url: string;
  contact_email?: string;
  salary?: string;
  source: string;
  match_score: number;
  match_reasons?: string[];
  status: JobStatus;
  tailored_title?: string;
  tailored_summary?: string;
  tailored_skills?: string[];
  tailored_cv_path?: string;
  cover_letter?: string;
  apply_method?: 'form' | 'email';
  applied_at?: string;
  submission_screenshot?: string;
  sent_message_id?: string;
  answer_at?: string;
  answer_snippet?: string;
  answer_classification?: 'INTERVIEW' | 'INFO_REQUEST' | 'ACKNOWLEDGMENT' | 'REJECTION';
  cv_improvement_suggestions?: CVImprovementSuggestions | null;
  created_at: string;
  updated_at: string;
}

export interface SearchQuery {
  id: number;
  query_text: string;
  location: string;
  radius_km: number;
  contract_types: string[];
  platforms: string[];
  is_active: number;
  last_run_at?: string;
  total_found: number;
  created_at: string;
}

export interface Experience {
  role: string;
  company: string;
  period: string;
  location?: string;
  details: string[];
}

export interface Education {
  degree: string;
  school: string;
  year: string;
  details?: string;
}

export interface CandidateProfile {
  id?: number;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  headline: string;
  summary: string;
  skills: string[];
  experiences: Experience[];
  education: Education[];
  languages: string[];
  preferences: {
    driver_license?: string;
    availability?: string;
    min_salary?: string;
    work_types?: string[];
  };
}

export interface SystemSettings {
  is_autopilot_enabled: boolean;
  is_paused: boolean;
  match_score_threshold: number;
  daily_application_limit: number;
  applications_sent_today: number;
  gmail_address: string;
  gmail_app_password?: string;
  gmail_app_password_set?: boolean;
  imap_poll_interval_mins: number;
  ai_provider: 'agy' | 'claude' | 'codex';
  wait_for_batch_validation: boolean;
  anthropic_api_key?: string;
}

export interface SystemStats {
  discovered: number;
  tailored: number;
  applied: number;
  answer_received: number;
  interview: number;
  archived: number;
  total_jobs: number;
  applications_today: number;
  daily_limit: number;
  autopilot_enabled: boolean;
  is_paused: boolean;
  threshold: number;
  active_queries: number;
  ai_provider: 'agy' | 'claude' | 'codex';
  wait_for_batch_validation: boolean;
}

export interface ActivityLog {
  id: number;
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  message: string;
  job_id?: number;
  timestamp: string;
}
