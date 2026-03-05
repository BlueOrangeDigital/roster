"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";

interface Review {
  id: string;
  status: string;
  feedback: string | null;
  reviewer: { name: string | null; email: string; id: string };
  updatedAt: string;
}

interface RoleAssignment {
  id: string;
  tailoredSummary: string | null;
  candidate: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
    pictureUrl: string | null;
    summary: string | null;
    skills: string[];
    experience: any[];
  };
}

interface Role {
  id: string;
  title: string;
  description: string | null;
  assignments: RoleAssignment[];
}

interface Reviewer {
  id: string;
  name: string | null;
  email: string;
}

interface Company {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  notes: string | null;
  shareToken: string;
  isActive: boolean;
  roles: Role[];
  reviewers: Reviewer[];
}

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddCandidates, setShowAddCandidates] = useState(false);
  const [allCandidates, setAllCandidates] = useState<any[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [addingReviewer, setAddingReviewer] = useState(false);
  const [copied, setCopied] = useState(false);

  // Role state
  const [addingRole, setAddingRole] = useState(false);
  const [newRoleTitle, setNewRoleTitle] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleTitle, setEditRoleTitle] = useState("");
  const [editRoleDescription, setEditRoleDescription] = useState("");
  const [assigningToRoleId, setAssigningToRoleId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);

  const fetchCompany = useCallback(async () => {
    const res = await fetch(`/api/companies/${id}`);
    const data = await res.json();
    setCompany(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchCompany(); }, [fetchCompany]);

  async function handleAddRole(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoleTitle.trim()) return;
    await fetch(`/api/companies/${id}/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newRoleTitle.trim(), description: newRoleDescription.trim() || null }),
    });
    setAddingRole(false);
    setNewRoleTitle("");
    setNewRoleDescription("");
    fetchCompany();
  }

  async function handleUpdateRole(roleId: string, e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/companies/${id}/roles/${roleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editRoleTitle.trim(), description: editRoleDescription.trim() || null }),
    });
    setEditingRoleId(null);
    fetchCompany();
  }

  async function handleDeleteRole(roleId: string) {
    if (!confirm("Delete this role? Candidates will be unassigned.")) return;
    setDeletingRoleId(roleId);
    await fetch(`/api/companies/${id}/roles/${roleId}`, { method: "DELETE" });
    setDeletingRoleId(null);
    fetchCompany();
  }

  async function openRoleCandidatePicker(roleId: string) {
    const res = await fetch("/api/candidates");
    const data = await res.json();
    setAllCandidates(data);
    setAssigningToRoleId(roleId);
    setShowAddCandidates(true);
  }

  async function handleAssignCandidates() {
    if (!assigningToRoleId) return;
    const candidateIds = Array.from(selectedCandidates);
    await fetch(`/api/companies/${id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateIds, roleId: assigningToRoleId }),
    });
    setShowAddCandidates(false);
    setSelectedCandidates(new Set());
    setAssigningToRoleId(null);
    fetchCompany();
  }

  async function handleRemoveFromRole(candidateId: string, roleId: string) {
    await fetch(`/api/companies/${id}/assign?candidateId=${candidateId}&roleId=${roleId}`, { method: "DELETE" });
    fetchCompany();
  }

  async function handleRegenerate(assignmentId: string, roleId: string) {
    setRegeneratingId(assignmentId);
    const res = await fetch(`/api/companies/${id}/roles/${roleId}/assignments/${assignmentId}/tailor`, { method: "POST" });
    if (res.ok) fetchCompany();
    setRegeneratingId(null);
  }

  async function handleAddReviewer(e: React.FormEvent) {
    e.preventDefault();
    setAddingReviewer(true);
    await fetch(`/api/companies/${id}/reviewers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: reviewerEmail, name: reviewerName }),
    });
    setReviewerEmail("");
    setReviewerName("");
    setAddingReviewer(false);
    fetchCompany();
  }

  async function handleRemoveReviewer(reviewerId: string) {
    await fetch(`/api/companies/${id}/reviewers`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewerId }),
    });
    fetchCompany();
  }

  async function handleRegenerateLink() {
    const res = await fetch(`/api/companies/${id}/regenerate-link`, { method: "POST" });
    if (res.ok) fetchCompany();
  }

  async function handleToggleActive() {
    if (!company) return;
    await fetch(`/api/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !company.isActive }),
    });
    fetchCompany();
  }

  function copyLink() {
    if (!company) return;
    const link = `${window.location.origin}/review/${company.shareToken}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-navy-200 border-t-orange-500" /></div>;
  }

  if (!company) return <p className="text-red-600">Company not found</p>;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/companies" className="text-navy-400 hover:text-navy-600 p-1.5 rounded-lg hover:bg-navy-50">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-navy-100 to-navy-200 flex items-center justify-center text-sm font-bold text-navy-600 shrink-0">
            {company.name[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-navy-950 tracking-tight">{company.name}</h1>
            {company.contactName && <p className="text-navy-500 text-sm mt-0.5">{company.contactName} &middot; {company.contactEmail}</p>}
          </div>
        </div>
        <button
          onClick={handleToggleActive}
          className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors ${company.isActive ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"}`}
        >
          {company.isActive ? "Active" : "Inactive"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Share Link */}
          <div className="bg-white rounded-lg border border-navy-200 p-6">
            <h2 className="text-sm font-bold text-navy-950 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-navy-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
              Client Review Link
            </h2>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-navy-50 px-4 py-2.5 rounded-md text-xs text-navy-600 overflow-x-auto font-mono border border-navy-200">
                {typeof window !== "undefined" ? `${window.location.origin}/review/${company.shareToken}` : `/review/${company.shareToken}`}
              </code>
              <button onClick={copyLink}
                className={`px-4 py-2.5 text-xs font-semibold rounded-md shrink-0 transition-all ${copied ? "bg-green-500 text-white" : "bg-orange-500 hover:bg-orange-600 text-white"}`}>
                {copied ? "Copied!" : "Copy"}
              </button>
              <button onClick={handleRegenerateLink}
                className="px-4 py-2.5 border border-navy-200 text-navy-600 text-xs font-semibold rounded-md hover:bg-navy-50 shrink-0">
                Regenerate
              </button>
            </div>
          </div>

          {/* Roles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-navy-950">Roles ({company.roles.length})</h2>
              {!addingRole && (
                <button onClick={() => setAddingRole(true)} className="text-sm text-orange-500 hover:text-orange-600 font-semibold">
                  + Add Role
                </button>
              )}
            </div>

            {/* Add Role form */}
            {addingRole && (
              <form onSubmit={handleAddRole} className="bg-white rounded-lg border border-navy-200 p-4 space-y-3">
                <input
                  autoFocus
                  value={newRoleTitle}
                  onChange={(e) => setNewRoleTitle(e.target.value)}
                  placeholder="Role title (e.g. Senior Engineer)"
                  className="w-full px-3 py-2 border border-navy-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                  required
                />
                <textarea
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  placeholder="Role description / requirements (optional)"
                  rows={3}
                  className="w-full px-3 py-2 border border-navy-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => { setAddingRole(false); setNewRoleTitle(""); setNewRoleDescription(""); }}
                    className="px-4 py-2 text-sm text-navy-600 hover:bg-navy-50 rounded-md font-medium">Cancel</button>
                  <button type="submit"
                    className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-md font-semibold">Save Role</button>
                </div>
              </form>
            )}

            {company.roles.length === 0 && !addingRole && (
              <div className="text-center py-8 bg-white rounded-lg border border-navy-200">
                <p className="text-navy-400 text-sm">No roles yet. Add a role to start assigning candidates.</p>
              </div>
            )}

            {company.roles.map((role) => (
              <div key={role.id} className="bg-white rounded-lg border border-navy-200">
                {/* Role header */}
                {editingRoleId === role.id ? (
                  <form onSubmit={(e) => handleUpdateRole(role.id, e)} className="p-4 space-y-3 border-b border-navy-100">
                    <input
                      autoFocus
                      value={editRoleTitle}
                      onChange={(e) => setEditRoleTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-navy-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                      required
                    />
                    <textarea
                      value={editRoleDescription}
                      onChange={(e) => setEditRoleDescription(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-navy-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setEditingRoleId(null)}
                        className="px-3 py-1.5 text-xs text-navy-600 hover:bg-navy-50 rounded-md font-medium">Cancel</button>
                      <button type="submit"
                        className="px-3 py-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-md font-semibold">Save</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-start justify-between p-4 border-b border-navy-100">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-navy-900">{role.title}</h3>
                      {role.description && <p className="text-xs text-navy-400 mt-1 leading-relaxed">{role.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 ml-3 shrink-0">
                      <button
                        onClick={() => { setEditingRoleId(role.id); setEditRoleTitle(role.title); setEditRoleDescription(role.description || ""); }}
                        className="p-1.5 text-navy-400 hover:text-navy-600 hover:bg-navy-50 rounded"
                        title="Edit role"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      </button>
                      <button
                        onClick={() => handleDeleteRole(role.id)}
                        disabled={deletingRoleId === role.id}
                        className="p-1.5 text-navy-400 hover:text-red-500 hover:bg-red-50 rounded"
                        title="Delete role"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                      </button>
                      <button
                        onClick={() => openRoleCandidatePicker(role.id)}
                        className="ml-1 px-3 py-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded font-semibold"
                      >
                        + Candidates
                      </button>
                    </div>
                  </div>
                )}

                {/* Candidates in this role */}
                {role.assignments.length === 0 ? (
                  <p className="text-xs text-navy-400 p-4">No candidates assigned to this role.</p>
                ) : (
                  <div className="divide-y divide-navy-50">
                    {role.assignments.map((a) => (
                      <div key={a.id} className="flex items-start gap-3 p-4">
                        {a.candidate.pictureUrl ? (
                          <img src={a.candidate.pictureUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center text-xs font-bold text-navy-600 shrink-0 mt-0.5">
                            {a.candidate.firstName[0]}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <Link href={`/admin/candidates/${a.candidate.id}`} className="text-sm font-semibold text-navy-900 hover:text-orange-600 transition-colors">
                              {a.candidate.firstName} {a.candidate.lastName}
                            </Link>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleRegenerate(a.id, role.id)}
                                disabled={regeneratingId === a.id}
                                className="p-1 text-navy-400 hover:text-orange-500 hover:bg-orange-50 rounded"
                                title="Regenerate tailored summary"
                              >
                                <svg className={`w-3.5 h-3.5 ${regeneratingId === a.id ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                              </button>
                              <button
                                onClick={() => handleRemoveFromRole(a.candidate.id, role.id)}
                                className="p-1 text-navy-400 hover:text-red-500 hover:bg-red-50 rounded"
                                title="Remove from role"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                              </button>
                            </div>
                          </div>
                          {(a.tailoredSummary || a.candidate.summary) && (
                            <p className="text-xs text-navy-500 mt-1 leading-relaxed">{a.tailoredSummary || a.candidate.summary}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar - Reviewers */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-navy-200 p-6">
            <h2 className="text-sm font-bold text-navy-950 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-navy-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              Reviewers ({company.reviewers.length})
            </h2>
            <div className="space-y-2 mb-4">
              {company.reviewers.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 px-3 -mx-3 rounded-lg hover:bg-cream-50">
                  <div>
                    <p className="text-sm font-semibold text-navy-800">{r.name || r.email}</p>
                    <p className="text-xs text-navy-400 mt-0.5">{r.email}</p>
                  </div>
                  <button onClick={() => handleRemoveReviewer(r.id)} className="text-navy-300 hover:text-red-500 p-1 rounded-lg hover:bg-red-50">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              {company.reviewers.length === 0 && (
                <p className="text-navy-400 text-xs py-2">No reviewers added</p>
              )}
            </div>

            <form onSubmit={handleAddReviewer} className="space-y-2.5 pt-4 border-t border-navy-200">
              <input
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                placeholder="Name"
                className="w-full px-3.5 py-2.5 border border-navy-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
              />
              <input
                type="email"
                value={reviewerEmail}
                onChange={(e) => setReviewerEmail(e.target.value)}
                placeholder="Email"
                required
                className="w-full px-3.5 py-2.5 border border-navy-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
              />
              <button type="submit" disabled={addingReviewer}
                className="w-full py-2.5 bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold rounded-md disabled:opacity-60">
                {addingReviewer ? "Adding..." : "Add Reviewer"}
              </button>
            </form>
          </div>

          {company.notes && (
            <div className="bg-white rounded-lg border border-navy-200 p-6">
              <h3 className="text-sm font-bold text-navy-950 mb-2">Notes</h3>
              <p className="text-sm text-navy-500 leading-relaxed">{company.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Candidate Picker Modal */}
      {showAddCandidates && (
        <div className="fixed inset-0 bg-navy-950/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-2xl shadow-navy-950/20 border border-navy-200 max-h-[80vh] flex flex-col animate-fade-in-scale">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-navy-950">Assign Candidates</h2>
              <button onClick={() => { setShowAddCandidates(false); setAssigningToRoleId(null); }} className="text-navy-400 hover:text-navy-600 p-1 rounded-lg hover:bg-navy-50">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 -mx-2 px-2">
              {allCandidates.map((c) => {
                const role = company.roles.find(r => r.id === assigningToRoleId);
                const alreadyAssigned = role?.assignments.some((a) => a.candidate.id === c.id) ?? false;
                return (
                  <label key={c.id} className={`flex items-center gap-3 py-3 px-3 rounded-lg cursor-pointer hover:bg-cream-50 ${alreadyAssigned ? "opacity-50" : ""}`}>
                    <input
                      type="checkbox"
                      disabled={alreadyAssigned}
                      checked={selectedCandidates.has(c.id) || alreadyAssigned}
                      onChange={() => {
                        if (alreadyAssigned) return;
                        const next = new Set(selectedCandidates);
                        if (next.has(c.id)) next.delete(c.id);
                        else next.add(c.id);
                        setSelectedCandidates(next);
                      }}
                      className="rounded border-navy-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-navy-900">{c.firstName} {c.lastName}</span>
                    {alreadyAssigned && <span className="text-xs text-navy-400">(already assigned)</span>}
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-navy-200 mt-4">
              <button onClick={() => { setShowAddCandidates(false); setAssigningToRoleId(null); setSelectedCandidates(new Set()); }}
                className="px-5 py-2.5 text-navy-600 hover:bg-navy-50 rounded-md text-sm font-semibold">Cancel</button>
              <button onClick={handleAssignCandidates} disabled={selectedCandidates.size === 0}
                className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-md text-sm disabled:opacity-60">
                Assign {selectedCandidates.size > 0 ? `(${selectedCandidates.size})` : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
