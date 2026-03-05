"use client";

import { useState, useEffect, use, useCallback } from "react";
import { signIn, useSession } from "next-auth/react";

interface Experience {
  title: string;
  company: string;
  startDate: string;
  endDate: string;
  description: string;
}

interface Education {
  degree: string;
  school: string;
  year: string;
}

interface CandidateReview {
  id: string;
  status: string;
  feedback: string | null;
}

interface Candidate {
  id: string;
  assignmentId: string;
  firstName: string;
  summary: string | null;
  tailoredSummary: string | null;
  role: { id: string; title: string } | null;
  skills: string[];
  experience: Experience[];
  education: Education[];
  pictureUrl: string | null;
  myReview: CandidateReview | null;
}

interface RoleGroup {
  id: string;
  title: string;
  candidates: Candidate[];
}

interface PortalData {
  authenticated: boolean;
  company: { name: string };
  candidates?: Candidate[];
}

export default function ReviewPortal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { data: session, status: sessionStatus } = useSession();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [filter, setFilter] = useState("all");

  // Auth state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"email" | "password">("email");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLink, setMagicLink] = useState("");

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/review/${token}`);
    if (!res.ok) {
      setError("This link is invalid or has been revoked.");
      setLoading(false);
      return;
    }
    const result = await res.json();
    setData(result);
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData, sessionStatus]);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    const res = await fetch("/api/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, companyToken: token }),
    });

    const result = await res.json();
    if (res.ok) {
      setMagicLinkSent(true);
      if (result.magicLink) setMagicLink(result.magicLink);
    } else {
      setAuthError(result.error || "Failed to send magic link");
    }
    setAuthLoading(false);
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    const result = await signIn("reviewer-login", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setAuthError("Invalid credentials");
      setAuthLoading(false);
    } else {
      window.location.reload();
    }
  }

  async function handleMagicLinkAuth() {
    if (!magicLink) return;
    const urlToken = new URLSearchParams(magicLink.split("?")[1]).get("token");
    if (!urlToken) return;

    const result = await signIn("magic-link", { token: urlToken, redirect: false });
    if (result?.error) {
      setAuthError("Magic link expired or invalid");
    } else {
      window.location.reload();
    }
  }

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("token");
    if (urlToken) {
      signIn("magic-link", { token: urlToken, redirect: false }).then((result) => {
        if (!result?.error) {
          window.location.href = window.location.pathname;
        }
      });
    }
  }, []);

  async function handleSubmitReview(candidateId: string, assignmentId: string, status: string, feedback: string) {
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId, assignmentId, status, feedback }),
    });

    if (res.ok) {
      fetchData();
      setSelectedCandidate(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy-200 border-t-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 bg-red-500/15 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Link Unavailable</h1>
          <p className="text-navy-300">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Auth Screen
  if (!data.authenticated) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
        <div className="relative z-10 w-full max-w-md px-6 animate-fade-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="text-left">
                <span className="text-xl font-bold text-white block leading-tight">Roster</span>
                <span className="text-navy-400 text-[10px] font-medium tracking-widest uppercase">Blue Orange Digital</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl shadow-navy-950/30 p-8 border border-white/10">
            <h1 className="text-xl font-bold text-navy-950 mb-1">
              Candidate Review
            </h1>
            <p className="text-navy-400 text-sm mb-7">
              Sign in to review candidates for <span className="font-semibold text-navy-700">{data.company.name}</span>
            </p>

            {magicLinkSent ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                </div>
                <p className="text-navy-700 font-bold mb-1">Check your email</p>
                <p className="text-navy-400 text-sm mb-4">We sent a login link to {email}</p>
                {process.env.NODE_ENV === "development" && magicLink && (
                  <button
                    onClick={handleMagicLinkAuth}
                    className="text-sm text-orange-500 hover:text-orange-600 font-semibold underline"
                  >
                    [Dev] Click here to authenticate
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="flex gap-1.5 mb-6 bg-navy-50 p-1 rounded-xl">
                  <button
                    onClick={() => setAuthMode("email")}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${authMode === "email" ? "bg-white text-navy-900 shadow-sm" : "text-navy-500 hover:text-navy-700"}`}
                  >
                    Magic Link
                  </button>
                  <button
                    onClick={() => setAuthMode("password")}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${authMode === "password" ? "bg-white text-navy-900 shadow-sm" : "text-navy-500 hover:text-navy-700"}`}
                  >
                    Password
                  </button>
                </div>

                <form onSubmit={authMode === "email" ? handleMagicLink : handlePasswordLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-navy-700 mb-2">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                      className="w-full px-4 py-3 border border-navy-200 rounded-xl text-navy-950 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 bg-cream-50/50"
                      placeholder="your@email.com" />
                  </div>

                  {authMode === "password" && (
                    <div>
                      <label className="block text-sm font-semibold text-navy-700 mb-2">Password</label>
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                        className="w-full px-4 py-3 border border-navy-200 rounded-xl text-navy-950 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 bg-cream-50/50" />
                    </div>
                  )}

                  {authError && (
                    <div className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3 border border-red-100 flex items-center gap-2">
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
                      {authError}
                    </div>
                  )}

                  <button type="submit" disabled={authLoading}
                    className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-60 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/25">
                    {authLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        Processing...
                      </span>
                    ) : authMode === "email" ? "Send Magic Link" : "Sign in"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Review Portal
  const candidates = data.candidates || [];
  const filteredCandidates = candidates.filter((c) => {
    if (filter === "all") return true;
    if (filter === "not_reviewed") return !c.myReview || c.myReview.status === "NOT_REVIEWED";
    if (filter === "reviewed") return c.myReview && c.myReview.status !== "NOT_REVIEWED";
    return c.myReview?.status === filter;
  });

  const reviewedCount = candidates.filter((c) => c.myReview && c.myReview.status !== "NOT_REVIEWED").length;

  if (selectedCandidate) {
    return (
      <ReviewCandidateView
        candidate={selectedCandidate}
        companyName={data.company.name}
        onBack={() => { setSelectedCandidate(null); fetchData(); }}
        onSubmit={handleSubmitReview}
      />
    );
  }

  const totalRoleCount = new Set(candidates.map(c => c.role?.id ?? "__none__")).size;
  const useGroupedLayout = totalRoleCount > 1;
  const roleGroups: RoleGroup[] = [];
  if (useGroupedLayout) {
    const seenRoles = new Map<string, RoleGroup>();
    for (const c of filteredCandidates) {
      const roleKey = c.role?.id ?? "__none__";
      if (!seenRoles.has(roleKey)) {
        const group: RoleGroup = { id: roleKey, title: c.role?.title ?? "General", candidates: [] };
        seenRoles.set(roleKey, group);
        roleGroups.push(group);
      }
      seenRoles.get(roleKey)!.candidates.push(c);
    }
  }

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-navy-950 to-navy-900 text-white border-b border-navy-800/50">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <span className="font-bold tracking-tight">Roster</span>
              <span className="text-navy-500 text-sm ml-2">&middot; {data.company.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-navy-300">
              <span className="font-bold text-orange-400">{reviewedCount}</span> of <span className="font-bold text-white">{candidates.length}</span> reviewed
            </div>
            {/* Progress bar */}
            <div className="w-24 h-1.5 bg-navy-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${candidates.length > 0 ? (reviewedCount / candidates.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8 animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Candidates</h1>
            <p className="text-navy-400 text-sm mt-1">Review and provide feedback on each candidate</p>
          </div>
          <div className="flex gap-1.5 bg-white border border-navy-100/80 p-1 rounded-xl shadow-sm">
            {["all", "not_reviewed", "REQUEST_INTERVIEW", "NOT_INTERESTED"].map((f) => {
              const labels: Record<string, string> = {
                all: "All",
                not_reviewed: "To Review",
                REQUEST_INTERVIEW: "Interview",
                NOT_INTERESTED: "Not Interested",
              };
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${filter === f ? "bg-navy-900 text-white shadow-sm" : "text-navy-500 hover:text-navy-700 hover:bg-cream-50"}`}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Candidate Cards — grouped by role when multiple roles exist */}
        {useGroupedLayout ? (
          <div className="space-y-10">
            {roleGroups.filter(g => g.candidates.length > 0).map((group) => (
              <div key={group.id}>
                <h2 className="text-lg font-bold text-navy-950 mb-1">{group.title}</h2>
                <p className="text-navy-400 text-sm mb-5">{group.candidates.length} candidate{group.candidates.length !== 1 ? "s" : ""}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {group.candidates.map((candidate) => (
                    <CandidateCard key={candidate.id} candidate={candidate} onClick={() => setSelectedCandidate(candidate)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
            {filteredCandidates.map((candidate) => (
              <CandidateCard key={candidate.id} candidate={candidate} onClick={() => setSelectedCandidate(candidate)} />
            ))}
          </div>
        )}

        {filteredCandidates.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-navy-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-navy-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
            </div>
            <h3 className="text-lg font-bold text-navy-900 mb-1">No candidates match this filter</h3>
            <p className="text-navy-400 text-sm">Try selecting a different filter above</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewCandidateView({
  candidate,
  companyName,
  onBack,
  onSubmit,
}: {
  candidate: Candidate;
  companyName: string;
  onBack: () => void;
  onSubmit: (candidateId: string, assignmentId: string, status: string, feedback: string) => void;
}) {
  const [status, setStatus] = useState(candidate.myReview?.status || "");
  const [feedback, setFeedback] = useState(candidate.myReview?.feedback || "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!status) return;
    setSubmitting(true);
    await onSubmit(candidate.id, candidate.assignmentId, status, feedback);
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-navy-950 to-navy-900 text-white border-b border-navy-800/50">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
          <button onClick={onBack} className="text-navy-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-all">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-bold tracking-tight">Roster</span>
            <span className="text-navy-500 text-sm">&middot; {companyName}</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 animate-fade-in">
        {/* Profile Header */}
        <div className="bg-gradient-to-br from-navy-950 to-navy-900 rounded-t-2xl p-10 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }} />
          <div className="relative flex items-center gap-6">
            {candidate.pictureUrl ? (
              <img src={candidate.pictureUrl} alt="" className="w-24 h-24 rounded-xl object-cover ring-2 ring-orange-500/50 shadow-lg" />
            ) : (
              <div className="w-24 h-24 rounded-xl bg-navy-800 flex items-center justify-center text-3xl font-bold text-orange-400 ring-2 ring-orange-500/50">
                {candidate.firstName[0]}
              </div>
            )}
            <div>
              <p className="text-orange-400 text-xs font-semibold uppercase tracking-widest mb-1">Candidate Profile</p>
              <h1 className="text-3xl font-bold tracking-tight">{candidate.firstName}</h1>
              {candidate.role && (
                <p className="text-navy-300 text-sm mt-1">{candidate.role.title}</p>
              )}
            </div>
          </div>
        </div>

        {/* Profile Content */}
        <div className="bg-white rounded-b-2xl border border-t-0 border-navy-100/80 shadow-sm">
          <div className="p-10 space-y-10">
            {(candidate.tailoredSummary || candidate.summary) && (
              <div>
                <h2 className="text-[11px] font-bold text-orange-500 uppercase tracking-[0.15em] mb-3">Summary</h2>
                <p className="text-navy-700 leading-[1.75] text-[15px]">{candidate.tailoredSummary || candidate.summary}</p>
              </div>
            )}

            {candidate.skills.length > 0 && (
              <div>
                <h2 className="text-[11px] font-bold text-orange-500 uppercase tracking-[0.15em] mb-4">Skills &amp; Expertise</h2>
                <div className="flex flex-wrap gap-2">
                  {(candidate.skills as string[]).map((skill, i) => (
                    <span key={i} className="bg-navy-50 text-navy-700 px-4 py-2 rounded-lg text-sm font-medium border border-navy-100/60">{skill}</span>
                  ))}
                </div>
              </div>
            )}

            {candidate.experience.length > 0 && (
              <div>
                <h2 className="text-[11px] font-bold text-orange-500 uppercase tracking-[0.15em] mb-6">Professional Experience</h2>
                <div className="space-y-6">
                  {(candidate.experience as Experience[]).map((exp, i) => (
                    <div key={i} className="relative pl-6">
                      <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-orange-500" />
                      {i < candidate.experience.length - 1 && (
                        <div className="absolute left-[3px] top-4 bottom-0 w-0.5 bg-orange-200" />
                      )}
                      <h3 className="text-base font-bold text-navy-900">{exp.title}</h3>
                      <p className="text-sm text-navy-600 font-semibold">{exp.company}</p>
                      <p className="text-xs text-navy-400 mt-0.5 font-medium">{exp.startDate} &mdash; {exp.endDate || "Present"}</p>
                      {exp.description && <p className="text-sm text-navy-600 mt-2.5 leading-relaxed">{exp.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {candidate.education.length > 0 && (
              <div>
                <h2 className="text-[11px] font-bold text-orange-500 uppercase tracking-[0.15em] mb-6">Education</h2>
                <div className="space-y-4">
                  {(candidate.education as Education[]).map((edu, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-navy-50 flex items-center justify-center text-navy-500 shrink-0 border border-navy-100/60">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>
                      </div>
                      <div>
                        <p className="font-bold text-navy-900">{edu.degree}</p>
                        <p className="text-sm text-navy-500">{edu.school} &middot; {edu.year}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Review Panel */}
        <div className="bg-white rounded-2xl border border-navy-100/80 p-8 mt-6 shadow-sm">
          <h2 className="text-lg font-bold text-navy-950 mb-6 flex items-center gap-2">
            <div className="w-1 h-5 bg-orange-500 rounded-full" />
            Your Review
          </h2>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { value: "REQUEST_INTERVIEW", label: "Request Interview", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z", activeBg: "bg-orange-50 border-orange-300 text-orange-700", activeRing: "ring-orange-200" },
              { value: "NOT_INTERESTED", label: "Not Interested", icon: "M18 6L6 18M6 6l12 12", activeBg: "bg-red-50 border-red-300 text-red-700", activeRing: "ring-red-200" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setStatus(option.value)}
                className={`py-4 px-4 rounded-xl text-sm font-semibold border-2 transition-all flex flex-col items-center gap-2 ${
                  status === option.value
                    ? `${option.activeBg} ring-2 ${option.activeRing}`
                    : "border-navy-100 text-navy-500 hover:border-navy-200 hover:bg-cream-50"
                }`}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={option.icon} /></svg>
                {option.label}
              </button>
            ))}
          </div>

          {(status === "NOT_INTERESTED" || feedback) && (
            <div className="mb-5">
              <label className="block text-sm font-semibold text-navy-700 mb-2">
                {status === "NOT_INTERESTED" ? "Reason (optional but appreciated)" : "Comments"}
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-navy-200 rounded-xl text-navy-950 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 resize-none bg-cream-50/50 leading-relaxed"
                placeholder="Share your thoughts..."
              />
            </div>
          )}

          {status && status !== "NOT_INTERESTED" && !feedback && (
            <button
              onClick={() => setFeedback(" ")}
              className="text-sm text-navy-400 hover:text-navy-600 mb-5 font-medium"
            >
              + Add comments
            </button>
          )}

          <button
            onClick={handleSubmit}
            disabled={!status || submitting}
            className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-60 disabled:hover:from-orange-500 disabled:hover:to-orange-600 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/25 text-base"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                Submitting...
              </span>
            ) : candidate.myReview ? "Update Review" : "Submit Review"}
          </button>
        </div>

        {/* Branding */}
        <div className="mt-8 pb-4 text-center">
          <div className="inline-flex items-center gap-2.5">
            <div className="w-6 h-6 bg-gradient-to-br from-orange-400 to-orange-600 rounded-md flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-white">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-xs text-navy-400 font-medium">Powered by <span className="text-navy-600 font-semibold">Blue Orange Digital</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CandidateCard({ candidate, onClick }: { candidate: Candidate; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl border border-navy-100/80 p-6 text-left card-hover group shadow-sm"
    >
      <div className="flex items-center gap-3.5 mb-4">
        {candidate.pictureUrl ? (
          <img src={candidate.pictureUrl} alt="" className="w-14 h-14 rounded-xl object-cover ring-2 ring-navy-100" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-navy-100 to-navy-200 flex items-center justify-center text-lg font-bold text-navy-600">
            {candidate.firstName[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-navy-900 group-hover:text-orange-600 transition-colors text-base">
            {candidate.firstName}
          </h3>
          {candidate.myReview && candidate.myReview.status !== "NOT_REVIEWED" ? (
            <ReviewBadge status={candidate.myReview.status} />
          ) : (
            <span className="text-[11px] font-semibold text-navy-400">Awaiting review</span>
          )}
        </div>
        <svg className="w-5 h-5 text-navy-200 group-hover:text-orange-400 transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
      </div>

      {(candidate.tailoredSummary || candidate.summary) && (
        <p className="text-sm text-navy-500 mb-4 line-clamp-2 leading-relaxed">{candidate.tailoredSummary || candidate.summary}</p>
      )}

      {candidate.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(candidate.skills as string[]).slice(0, 4).map((skill, i) => (
            <span key={i} className="text-[11px] font-medium bg-navy-50 text-navy-600 px-2.5 py-1 rounded-md border border-navy-100/60">{skill}</span>
          ))}
          {(candidate.skills as string[]).length > 4 && (
            <span className="text-[11px] text-navy-400 font-medium px-1.5 py-1">+{(candidate.skills as string[]).length - 4}</span>
          )}
        </div>
      )}
    </button>
  );
}

function ReviewBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    REQUEST_INTERVIEW: "bg-orange-50 text-orange-700 border-orange-200",
    NOT_INTERESTED: "bg-red-50 text-red-700 border-red-200",
  };
  const labels: Record<string, string> = {
    REQUEST_INTERVIEW: "Interview",
    NOT_INTERESTED: "Not Interested",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
