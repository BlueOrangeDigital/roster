"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

export default function CandidateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [summary, setSummary] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [experience, setExperience] = useState<Experience[]>([]);
  const [education, setEducation] = useState<Education[]>([]);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [pictureUrl, setPictureUrl] = useState("");
  const [teamTailorId, setTeamTailorId] = useState<string | null>(null);
  const [resyncing, setResyncing] = useState(false);

  useEffect(() => {
    fetch(`/api/candidates/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setFirstName(data.firstName);
        setLastName(data.lastName || "");
        setEmail(data.email || "");
        setPhone(data.phone || "");
        setSummary(data.summary || "");
        setSkills(Array.isArray(data.skills) ? data.skills : []);
        setExperience(Array.isArray(data.experience) ? data.experience : []);
        setEducation(Array.isArray(data.education) ? data.education : []);
        setLinkedinUrl(data.linkedinUrl || "");
        setPictureUrl(data.pictureUrl || "");
        setTeamTailorId(data.teamTailorId);
        setLoading(false);
      });
  }, [id]);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const res = await fetch(`/api/candidates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, email, phone, summary, skills, experience, education, linkedinUrl, pictureUrl }),
    });
    if (res.ok) setMessage("Saved successfully");
    else setMessage("Save failed");
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this candidate? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/candidates/${id}`, { method: "DELETE" });
    router.push("/admin/candidates");
  }

  async function handleResync() {
    if (!teamTailorId) return;
    setResyncing(true);
    const syncRes = await fetch("/api/teamtailor/sync");
    if (syncRes.ok) {
      const syncData = await syncRes.json();
      const ttCandidate = syncData.candidates.find((c: any) => c.teamTailorId === teamTailorId);
      if (ttCandidate) {
        const importRes = await fetch("/api/teamtailor/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidates: [ttCandidate] }),
        });
        if (importRes.ok) {
          setMessage("Resynced from Team Tailor");
          const refreshRes = await fetch(`/api/candidates/${id}`);
          const data = await refreshRes.json();
          setFirstName(data.firstName);
          setLastName(data.lastName || "");
          setEmail(data.email || "");
          setPhone(data.phone || "");
          if (!data.summaryIsManual) setSummary(data.summary || "");
          setLinkedinUrl(data.linkedinUrl || "");
          setPictureUrl(data.pictureUrl || "");
        }
      }
    }
    setResyncing(false);
  }

  function addSkill() {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput("");
    }
  }

  function removeSkill(index: number) { setSkills(skills.filter((_, i) => i !== index)); }
  function addExperience() { setExperience([...experience, { title: "", company: "", startDate: "", endDate: "", description: "" }]); }
  function updateExperience(index: number, field: keyof Experience, value: string) {
    const updated = [...experience];
    updated[index] = { ...updated[index], [field]: value };
    setExperience(updated);
  }
  function removeExperience(index: number) { setExperience(experience.filter((_, i) => i !== index)); }
  function addEducation() { setEducation([...education, { degree: "", school: "", year: "" }]); }
  function updateEducation(index: number, field: keyof Education, value: string) {
    const updated = [...education];
    updated[index] = { ...updated[index], [field]: value };
    setEducation(updated);
  }
  function removeEducation(index: number) { setEducation(education.filter((_, i) => i !== index)); }

  const inputClass = "w-full px-3.5 py-2.5 border border-navy-200 rounded-md text-navy-950 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-7 w-7 border-2 border-navy-200 border-t-orange-500" />
      </div>
    );
  }

  if (showPreview) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setShowPreview(false)} className="text-sm text-navy-500 hover:text-navy-700 flex items-center gap-1.5 font-medium">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Back to editing
          </button>
          <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-3 py-1 rounded font-semibold">
            Client Preview Mode
          </span>
        </div>
        <CandidatePreview
          firstName={firstName}
          summary={summary}
          skills={skills}
          experience={experience}
          education={education}
          pictureUrl={pictureUrl}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between mb-7">
        <div className="flex items-center gap-3">
          <Link href="/admin/candidates" className="text-navy-400 hover:text-navy-600 p-1 rounded hover:bg-navy-100 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </Link>
          <div className="flex items-center gap-3">
            {pictureUrl ? (
              <img src={pictureUrl} alt="" className="w-9 h-9 rounded-full object-cover ring-1 ring-navy-100" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-navy-100 flex items-center justify-center text-sm font-bold text-navy-600">
                {firstName[0]}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-navy-950 tracking-tight">{firstName} {lastName}</h1>
              <p className="text-navy-400 text-sm">Edit candidate profile</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {teamTailorId && (
            <button
              onClick={handleResync}
              disabled={resyncing}
              className="px-3.5 py-2 border border-navy-200 text-navy-600 hover:bg-navy-50 rounded-md text-sm font-medium disabled:opacity-60 transition-colors"
            >
              {resyncing ? "Resyncing…" : "Resync from TT"}
            </button>
          )}
          <button
            onClick={() => setShowPreview(true)}
            className="px-3.5 py-2 border border-navy-200 text-navy-600 hover:bg-navy-50 rounded-md text-sm font-medium transition-colors"
          >
            Preview
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-md text-sm disabled:opacity-60 transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3.5 py-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-md text-sm font-medium disabled:opacity-60 transition-colors"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-5 text-sm rounded-md px-4 py-2.5 flex items-center gap-2 border ${message.includes("success") || message.includes("Resync") ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
          {message.includes("success") || message.includes("Resync") ? (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
          )}
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Basic Info */}
          <div className="bg-white rounded-lg border border-navy-200 p-5">
            <h2 className="text-sm font-semibold text-navy-700 mb-4">Basic Information</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-navy-600 mb-1.5">First Name</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy-600 mb-1.5">Last Name <span className="text-navy-400 font-normal">(hidden from clients)</span></label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy-600 mb-1.5">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy-600 mb-1.5">Phone</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-lg border border-navy-200 p-5">
            <h2 className="text-sm font-semibold text-navy-700 mb-4">Summary</h2>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              placeholder="Write a compelling candidate summary..."
              className="w-full px-3.5 py-2.5 border border-navy-200 rounded-md text-navy-950 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none leading-relaxed bg-white"
            />
          </div>

          {/* Skills */}
          <div className="bg-white rounded-lg border border-navy-200 p-5">
            <h2 className="text-sm font-semibold text-navy-700 mb-4">Skills</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {skills.map((skill, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 bg-navy-50 text-navy-700 px-3 py-1 rounded-md text-xs font-medium border border-navy-100">
                  {skill}
                  <button onClick={() => removeSkill(i)} className="text-navy-400 hover:text-red-500 transition-colors">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                placeholder="Add a skill…"
                className="flex-1 px-3.5 py-2 border border-navy-200 rounded-md text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
              />
              <button onClick={addSkill} className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-md text-sm font-semibold transition-colors">
                Add
              </button>
            </div>
          </div>

          {/* Experience */}
          <div className="bg-white rounded-lg border border-navy-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-navy-700">Experience</h2>
              <button onClick={addExperience} className="text-xs text-orange-500 hover:text-orange-600 font-semibold transition-colors">
                + Add
              </button>
            </div>
            <div className="space-y-3">
              {experience.map((exp, i) => (
                <div key={i} className="border border-navy-200 rounded-md p-4 bg-navy-50/30">
                  <div className="flex justify-between mb-3">
                    <span className="text-[11px] font-semibold text-navy-400 uppercase tracking-wider">Position {i + 1}</span>
                    <button onClick={() => removeExperience(i)} className="text-navy-300 hover:text-red-500 text-xs font-medium transition-colors">Remove</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <input type="text" value={exp.title} onChange={(e) => updateExperience(i, "title", e.target.value)}
                      placeholder="Job Title" className="px-3 py-2 border border-navy-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white" />
                    <input type="text" value={exp.company} onChange={(e) => updateExperience(i, "company", e.target.value)}
                      placeholder="Company" className="px-3 py-2 border border-navy-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white" />
                    <input type="text" value={exp.startDate} onChange={(e) => updateExperience(i, "startDate", e.target.value)}
                      placeholder="Start Date" className="px-3 py-2 border border-navy-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white" />
                    <input type="text" value={exp.endDate} onChange={(e) => updateExperience(i, "endDate", e.target.value)}
                      placeholder="End Date or Present" className="px-3 py-2 border border-navy-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white" />
                  </div>
                  <textarea
                    value={exp.description}
                    onChange={(e) => updateExperience(i, "description", e.target.value)}
                    placeholder="Description…"
                    rows={2}
                    className="w-full mt-2.5 px-3 py-2 border border-navy-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none bg-white"
                  />
                </div>
              ))}
              {experience.length === 0 && (
                <p className="text-navy-400 text-sm py-3 text-center">No experience entries yet</p>
              )}
            </div>
          </div>

          {/* Education */}
          <div className="bg-white rounded-lg border border-navy-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-navy-700">Education</h2>
              <button onClick={addEducation} className="text-xs text-orange-500 hover:text-orange-600 font-semibold transition-colors">
                + Add
              </button>
            </div>
            <div className="space-y-3">
              {education.map((edu, i) => (
                <div key={i} className="border border-navy-200 rounded-md p-4 bg-navy-50/30">
                  <div className="flex justify-between mb-3">
                    <span className="text-[11px] font-semibold text-navy-400 uppercase tracking-wider">Education {i + 1}</span>
                    <button onClick={() => removeEducation(i)} className="text-navy-300 hover:text-red-500 text-xs font-medium transition-colors">Remove</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <input type="text" value={edu.degree} onChange={(e) => updateEducation(i, "degree", e.target.value)}
                      placeholder="Degree" className="px-3 py-2 border border-navy-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white" />
                    <input type="text" value={edu.school} onChange={(e) => updateEducation(i, "school", e.target.value)}
                      placeholder="School" className="px-3 py-2 border border-navy-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white" />
                    <input type="text" value={edu.year} onChange={(e) => updateEducation(i, "year", e.target.value)}
                      placeholder="Year" className="px-3 py-2 border border-navy-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white" />
                  </div>
                </div>
              ))}
              {education.length === 0 && (
                <p className="text-navy-400 text-sm py-3 text-center">No education entries yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="bg-white rounded-lg border border-navy-200 p-5">
            <h3 className="text-xs font-semibold text-navy-600 uppercase tracking-wide mb-4">Profile Photo</h3>
            <div className="flex items-center gap-3 mb-3">
              {pictureUrl ? (
                <img src={pictureUrl} alt="" className="w-16 h-16 rounded-full object-cover ring-1 ring-navy-100" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-navy-100 flex items-center justify-center text-xl font-bold text-navy-500">
                  {firstName[0]}
                </div>
              )}
            </div>
            <input
              type="text"
              value={pictureUrl}
              onChange={(e) => setPictureUrl(e.target.value)}
              placeholder="Photo URL"
              className="w-full px-3 py-2 border border-navy-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
            />
          </div>

          <div className="bg-white rounded-lg border border-navy-200 p-5">
            <h3 className="text-xs font-semibold text-navy-600 uppercase tracking-wide mb-3">LinkedIn</h3>
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/…"
              className="w-full px-3 py-2 border border-navy-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
            />
          </div>

          {teamTailorId && (
            <div className="bg-navy-50 rounded-md p-4 border border-navy-200">
              <p className="text-xs text-navy-500">
                <span className="font-semibold">Team Tailor ID:</span> {teamTailorId}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Client-facing preview component
function CandidatePreview({
  firstName, summary, skills, experience, education, pictureUrl,
}: {
  firstName: string;
  summary: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
  pictureUrl: string;
}) {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-navy-950 rounded-t-lg p-10 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} />
        <div className="relative flex items-center gap-6">
          {pictureUrl ? (
            <img src={pictureUrl} alt="" className="w-20 h-20 rounded-full object-cover ring-2 ring-orange-500/40 shadow-lg" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-navy-800 flex items-center justify-center text-3xl font-bold text-orange-400 ring-2 ring-orange-500/30">
              {firstName[0]}
            </div>
          )}
          <div>
            <p className="text-orange-400 text-[10px] font-semibold uppercase tracking-widest mb-1">Candidate Profile</p>
            <h1 className="text-2xl font-bold tracking-tight">{firstName}</h1>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-5 h-5 bg-orange-500 rounded flex items-center justify-center shrink-0">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="text-white">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-navy-400 text-xs">Presented by Blue Orange Digital</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-b-lg border border-t-0 border-navy-200">
        <div className="p-10 space-y-10">
          {summary && (
            <div>
              <h2 className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.15em] mb-3">Summary</h2>
              <p className="text-navy-700 leading-[1.75] text-[15px]">{summary}</p>
            </div>
          )}

          {skills.length > 0 && (
            <div>
              <h2 className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.15em] mb-4">Skills &amp; Expertise</h2>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill, i) => (
                  <span key={i} className="bg-navy-50 text-navy-700 px-3 py-1.5 rounded-md text-sm font-medium border border-navy-100">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {experience.length > 0 && (
            <div>
              <h2 className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.15em] mb-6">Professional Experience</h2>
              <div className="space-y-6">
                {experience.map((exp, i) => (
                  <div key={i} className="relative pl-5">
                    <div className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-orange-500" />
                    {i < experience.length - 1 && (
                      <div className="absolute left-[2px] top-4 bottom-0 w-px bg-orange-200" />
                    )}
                    <h3 className="text-base font-bold text-navy-900">{exp.title}</h3>
                    <p className="text-sm text-navy-600 font-semibold">{exp.company}</p>
                    <p className="text-xs text-navy-400 mt-0.5 font-medium">
                      {exp.startDate} &mdash; {exp.endDate || "Present"}
                    </p>
                    {exp.description && (
                      <p className="text-sm text-navy-600 mt-2 leading-relaxed">{exp.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {education.length > 0 && (
            <div>
              <h2 className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.15em] mb-5">Education</h2>
              <div className="space-y-4">
                {education.map((edu, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-md bg-navy-50 flex items-center justify-center text-navy-400 shrink-0 border border-navy-100">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>
                    </div>
                    <div>
                      <p className="font-bold text-navy-900 text-sm">{edu.degree}</p>
                      <p className="text-xs text-navy-500 mt-0.5">{edu.school} &middot; {edu.year}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Branding */}
        <div className="border-t border-navy-100 px-10 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-white">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-xs text-navy-400">Presented by <span className="text-navy-600 font-semibold">Blue Orange Digital</span></span>
            </div>
            <span className="text-[10px] text-navy-300 uppercase tracking-widest font-medium">Confidential</span>
          </div>
        </div>
      </div>
    </div>
  );
}
