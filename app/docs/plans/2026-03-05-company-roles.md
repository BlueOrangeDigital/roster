# Company Roles Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add multi-role support to companies so candidates are matched to specific roles, with Claude-tailored summaries per role.

**Architecture:** Add a `Role` model linked to `Company`; `CandidateAssignment` gains `roleId` and `tailoredSummary`; a new `tailor-summary` utility calls Claude Sonnet to rewrite a candidate's bio to match the role; the company admin UI gets role management; the client review page groups candidates by role.

**Tech Stack:** Next.js 15 App Router, Prisma 7 (PostgreSQL), Anthropic SDK (`claude-sonnet-4-6`), TypeScript, Tailwind CSS

---

### Task 1: Schema Migration

**Files:**
- Modify: `app/prisma/schema.prisma`

**Step 1: Add Role model and update CandidateAssignment**

Open `app/prisma/schema.prisma`. Make these changes:

1. Add `roles Role[]` to the `Company` model.
2. Add to `CandidateAssignment`:
   - `roleId       String?`
   - `tailoredSummary String? @db.Text`
   - `role         Role?    @relation(fields: [roleId], references: [id])`
   - Change `@@unique([candidateId, companyId])` → `@@unique([candidateId, roleId])`
3. Add new model at end of file:

```prisma
model Role {
  id          String   @id @default(cuid())
  companyId   String
  title       String
  description String?  @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  company     Company              @relation(fields: [companyId], references: [id], onDelete: Cascade)
  assignments CandidateAssignment[]
}
```

4. Add `roles Role[]` to `Company` model.

**Step 2: Run migration**

```bash
cd app && npx prisma migrate dev --name add-roles
```

Expected: Migration created and applied, Prisma client regenerated.

**Step 3: Commit**

```bash
git add app/prisma/schema.prisma app/prisma/migrations/
git commit -m "feat: add Role model and roleId/tailoredSummary to CandidateAssignment"
```

---

### Task 2: Role CRUD API

**Files:**
- Create: `app/src/app/api/companies/[id]/roles/route.ts`
- Create: `app/src/app/api/companies/[id]/roles/[roleId]/route.ts`

**Step 1: Create list/create endpoint**

`app/src/app/api/companies/[id]/roles/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const roles = await prisma.role.findMany({
    where: { companyId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ roles });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { title, description } = await req.json();
  if (!title?.trim()) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }
  const role = await prisma.role.create({
    data: { companyId: id, title: title.trim(), description: description?.trim() || null },
  });
  return NextResponse.json({ role }, { status: 201 });
}
```

**Step 2: Create update/delete endpoint**

`app/src/app/api/companies/[id]/roles/[roleId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; roleId: string }> }) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { roleId } = await params;
  const { title, description } = await req.json();
  const role = await prisma.role.update({
    where: { id: roleId },
    data: { title: title?.trim(), description: description?.trim() || null },
  });
  return NextResponse.json({ role });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; roleId: string }> }) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { roleId } = await params;
  await prisma.role.delete({ where: { id: roleId } });
  return NextResponse.json({ ok: true });
}
```

**Step 3: Commit**

```bash
git add app/src/app/api/companies/
git commit -m "feat: add role CRUD API endpoints"
```

---

### Task 3: Tailor Summary Utility

**Files:**
- Create: `app/src/lib/tailor-summary.ts`

**Step 1: Create utility**

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function tailorSummary(
  candidateSummary: string,
  candidateName: string,
  roleTitle: string,
  roleDescription: string | null
): Promise<string> {
  if (!candidateSummary) return "";

  const roleContext = roleDescription
    ? `Role: ${roleTitle}\nRequirements/Description:\n${roleDescription}`
    : `Role: ${roleTitle}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `You are writing a tailored candidate summary for a client presentation.

${roleContext}

Candidate's general summary:
${candidateSummary}

Rewrite this as a 2-3 sentence summary that specifically highlights how ${candidateName}'s background and skills are a strong match for the ${roleTitle} role. Be concrete and persuasive. Write in third person. Return ONLY the summary text, no labels or extra formatting.`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") return candidateSummary;
  return block.text.trim();
}
```

**Step 2: Verify it compiles**

```bash
cd app && npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add app/src/lib/tailor-summary.ts
git commit -m "feat: add tailorSummary Claude utility"
```

---

### Task 4: Update Assignment API

**Files:**
- Modify: `app/src/app/api/companies/[id]/assign/route.ts`

**Step 1: Read current file**

Read `app/src/app/api/companies/[id]/assign/route.ts` to understand current shape.

**Step 2: Update to accept roleId**

The `POST` handler should:
1. Accept `{ candidateIds: string[], roleId: string }` in body (roleId required).
2. Fetch the role to get `title` and `description`.
3. For each candidate, fetch their `summary` and `firstName`/`lastName`.
4. Call `tailorSummary(summary, name, role.title, role.description)`.
5. Upsert `CandidateAssignment` with `roleId` and `tailoredSummary`. Use `@@unique([candidateId, roleId])` as the upsert key.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tailorSummary } from "@/lib/tailor-summary";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: companyId } = await params;
  const { candidateIds, roleId } = await req.json();

  if (!roleId) {
    return NextResponse.json({ error: "roleId required" }, { status: 400 });
  }

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role || role.companyId !== companyId) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  const results = [];
  for (const candidateId of candidateIds) {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { summary: true, firstName: true, lastName: true },
    });
    if (!candidate) continue;

    const name = `${candidate.firstName} ${candidate.lastName}`.trim();
    const tailored = await tailorSummary(candidate.summary || "", name, role.title, role.description);

    const assignment = await prisma.candidateAssignment.upsert({
      where: { candidateId_roleId: { candidateId, roleId } },
      create: { candidateId, companyId, roleId, tailoredSummary: tailored },
      update: { tailoredSummary: tailored },
    });
    results.push(assignment);
  }

  return NextResponse.json({ assigned: results.length });
}
```

**Step 3: Verify it compiles**

```bash
cd app && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add app/src/app/api/companies/[id]/assign/route.ts
git commit -m "feat: update assign API to require roleId and generate tailored summaries"
```

---

### Task 5: Regenerate Tailored Summary Endpoint

**Files:**
- Create: `app/src/app/api/companies/[id]/roles/[roleId]/assignments/[assignmentId]/tailor/route.ts`

**Step 1: Create endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tailorSummary } from "@/lib/tailor-summary";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; roleId: string; assignmentId: string }> }
) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { roleId, assignmentId } = await params;

  const assignment = await prisma.candidateAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      candidate: { select: { summary: true, firstName: true, lastName: true } },
      role: true,
    },
  });
  if (!assignment || assignment.roleId !== roleId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const name = `${assignment.candidate.firstName} ${assignment.candidate.lastName}`.trim();
  const tailored = await tailorSummary(
    assignment.candidate.summary || "",
    name,
    assignment.role!.title,
    assignment.role!.description
  );

  const updated = await prisma.candidateAssignment.update({
    where: { id: assignmentId },
    data: { tailoredSummary: tailored },
  });

  return NextResponse.json({ tailoredSummary: updated.tailoredSummary });
}
```

**Step 2: Commit**

```bash
git add app/src/app/api/companies/
git commit -m "feat: add regenerate tailored summary endpoint"
```

---

### Task 6: Update Company Detail API

**Files:**
- Modify: `app/src/app/api/companies/[id]/route.ts`

**Step 1: Read current file**

Read `app/src/app/api/companies/[id]/route.ts`.

**Step 2: Include roles with nested assignments in GET**

Update the `prisma.company.findUnique` call to include:

```typescript
roles: {
  orderBy: { createdAt: "asc" },
  include: {
    assignments: {
      include: {
        candidate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            pictureUrl: true,
            summary: true,
            skills: true,
            experience: true,
          },
        },
      },
    },
  },
},
```

Also keep existing `assignments` include for backward compatibility (unassigned/legacy candidates).

**Step 3: Commit**

```bash
git add app/src/app/api/companies/[id]/route.ts
git commit -m "feat: include roles with assignments in company detail API"
```

---

### Task 7: Rewrite Company Detail Admin Page

**Files:**
- Modify: `app/src/app/admin/companies/[id]/page.tsx`

**Step 1: Read current file completely**

Read `app/src/app/admin/companies/[id]/page.tsx`.

**Step 2: Plan the new UI layout**

The page needs:

1. **Roles section** (replaces flat candidate list):
   - Each role is a collapsible card with title, description (editable), and its assigned candidates
   - "Add Role" button opens an inline form (title + description textarea)
   - Each role card has Edit (pencil) and Delete (trash) icon buttons
   - Each role card has "Add Candidates" button that opens the existing candidate picker modal, but now scoped to that role

2. **Candidate picker modal** (already exists — adapt to pass `roleId`):
   - When opened from a role card, `selectedRoleId` state is set
   - On confirm, POST to `/api/companies/[id]/assign` with `{ candidateIds, roleId: selectedRoleId }`

3. **Per-assignment tailored summary display**:
   - Under each candidate in a role card, show their tailored summary (not generic summary)
   - Small "Regenerate" button (circular arrow icon) that calls the tailor endpoint

**Step 3: Implement**

Key state additions:
```typescript
const [roles, setRoles] = useState<Role[]>([]);  // loaded from API
const [addingRole, setAddingRole] = useState(false);
const [newRoleTitle, setNewRoleTitle] = useState("");
const [newRoleDescription, setNewRoleDescription] = useState("");
const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
const [assigningToRoleId, setAssigningToRoleId] = useState<string | null>(null);
const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
```

Key handlers:
```typescript
async function handleAddRole() { /* POST /api/companies/[id]/roles */ }
async function handleDeleteRole(roleId: string) { /* DELETE /api/companies/[id]/roles/[roleId] */ }
async function handleAssign(candidateIds: string[]) {
  // POST /api/companies/[id]/assign with { candidateIds, roleId: assigningToRoleId }
}
async function handleRegenerate(assignmentId: string, roleId: string) {
  // POST /api/companies/[id]/roles/[roleId]/assignments/[assignmentId]/tailor
}
```

Roles section JSX structure:
```tsx
<div className="space-y-4">
  {roles.map(role => (
    <div key={role.id} className="bg-white rounded-lg border border-navy-200">
      <div className="flex items-center justify-between p-4 border-b border-navy-100">
        <div>
          <h3 className="text-sm font-semibold text-navy-900">{role.title}</h3>
          {role.description && <p className="text-xs text-navy-400 mt-0.5 line-clamp-2">{role.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditingRoleId(role.id)}>/* pencil icon */</button>
          <button onClick={() => handleDeleteRole(role.id)}>/* trash icon */</button>
          <button onClick={() => setAssigningToRoleId(role.id)} className="btn-sm">Add Candidates</button>
        </div>
      </div>
      {/* candidate list for this role */}
      {role.assignments.map(a => (
        <div key={a.id} className="flex items-start gap-3 p-4 border-b border-navy-50 last:border-0">
          {/* avatar, name */}
          <p className="text-xs text-navy-500 mt-1">{a.tailoredSummary || a.candidate.summary}</p>
          <button onClick={() => handleRegenerate(a.id, role.id)} title="Regenerate summary">/* icon */</button>
        </div>
      ))}
    </div>
  ))}
  {/* Add Role button/form */}
</div>
```

**Step 4: Verify it compiles**

```bash
cd app && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add app/src/app/admin/companies/[id]/page.tsx
git commit -m "feat: rewrite company detail page with role management UI"
```

---

### Task 8: Update Client Review Page

**Files:**
- Modify: `app/src/app/review/[token]/page.tsx`

**Step 1: Read current file**

Read `app/src/app/review/[token]/page.tsx`.

**Step 2: Group candidates by role**

The review page receives candidates via assignments. Update the data fetch to include `role` and `tailoredSummary`:

In the Prisma query (or the API that serves the review page), add:
```typescript
include: {
  assignments: {
    include: {
      candidate: { ... },
      role: { select: { id: true, title: true, description: true } },
    },
  },
}
```

**Step 3: Render roles-grouped layout**

Group assignments by `roleId` (null/undefined goes into an "Unassigned" group or is hidden):

```typescript
const byRole = new Map<string, { role: { title: string; description: string | null }, assignments: Assignment[] }>();
for (const a of company.assignments) {
  const key = a.roleId ?? "__none__";
  if (!byRole.has(key)) {
    byRole.set(key, { role: a.role ?? { title: "General", description: null }, assignments: [] });
  }
  byRole.get(key)!.assignments.push(a);
}
```

Render each role as a section header with candidates underneath. Show `a.tailoredSummary || a.candidate.summary` as the bio.

**Step 4: Verify it compiles**

```bash
cd app && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add app/src/app/review/[token]/page.tsx
git commit -m "feat: group candidates by role on client review page"
```

---

### Task 9: Build Verification

**Step 1: Full type check**

```bash
cd app && npx tsc --noEmit
```

Expected: 0 errors.

**Step 2: Build**

```bash
cd app && npm run build
```

Expected: Successful build, no errors.

**Step 3: Smoke test checklist**

- [ ] Create a company
- [ ] Add a role with title and description
- [ ] Edit the role description
- [ ] Import/select a candidate
- [ ] Assign candidate to role — tailored summary appears
- [ ] Click Regenerate — summary updates
- [ ] Open client review link — candidates grouped under role section
- [ ] Delete a role (with confirmation) — candidates unassigned

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: build verification complete for company roles feature"
```
