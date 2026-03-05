"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  summary: string;
  skills: string[];
  pictureUrl: string | null;
  teamTailorId: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  _count: { assignments: number; reviews: number };
}

interface TTJob {
  id: string;
  title: string;
  status: string;
}

interface TTCandidate {
  teamTailorId: string;
  firstName: string;
  lastName: string;
  email: string;
  pitch: string;
  pictureUrl: string | null;
  imported: boolean;
  rosterId: string | null;
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);

  const [jobs, setJobs] = useState<TTJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState("");

  const [selectedJob, setSelectedJob] = useState<TTJob | null>(null);
  const [ttCandidates, setTtCandidates] = useState<TTCandidate[]>([]);
  const [applicantsLoading, setApplicantsLoading] = useState(false);
  const [applicantsError, setApplicantsError] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  const fetchCandidates = useCallback(async () => {
    try {
      const res = await fetch("/api/candidates");
      if (!res.ok) { setCandidates([]); return; }
      const data = await res.json();
      setCandidates(Array.isArray(data) ? data : []);
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  function openPanel() {
    if (jobsLoading) return;
    setShowPanel(true);
    setSelectedJob(null);
    setTtCandidates([]);
    setSelected(new Set());
    setImportMessage("");
    setJobsError("");
    loadJobs();
  }

  function closePanel() {
    setShowPanel(false);
    setSelectedJob(null);
    setJobs([]);
    setTtCandidates([]);
    setSelected(new Set());
    setImportMessage("");
  }

  async function loadJobs() {
    setJobsLoading(true);
    setJobsError("");
    try {
      const res = await fetch("/api/teamtailor/jobs");
      const data = await res.json();
      if (!res.ok) setJobsError(data.error ?? "Failed to load jobs");
      else setJobs(data.jobs);
    } catch {
      setJobsError("Couldn't reach Team Tailor. Check your API key.");
    } finally {
      setJobsLoading(false);
    }
  }

  async function selectJob(job: TTJob) {
    setSelectedJob(job);
    setTtCandidates([]);
    setSelected(new Set());
    setImportMessage("");
    setApplicantsError("");
    setApplicantsLoading(true);
    try {
      const res = await fetch(`/api/teamtailor/jobs/${job.id}/applicants`);
      const data = await res.json();
      if (!res.ok) setApplicantsError(data.error ?? "Failed to load applicants");
      else setTtCandidates(data.candidates);
    } catch {
      setApplicantsError("Couldn't reach Team Tailor. Check your API key.");
    } finally {
      setApplicantsLoading(false);
    }
  }

  function backToJobs() {
    setSelectedJob(null);
    setTtCandidates([]);
    setSelected(new Set());
    setImportMessage("");
    setApplicantsError("");
  }

  function toggleSelect(id: string) {
    setImportMessage("");
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setImporting(true);
    setImportMessage("");
    try {
      const toImport = ttCandidates.filter((c) => selected.has(c.teamTailorId));
      const res = await fetch("/api/teamtailor/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidates: toImport }),
      });
      if (res.ok) {
        const data = await res.json();
        setImportMessage(`Imported ${data.imported} candidate${data.imported !== 1 ? "s" : ""}`);
        setSelected(new Set());
        try {
          if (selectedJob) {
            const refreshed = await fetch(`/api/teamtailor/jobs/${selectedJob.id}/applicants`);
            if (refreshed.ok) setTtCandidates((await refreshed.json()).candidates);
          }
        } catch { /* non-critical */ }
        fetchCandidates();
      } else {
        setImportMessage("Import failed — please try again");
      }
    } catch {
      setImportMessage("Import failed — please try again");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-xl font-bold text-navy-950 tracking-tight">Candidates</h1>
          <p className="text-navy-400 text-sm mt-0.5">{candidates.length} candidates in Roster</p>
        </div>
        <button
          onClick={openPanel}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-md text-sm flex items-center gap-2 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Add from Team Tailor
        </button>
      </div>

      {/* Team Tailor Panel */}
      {showPanel && (
        <div className="bg-white rounded-lg border border-navy-200 p-5 mb-5 animate-fade-in-scale">
          {/* Panel header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              {selectedJob && (
                <button
                  onClick={backToJobs}
                  className="text-navy-400 hover:text-navy-700 p-1 rounded hover:bg-navy-50 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                </button>
              )}
              <h2 className="text-sm font-semibold text-navy-950">
                {selectedJob ? selectedJob.title : "Add from Team Tailor"}
              </h2>
            </div>
            <button
              onClick={closePanel}
              className="text-navy-400 hover:text-navy-600 p-1 rounded hover:bg-navy-50 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Jobs view */}
          {!selectedJob && (
            <>
              {jobsLoading && (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-navy-200 border-t-orange-500" />
                  <span className="ml-3 text-navy-400 text-sm">Loading jobs…</span>
                </div>
              )}
              {jobsError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-3">{jobsError}</p>
              )}
              {!jobsLoading && !jobsError && jobs.length === 0 && (
                <p className="text-sm text-navy-400 text-center py-8">No jobs found in Team Tailor</p>
              )}
              {!jobsLoading && jobs.length > 0 && (
                <div className="divide-y divide-navy-100">
                  {jobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => selectJob(job)}
                      className="flex items-center justify-between w-full text-left px-2 py-3 hover:bg-navy-50 transition-colors group"
                    >
                      <div>
                        <p className="text-sm font-medium text-navy-900 group-hover:text-orange-600 transition-colors">{job.title}</p>
                        <p className="text-xs text-navy-400 mt-0.5 capitalize">{job.status}</p>
                      </div>
                      <svg className="w-4 h-4 text-navy-300 group-hover:text-orange-500 transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Applicants view */}
          {selectedJob && (
            <>
              {applicantsLoading && (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-navy-200 border-t-orange-500" />
                  <span className="ml-3 text-navy-400 text-sm">Loading applicants…</span>
                </div>
              )}
              {applicantsError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-3">{applicantsError}</p>
              )}
              {!applicantsLoading && !applicantsError && ttCandidates.length === 0 && (
                <p className="text-sm text-navy-400 text-center py-8">No applicants found for this job</p>
              )}
              {!applicantsLoading && ttCandidates.length > 0 && (
                <div className="border border-navy-200 rounded-md overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-navy-50 sticky top-0 border-b border-navy-200">
                      <tr>
                        <th className="w-10 px-4 py-2.5"></th>
                        <th className="text-left text-[11px] font-semibold text-navy-500 uppercase tracking-wider px-4 py-2.5">Name</th>
                        <th className="text-left text-[11px] font-semibold text-navy-500 uppercase tracking-wider px-4 py-2.5">Email</th>
                        <th className="text-left text-[11px] font-semibold text-navy-500 uppercase tracking-wider px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-100">
                      {ttCandidates.map((c) => (
                        <tr key={c.teamTailorId} className="hover:bg-navy-50/40 transition-colors">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selected.has(c.teamTailorId)}
                              onChange={() => toggleSelect(c.teamTailorId)}
                              className="rounded border-navy-300 text-orange-500 focus:ring-orange-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              {c.pictureUrl ? (
                                <img src={c.pictureUrl} alt="" className="w-7 h-7 rounded-full object-cover ring-1 ring-navy-100" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-navy-100 flex items-center justify-center text-xs font-bold text-navy-600">
                                  {c.firstName[0] ?? "?"}
                                </div>
                              )}
                              <span className="text-sm font-medium text-navy-900">{c.firstName} {c.lastName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-navy-500">{c.email}</td>
                          <td className="px-4 py-3">
                            {c.imported ? (
                              <span className="text-[11px] font-semibold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded">Imported</span>
                            ) : (
                              <span className="text-[11px] font-semibold bg-navy-50 text-navy-500 border border-navy-200 px-2 py-0.5 rounded">New</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {selected.size > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-navy-100">
                  <button onClick={() => setSelected(new Set())} className="text-sm text-navy-400 hover:text-navy-600">
                    Clear selection
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold rounded-md transition-colors"
                  >
                    {importing ? "Importing…" : `Import ${selected.size} selected`}
                  </button>
                </div>
              )}
              {importMessage && (
                <p className={`text-sm font-medium mt-3 ${importMessage.includes("fail") ? "text-red-600" : "text-green-600"}`}>
                  {importMessage}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Candidate List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-navy-200 border-t-orange-500" />
        </div>
      ) : candidates.length === 0 ? (
        <div className="bg-white rounded-lg border border-navy-200 p-16 text-center">
          <div className="w-12 h-12 bg-navy-50 rounded-md flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-navy-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-navy-900 mb-1">No candidates yet</h3>
          <p className="text-navy-400 text-sm">Click &ldquo;Add from Team Tailor&rdquo; to import candidates</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-navy-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-navy-50 border-b border-navy-200">
              <tr>
                <th className="text-left text-[11px] font-semibold text-navy-500 uppercase tracking-wider px-5 py-3">Candidate</th>
                <th className="text-left text-[11px] font-semibold text-navy-500 uppercase tracking-wider px-5 py-3">Skills</th>
                <th className="text-left text-[11px] font-semibold text-navy-500 uppercase tracking-wider px-5 py-3">Companies</th>
                <th className="text-left text-[11px] font-semibold text-navy-500 uppercase tracking-wider px-5 py-3">Reviews</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {candidates.map((c) => (
                <tr key={c.id} className="hover:bg-navy-50/40 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {c.pictureUrl ? (
                        <img src={c.pictureUrl} alt="" className="w-9 h-9 rounded-full object-cover ring-1 ring-navy-100" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-navy-100 flex items-center justify-center text-sm font-bold text-navy-600">
                          {c.firstName[0] ?? "?"}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-navy-900 group-hover:text-orange-600 transition-colors">{c.firstName} {c.lastName}</p>
                        <p className="text-xs text-navy-400 mt-0.5">{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {(c.skills as string[]).slice(0, 3).map((s, i) => (
                        <span key={i} className="text-[11px] font-medium bg-navy-50 text-navy-600 px-2 py-0.5 rounded border border-navy-100">{s}</span>
                      ))}
                      {(c.skills as string[]).length > 3 && (
                        <span className="text-[11px] text-navy-400 font-medium">+{(c.skills as string[]).length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-semibold text-navy-700">{c._count.assignments}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-semibold text-navy-700">{c._count.reviews}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/candidates/${c.id}`}
                      className="text-xs text-orange-500 hover:text-orange-600 font-semibold inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Edit
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
