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
  const [showSync, setShowSync] = useState(false);
  const [query, setQuery] = useState("");
  const [ttCandidates, setTtCandidates] = useState<TTCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [importMessage, setImportMessage] = useState("");

  const fetchCandidates = useCallback(async () => {
    const res = await fetch("/api/candidates");
    const data = await res.json();
    setCandidates(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  useEffect(() => {
    if (query.length < 2) {
      setTtCandidates([]);
      setSearchError("");
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const res = await fetch(`/api/teamtailor/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (!res.ok) {
          setSearchError(data.error ?? "Search failed");
          setTtCandidates([]);
        } else {
          setTtCandidates(data.candidates);
        }
      } catch {
        setSearchError("Couldn't reach Team Tailor. Check your API key has Candidates scope.");
        setTtCandidates([]);
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function handleImport() {
    if (selected.size === 0) return;
    setImporting(true);
    setImportMessage("");

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
      const refreshed = await fetch(`/api/teamtailor/search?q=${encodeURIComponent(query)}`);
      if (refreshed.ok) {
        const d = await refreshed.json();
        setTtCandidates(d.candidates);
      }
      fetchCandidates();
    } else {
      setImportMessage("Import failed — please try again");
    }
    setImporting(false);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Candidates</h1>
          <p className="text-navy-500 text-sm mt-1">{candidates.length} candidates in Roster</p>
        </div>
        <button
          onClick={() => { setShowSync(!showSync); if (showSync) { setQuery(""); setTtCandidates([]); setSelected(new Set()); } }}
          className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl shadow-sm shadow-orange-500/20 hover:shadow-orange-500/30 text-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          Add from Team Tailor
        </button>
      </div>

      {/* Team Tailor Search Panel */}
      {showSync && (
        <div className="bg-white rounded-2xl border border-navy-100/80 p-6 mb-6 shadow-sm animate-fade-in-scale">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-navy-950 flex items-center gap-2">
              <div className="w-1 h-5 bg-orange-500 rounded-full" />
              Add from Team Tailor
            </h2>
            <button
              onClick={() => { setShowSync(false); setQuery(""); setTtCandidates([]); setSelected(new Set()); setImportMessage(""); }}
              className="text-navy-400 hover:text-navy-600 p-1 rounded-lg hover:bg-navy-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Search input */}
          <div className="relative mb-4">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelected(new Set()); setImportMessage(""); }}
              placeholder="Search by name or email…"
              className="w-full pl-10 pr-10 py-3 border border-navy-200 rounded-xl text-navy-950 placeholder:text-navy-300 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 bg-cream-50/50 text-sm"
              autoFocus
            />
            {searching && (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-navy-200 border-t-orange-500" />
              </div>
            )}
          </div>

          {/* Error */}
          {searchError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">{searchError}</p>
          )}

          {/* Empty state */}
          {!searching && query.length < 2 && !searchError && (
            <p className="text-sm text-navy-400 text-center py-8">Start typing to search Team Tailor candidates</p>
          )}

          {/* No results */}
          {!searching && query.length >= 2 && ttCandidates.length === 0 && !searchError && (
            <p className="text-sm text-navy-400 text-center py-8">No candidates found for &ldquo;{query}&rdquo;</p>
          )}

          {/* Results */}
          {ttCandidates.length > 0 && (
            <div className="border border-navy-100 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-navy-50/80 sticky top-0">
                  <tr>
                    <th className="w-10 px-4 py-3"></th>
                    <th className="text-left text-[11px] font-semibold text-navy-500 uppercase tracking-wider px-4 py-3">Name</th>
                    <th className="text-left text-[11px] font-semibold text-navy-500 uppercase tracking-wider px-4 py-3">Email</th>
                    <th className="text-left text-[11px] font-semibold text-navy-500 uppercase tracking-wider px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {ttCandidates.map((c) => (
                    <tr key={c.teamTailorId} className="hover:bg-cream-50/50 cursor-pointer" onClick={() => toggleSelect(c.teamTailorId)}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(c.teamTailorId)}
                          onChange={() => toggleSelect(c.teamTailorId)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-navy-300 text-orange-500 focus:ring-orange-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {c.pictureUrl ? (
                            <img src={c.pictureUrl} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-navy-100" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-navy-100 to-navy-200 flex items-center justify-center text-xs font-bold text-navy-600">
                              {c.firstName[0]}
                            </div>
                          )}
                          <span className="text-sm font-medium text-navy-900">{c.firstName} {c.lastName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-navy-500">{c.email}</td>
                      <td className="px-4 py-3">
                        {c.imported ? (
                          <span className="text-[11px] font-semibold bg-green-50 text-green-700 border border-green-200 px-2.5 py-0.5 rounded-full">Imported</span>
                        ) : (
                          <span className="text-[11px] font-semibold bg-navy-50 text-navy-500 border border-navy-200 px-2.5 py-0.5 rounded-full">New</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Sticky footer */}
          {selected.size > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-navy-100">
              <button onClick={() => setSelected(new Set())} className="text-sm text-navy-400 hover:text-navy-600 font-medium">
                Clear selection
              </button>
              <div className="flex items-center gap-3">
                {importMessage && (
                  <span className={`text-sm font-medium ${importMessage.includes("fail") ? "text-red-600" : "text-green-600"}`}>
                    {importMessage}
                  </span>
                )}
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="px-5 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-sm shadow-orange-500/20"
                >
                  {importing ? "Importing…" : `Import ${selected.size} selected`}
                </button>
              </div>
            </div>
          )}

          {/* Import success message when nothing selected */}
          {importMessage && selected.size === 0 && (
            <p className="text-sm text-green-600 font-medium mt-3">{importMessage}</p>
          )}
        </div>
      )}

      {/* Candidate List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy-200 border-t-orange-500" />
        </div>
      ) : candidates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-navy-100/80 p-16 text-center shadow-sm">
          <div className="w-16 h-16 bg-navy-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-navy-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-navy-900 mb-2">No candidates yet</h3>
          <p className="text-navy-400 text-sm">Click &ldquo;Add from Team Tailor&rdquo; to import candidates</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-navy-100/80 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-navy-50/60 border-b border-navy-100">
              <tr>
                <th className="text-left text-[11px] font-semibold text-navy-500 uppercase tracking-wider px-6 py-4">Candidate</th>
                <th className="text-left text-[11px] font-semibold text-navy-500 uppercase tracking-wider px-6 py-4">Skills</th>
                <th className="text-left text-[11px] font-semibold text-navy-500 uppercase tracking-wider px-6 py-4">Companies</th>
                <th className="text-left text-[11px] font-semibold text-navy-500 uppercase tracking-wider px-6 py-4">Reviews</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {candidates.map((c) => (
                <tr key={c.id} className="hover:bg-cream-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3.5">
                      {c.pictureUrl ? (
                        <img src={c.pictureUrl} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-navy-100" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy-100 to-navy-200 flex items-center justify-center text-sm font-bold text-navy-600">
                          {c.firstName[0]}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-navy-900 group-hover:text-orange-600 transition-colors">{c.firstName} {c.lastName}</p>
                        <p className="text-xs text-navy-400 mt-0.5">{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {(c.skills as string[]).slice(0, 3).map((s, i) => (
                        <span key={i} className="text-[11px] font-medium bg-navy-50 text-navy-600 px-2.5 py-1 rounded-md">{s}</span>
                      ))}
                      {(c.skills as string[]).length > 3 && (
                        <span className="text-[11px] text-navy-400 font-medium px-1">+{(c.skills as string[]).length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-navy-700">{c._count.assignments}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-navy-700">{c._count.reviews}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/candidates/${c.id}`}
                      className="text-sm text-orange-500 hover:text-orange-600 font-semibold inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Edit
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
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
