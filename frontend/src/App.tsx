import React, { useState, useEffect, useCallback } from 'react';
import { 
  Job, 
  JobStatus, 
  SystemStats, 
  SearchQuery, 
  CandidateProfile, 
  SystemSettings, 
  ActivityLog,
  CVImprovementSuggestions
} from './types';
import * as api from './api';
import { ControlBar } from './components/ControlBar';
import { KanbanBoard } from './components/KanbanBoard';
import { SearchTab } from './components/SearchTab';
import { ProfileTab } from './components/ProfileTab';
import { SettingsTab } from './components/SettingsTab';
import { LiveConsole } from './components/LiveConsole';
import { JobDetailModal } from './components/JobDetailModal';
import { CVPreviewModal } from './components/CVPreviewModal';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'kanban' | 'search' | 'profile' | 'settings' | 'console'>('kanban');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [queries, setQueries] = useState<SearchQuery[]>([]);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  
  // Modals state
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [cvPreviewTarget, setCvPreviewTarget] = useState<{ job?: Job; isBase?: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [s, j, q, p, st, l] = await Promise.all([
        api.fetchStats(),
        api.fetchJobs(),
        api.fetchSearchQueries(),
        api.fetchProfile(),
        api.fetchSettings(),
        api.fetchLogs()
      ]);
      setStats(s);
      setJobs(j);
      setQueries(q);
      setProfile(p);
      setSettings(st);
      setLogs(l);

      // Refresh opened modals if any
      if (selectedJob) {
        const updated = j.find((x: Job) => x.id === selectedJob.id);
        if (updated) setSelectedJob(updated);
      }
      if (cvPreviewTarget?.job) {
        const updatedCV = j.find((x: Job) => x.id === cvPreviewTarget.job!.id);
        if (updatedCV) setCvPreviewTarget({ job: updatedCV });
      }
    } catch (err) {
      console.error('Error loading data:', err);
    }
  }, [selectedJob, cvPreviewTarget]);

  // Initial load & Polling interval
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [loadData]);

  // WebSocket Live Updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (
          payload.type === 'job_updated' || 
          payload.type === 'job_deleted' || 
          payload.type === 'settings_updated' ||
          payload.type === 'jobs_batch_applied'
        ) {
          loadData();
        }
      } catch (e) {
        console.error('WebSocket parse error:', e);
      }
    };

    return () => {
      socket.close();
    };
  }, [loadData]);

  const handleToggleAutopilot = async () => {
    setIsLoading(true);
    try {
      await api.toggleAutopilot();
      await loadData();
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePause = async () => {
    setIsLoading(true);
    try {
      await api.togglePause();
      await loadData();
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleBatchValidation = async () => {
    setIsLoading(true);
    try {
      await api.toggleBatchValidation();
      await loadData();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectProvider = async (p: 'agy' | 'claude' | 'codex') => {
    setIsLoading(true);
    try {
      await api.setAiProvider(p);
      await loadData();
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyJob = async (jobId: number) => {
    try {
      await api.applyJob(jobId);
      await loadData();
    } catch (err) {
      console.error('Error applying to job:', err);
    }
  };

  const handleTailorJob = async (jobId: number) => {
    try {
      await api.tailorJob(jobId);
      await loadData();
    } catch (err) {
      console.error('Error tailoring CV:', err);
    }
  };

  const handleBatchValidate = async () => {
    setIsLoading(true);
    try {
      await api.batchValidate();
      await loadData();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulateReply = async (jobId: number) => {
    try {
      await api.simulateReply(jobId);
      await loadData();
    } catch (err) {
      console.error('Error simulating reply:', err);
    }
  };

  const handleMoveStatus = async (jobId: number, newStatus: JobStatus) => {
    try {
      await api.updateJobStatus(jobId, newStatus);
      await loadData();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleImproveCV = async (jobId: number): Promise<CVImprovementSuggestions> => {
    const res = await api.improveJobCV(jobId);
    await loadData();
    return res.improvements;
  };

  const handleApplyImprovements = async (jobId: number) => {
    await api.applyImprovements(jobId);
    await loadData();
  };

  const handleAddQuery = async (newQuery: {
    query_text: string;
    location: string;
    radius_km: number;
    contract_types: string[];
    platforms: string[];
  }) => {
    await api.addSearchQuery(newQuery);
    await loadData();
  };

  const handleDeleteQuery = async (id: number) => {
    await api.deleteSearchQuery(id);
    await loadData();
  };

  const handleRunSearchNow = async () => {
    setIsLoading(true);
    try {
      await api.runSearchNow();
      setTimeout(loadData, 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async (p: CandidateProfile) => {
    setIsLoading(true);
    try {
      await api.updateProfile(p);
      await loadData();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async (st: Partial<SystemSettings>) => {
    setIsLoading(true);
    try {
      await api.updateSettings(st);
      await loadData();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-pickle-dark text-pickle-light flex flex-col font-sans selection:bg-pickle-lime selection:text-pickle-dark">
      {/* Pickles.team Inspired Control Bar */}
      <ControlBar
        stats={stats}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onToggleAutopilot={handleToggleAutopilot}
        onTogglePause={handleTogglePause}
        onToggleBatchValidation={handleToggleBatchValidation}
        onSelectProvider={handleSelectProvider}
        isLoading={isLoading}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {activeTab === 'kanban' && (
          <KanbanBoard
            jobs={jobs}
            waitBatchValidation={stats?.wait_for_batch_validation ?? false}
            onOpenDetails={(job) => setSelectedJob(job)}
            onPreviewCV={(job) => setCvPreviewTarget({ job })}
            onImproveCV={(job) => setCvPreviewTarget({ job })}
            onApply={handleApplyJob}
            onTailor={handleTailorJob}
            onSimulateReply={handleSimulateReply}
            onMoveStatus={handleMoveStatus}
            onBatchValidate={handleBatchValidate}
          />
        )}

        {activeTab === 'search' && (
          <SearchTab
            queries={queries}
            onAddQuery={handleAddQuery}
            onDeleteQuery={handleDeleteQuery}
            onRunSearchNow={handleRunSearchNow}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            profile={profile}
            onSaveProfile={handleSaveProfile}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            settings={settings}
            onSaveSettings={handleSaveSettings}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'console' && (
          <LiveConsole
            logs={logs}
            onRefresh={loadData}
            isLoading={isLoading}
          />
        )}
      </main>

      {/* Detailed Modal */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onApply={handleApplyJob}
          onTailor={handleTailorJob}
        />
      )}

      {/* Dedicated CV Preview & AI Improvement Modal */}
      {cvPreviewTarget && (
        <CVPreviewModal
          job={cvPreviewTarget.job}
          baseProfile={profile}
          onClose={() => setCvPreviewTarget(null)}
          onImproveCV={handleImproveCV}
          onApplyImprovements={handleApplyImprovements}
          onEditBaseProfile={() => setActiveTab('profile')}
        />
      )}
    </div>
  );
};

export default App;
