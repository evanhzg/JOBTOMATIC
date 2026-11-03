import { Job } from "../lib/api";
import { relative, shortDate } from "../lib/format";
import { Score } from "./ui";
import { Mail, Link2, Star, AlertTriangle, FileCheck2, BellRing } from "lucide-react";

export default function JobCard({ job, onOpen, compact }: { job: Job; onOpen: () => void; compact?: boolean }) {
  return (
    <button onClick={onOpen}
      className="group block w-full border-[1.5px] border-ink bg-cream p-2.5 text-left transition-[box-shadow,transform] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[4px_4px_0_var(--ink)]">
      <div className="flex items-start gap-2.5">
        <Score value={job.match_score} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 font-display text-[15.5px] font-bold leading-[1.15]">{job.title}</div>
          <div className="mt-0.5 truncate text-[12.5px] text-muted">
            {job.company || "Employeur non affiché"} · {job.location || "—"}
          </div>
        </div>
        {!!job.starred && <Star size={13} className="shrink-0 fill-navy text-navy" />}
      </div>
      {!compact && job.ai_summary && <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-ink/80">{job.ai_summary}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {job.contract_type && <span className="chip">{job.contract_type}</span>}
        <span className="chip-soft">{job.source_label}</span>
        {job.contact_email ? <span className="chip-soft" title={job.contact_email}><Mail size={10} />email</span>
          : <span className="chip-soft"><Link2 size={10} />site</span>}
        {job.has_cv && <span className="chip-navy"><FileCheck2 size={10} />CV{job.ats_after != null ? ` ${job.ats_after}%` : ""}</span>}
        {!!job.is_school_ad && <span className="chip border-alert text-alert"><AlertTriangle size={10} />école</span>}
        {job.next_followup && (
          <span className={job.next_followup.status === "manual" ? "chip-on" : "chip-soft"}>
            <BellRing size={10} />{job.next_followup.status === "manual" ? "relance à faire" : `relance ${shortDate(job.next_followup.due_at)}`}
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] uppercase text-muted">
          {job.applied_at ? `envoyée ${relative(job.applied_at)}` : relative(job.posted_at || job.created_at)}
        </span>
      </div>
    </button>
  );
}
