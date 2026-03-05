# Team Tailor Candidate Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the bulk "sync all" Team Tailor flow with a search-first UI — users type a name/email, see up to 20 results, multi-select, and import only what they need.

**Architecture:** New `GET /api/teamtailor/search?q=` route proxies to Team Tailor's candidate search API and resolves `imported` status server-side. The candidates page replaces the sync panel with a search panel. The old sync route is deleted.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, Prisma, Team Tailor REST API v1

---

### Task 1: Create the search API route

**Files:**
- Create: `src/app/api/teamtailor/search/route.ts`
- Delete: `src/app/api/teamtailor/sync/route.ts`

**Step 1: Create the search route**

Create `src/app/api/teamtailor/search/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) {
    return NextResponse.json({ candidates: [] });
  }

  const config = await prisma.teamTailorConfig.findFirst();
  if (!config) {
    return NextResponse.json({ error: "Team Tailor not configured" }, { status: 400 });
  }

  const baseUrl =
    config.apiRegion === "us"
      ? "https://api.na.teamtailor.com"
      : "https://api.teamtailor.com";

  let ttData: any;
  try {
    const res = await fetch(
      `${baseUrl}/v1/candidates?filter%5Bquery%5D=${encodeURIComponent(q)}&page%5Bsize%5D=20`,
      {
        headers: {
          Authorization: `Token token=${config.apiKey}`,
          "X-Api-Version": "20161108",
        },
      }
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: "Couldn't reach Team Tailor. Check your API key has Candidates scope." },
        { status: 502 }
      );
    }
    ttData = await res.json();
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach Team Tailor. Check your API key has Candidates scope." },
      { status: 502 }
    );
  }

  // Resolve imported status for matched candidates
  const ttIds = (ttData.data ?? []).map((c: any) => c.id);
  const existing = await prisma.candidate.findMany({
    where: { teamTailorId: { in: ttIds } },
    select: { teamTailorId: true, id: true },
  });
  const importedMap = new Map(existing.map((c) => [c.teamTailorId, c.id]));

  const candidates = (ttData.data ?? []).map((c: any) => ({
    teamTailorId: c.id,
    firstName: c.attributes["first-name"] ?? "",
    lastName: c.attributes["last-name"] ?? "",
    email: c.attributes.email ?? "",
    pictureUrl:
      typeof c.attributes.picture === "object" && c.attributes.picture?.standard
        ? c.attributes.picture.standard
        : null,
    resumeUrl: c.attributes["original-resume"] ?? c.attributes.resume ?? null,
    linkedinUrl: c.attributes["linkedin-url"] ?? "",
    tags: c.attributes.tags ?? [],
    pitch: c.attributes.pitch ?? "",
    imported: importedMap.has(c.id),
    rosterId: importedMap.get(c.id) ?? null,
  }));

  return NextResponse.json({ candidates });
}
```

**Step 2: Delete the old sync route**

```bash
rm src/app/api/teamtailor/sync/route.ts
```

**Step 3: Commit**

```bash
git add src/app/api/teamtailor/search/route.ts
git rm src/app/api/teamtailor/sync/route.ts
git commit -m "feat: add TT candidate search API, remove bulk sync route"
```

---

### Task 2: Rewrite the candidates page sync panel

**Files:**
- Modify: `src/app/admin/candidates/page.tsx`

**Step 1: Replace the TTCandidate interface and state**

At the top of `page.tsx`, replace the `TTCandidate` interface and all sync-related state with:

```typescript
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
```

Replace the state block (remove `syncing`, `syncMessage`, add `query`, `searching`, `searchError`):

```typescript
const [showSync, setShowSync] = useState(false);
const [query, setQuery] = useState("");
const [ttCandidates, setTtCandidates] = useState<TTCandidate[]>([]);
const [selected, setSelected] = useState<Set<string>>(new Set());
const [searching, setSearching] = useState(false);
const [importing, setImporting] = useState(false);
const [searchError, setSearchError] = useState("");
const [importMessage, setImportMessage] = useState("");
```

**Step 2: Add debounced search effect**

Remove the `handleSync` function entirely. Add this after the state declarations:

```typescript
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
```

**Step 3: Update handleImport**

Replace `handleImport` — remove the `setSyncMessage` calls, use `setImportMessage`:

```typescript
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
    // Refresh imported badges without closing panel
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
```

**Step 4: Replace the sync panel JSX**

Replace the entire `{/* Team Tailor Sync Panel */}` block with:

```tsx
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
```

**Step 5: Update the button label**

Change the button text and click handler in the page header:

```tsx
<button
  onClick={() => { setShowSync(!showSync); if (showSync) { setQuery(""); setTtCandidates([]); setSelected(new Set()); } }}
  className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl shadow-sm shadow-orange-500/20 hover:shadow-orange-500/30 text-sm flex items-center gap-2"
>
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
  </svg>
  Add from Team Tailor
</button>
```

Also remove the `selectAllNew` function — it's no longer used.

**Step 6: Commit**

```bash
git add src/app/admin/candidates/page.tsx
git commit -m "feat: replace TT bulk sync with search-and-import UI"
```

---

### Task 3: Verify end-to-end

**Step 1: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors, successful build.

**Step 2: Manual smoke test**

1. Start dev server: `npm run dev`
2. Log in as admin at http://localhost:3000
3. Go to Candidates
4. Click "Add from Team Tailor"
5. Verify search input is focused with empty state message
6. Type 1 character — verify no request fires
7. Type 2+ characters — verify results appear with avatars and status badges
8. Check ≥1 result — verify sticky footer appears
9. Click "Import X selected" — verify success message and badges update to "Imported"
10. Close and reopen panel — verify imported candidates show correct badge

**Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: <description of any fixes>"
```
