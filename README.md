# Roster — Candidate Review Platform

Roster is a full-stack recruitment management platform built by **Blue Orange Digital**. It lets recruiting teams import candidates from [Team Tailor](https://www.teamtailor.com/), organise them by client company and job role, generate AI-tailored summaries with [Claude](https://www.anthropic.com/), and share a password-less review portal with hiring managers.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Data Model](#data-model)
- [Authentication](#authentication)
- [AI Features](#ai-features)
- [API Reference](#api-reference)
- [Pages & UI](#pages--ui)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Development Workflow](#development-workflow)
- [Deployment](#deployment)
- [Design System](#design-system)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Overview

### The Problem

Recruitment agencies manage candidates across many client companies and open roles. Sharing candidate profiles with hiring managers is slow, requires exporting files, and gives hiring managers no structured way to give feedback.

### What Roster Does

1. **Import candidates** from Team Tailor (ATS) with one click. Claude extracts structured data (skills, experience, education, summary) from resumes automatically.
2. **Organise by company + role.** Each candidate is assigned to a client company and a specific job role.
3. **Generate tailored summaries.** When a candidate is assigned to a role, Claude rewrites their general summary to highlight fit for that specific role and its requirements.
4. **Share a review portal.** Each company gets a unique, shareable URL. Reviewers authenticate via magic link, then mark candidates as **Request Interview** or **Not Interested** — with optional feedback.
5. **Track everything** from the admin dashboard: review progress, pending reviews, recent activity.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, TypeScript) |
| UI | [Tailwind CSS v4](https://tailwindcss.com/) |
| Database | PostgreSQL 14+ |
| ORM | [Prisma 7](https://www.prisma.io/) with `@prisma/adapter-pg` |
| Auth | [NextAuth.js v5](https://authjs.dev/) (JWT, Credentials providers) |
| AI | [Anthropic SDK](https://github.com/anthropic-ai/anthropic-sdk-node) (`claude-sonnet-4-6`) |
| Runtime | Node.js 20+ |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Next.js App                       │
│                                                      │
│  ┌────────────────┐    ┌──────────────────────────┐  │
│  │  Admin UI      │    │  Review Portal           │  │
│  │  /admin/*      │    │  /review/[token]         │  │
│  │  (ADMIN role)  │    │  (REVIEWER / magic link) │  │
│  └───────┬────────┘    └──────────────┬───────────┘  │
│          │                            │              │
│  ┌───────▼────────────────────────────▼───────────┐  │
│  │              REST API  /api/*                   │  │
│  │  (NextAuth session-guarded route handlers)      │  │
│  └───────────────────────┬─────────────────────────┘  │
│                          │                            │
│  ┌───────────────────────▼─────────────────────────┐  │
│  │             Prisma ORM + PostgreSQL              │  │
│  └───────────────────────┬─────────────────────────┘  │
│                          │                            │
│  ┌───────────────────────▼─────────────────────────┐  │
│  │  Anthropic Claude API  (resume extraction,       │  │
│  │  role-tailored summaries)                        │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
         │
         │  Team Tailor REST API
         ▼
  ┌──────────────┐
  │  Team Tailor │  (ATS — source of candidates)
  └──────────────┘
```

### Directory Structure

```
app/
├── prisma/
│   ├── schema.prisma              # Database schema (source of truth)
│   ├── prisma.config.ts           # Prisma datasource + migration config
│   └── migrations/                # SQL migration history
│       ├── 20260305125246_init/
│       ├── 20260305180000_add_roles/
│       └── 20260305190000_remove_interested_status/
├── src/
│   ├── app/
│   │   ├── admin/                 # Admin dashboard (ADMIN role required)
│   │   │   ├── layout.tsx         # Sidebar navigation shell
│   │   │   ├── page.tsx           # Dashboard overview + stats
│   │   │   ├── candidates/        # Candidate list + detail pages
│   │   │   ├── companies/         # Company list + detail + role management
│   │   │   └── settings/          # Team Tailor API config + import UI
│   │   ├── api/                   # REST API route handlers
│   │   │   ├── auth/              # NextAuth.js endpoints
│   │   │   ├── candidates/        # Candidate CRUD
│   │   │   ├── companies/         # Company, role, and assignment APIs
│   │   │   ├── magic-link/        # Magic link token generation
│   │   │   ├── review/            # Review portal data API (token-based)
│   │   │   ├── reviews/           # Review submission
│   │   │   └── teamtailor/        # ATS integration (config, jobs, import)
│   │   ├── login/                 # Admin login page
│   │   ├── review/                # Public-facing reviewer portal
│   │   └── globals.css
│   └── lib/
│       ├── auth.ts                # NextAuth configuration + providers
│       ├── db.ts                  # Prisma client singleton
│       └── tailor-summary.ts      # Claude summary rewriting utility
└── docs/
    └── plans/                     # Archived implementation plans
```

> **Note:** `src/generated/prisma/` is git-ignored and auto-generated. It is rebuilt automatically on `npm install` (via `postinstall`) and `npm run build`. Never edit files in this directory manually.

---

## Data Model

```
User
├── id, email, name, passwordHash
├── role: ADMIN | REVIEWER
└── companyId? → Company          ← reviewer's assigned company

Company
├── id, name, contactName, contactEmail, notes
├── shareToken                    ← unique token used in /review/[token] URL
├── isActive
├── reviewers → User[]
├── roles → Role[]
└── assignments → CandidateAssignment[]

Role
├── id, title, description?
├── companyId → Company (cascade delete)
└── assignments → CandidateAssignment[]

Candidate
├── id, teamTailorId?             ← teamTailorId is unique; used for sync deduplication
├── firstName, lastName, email, phone
├── pictureUrl, resumeUrl, linkedinUrl
├── summary (general)
├── summaryIsManual               ← if true, summary is preserved during Team Tailor re-sync
├── skills: Json[]
├── experience: Json[]            ← [{ title, company, startDate, endDate, description }]
├── education: Json[]             ← [{ degree, school, year }]
├── certifications: Json[]
└── assignments → CandidateAssignment[]

CandidateAssignment              ← join between a candidate, a company, and a role
├── id
├── candidateId → Candidate (cascade delete)
├── companyId → Company (cascade delete)
├── roleId? → Role (set null on role delete)
├── tailoredSummary?              ← Claude-generated, role-specific rewrite of candidate.summary
├── @@unique([candidateId, companyId, roleId])
└── reviews → Review[]

Review
├── id
├── status: NOT_REVIEWED | REQUEST_INTERVIEW | NOT_INTERESTED
├── feedback?
├── reviewerId → User (cascade delete)
├── candidateId → Candidate (cascade delete)
├── assignmentId → CandidateAssignment (cascade delete)
└── @@unique([reviewerId, candidateId, assignmentId])

MagicToken
├── id, token (unique)
├── userId → User (cascade delete)
├── expiresAt                     ← 1-hour TTL from creation
└── used: Boolean                 ← single-use; marked true on first authentication

TeamTailorConfig
└── apiKey, apiRegion, lastSyncAt ← stored in DB so credentials can rotate without redeployment
```

---

## Authentication

Roster uses **NextAuth.js v5** with JWT sessions and three Credentials providers.

### `admin-login`

Email + password for ADMIN users. Passwords are stored as bcrypt hashes (`bcryptjs`, 10 rounds). Used exclusively on `/login`.

### `reviewer-login`

Email + password for REVIEWER users who have a password set. This is a fallback path — most reviewers use magic links.

### `magic-link`

Passwordless one-click login for reviewers. Flow:

1. Reviewer visits `/review/<shareToken>`
2. Enters their email address
3. POST `/api/magic-link` — verifies the email belongs to a reviewer for that company, creates a `MagicToken` record (1-hour TTL, single-use)
4. The magic link URL (`/review/<token>?token=<uuid>`) is returned in the response body in development. **In production this must be emailed** — see [Magic Link Emails](#magic-link-emails)
5. Reviewer clicks the link → `?token` query param is picked up by a `useEffect`, passed to the `magic-link` NextAuth provider, and the token is validated and consumed

The JWT carries `role` and `companyId` claims, so API route handlers can authorise without an extra database lookup per request.

---

## AI Features

Powered by **Anthropic Claude** (`claude-sonnet-4-6`) via the official Node.js SDK.

### Resume Extraction (Team Tailor Import)

When importing candidates from Team Tailor, Claude reads each candidate's resume and extracts structured data:

| Field | Format |
|---|---|
| `summary` | 2–3 sentence professional summary |
| `skills` | `string[]` |
| `experience` | `{ title, company, startDate, endDate, description }[]` |
| `education` | `{ degree, school, year }[]` |
| `certifications` | `string[]` |

Candidates with `summaryIsManual: true` have their summaries preserved on re-sync — useful when a recruiter has manually written a bespoke summary.

### Role-Tailored Summaries

When a candidate is assigned to a role, Claude rewrites their general summary to specifically highlight fit for that role. This happens automatically on assignment and can be manually regenerated per-candidate.

**Input:** candidate's general summary + role title + role description (optional)
**Output:** 2–3 sentence tailored summary stored in `CandidateAssignment.tailoredSummary`
**Display:** the tailored summary is shown in the review portal in place of the general summary when present

The utility is in `src/lib/tailor-summary.ts`:

```typescript
export async function tailorSummary(
  candidateSummary: string,
  candidateName: string,
  roleTitle: string,
  roleDescription: string | null
): Promise<string>
```

Gracefully falls back to the original summary if the Anthropic API call fails, so assignment never blocks on an AI error.

---

## API Reference

All endpoints under `/api/candidates/*` and `/api/companies/*` require an authenticated session with `role === "ADMIN"`. Review portal endpoints use a company share token for access control.

### Candidates

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/candidates` | ADMIN | List all candidates |
| `POST` | `/api/candidates` | ADMIN | Create a candidate manually |
| `GET` | `/api/candidates/[id]` | ADMIN | Get full candidate detail |
| `PATCH` | `/api/candidates/[id]` | ADMIN | Update candidate fields |
| `DELETE` | `/api/candidates/[id]` | ADMIN | Delete candidate |

### Companies

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/companies` | ADMIN | List all companies |
| `POST` | `/api/companies` | ADMIN | Create a company |
| `GET` | `/api/companies/[id]` | ADMIN | Get company with roles, assignments, and reviewers |
| `PATCH` | `/api/companies/[id]` | ADMIN | Update name, contact info, notes, or isActive |
| `DELETE` | `/api/companies/[id]` | ADMIN | Delete company and all related data |
| `POST` | `/api/companies/[id]/regenerate-link` | ADMIN | Rotate the share token (invalidates old review link) |
| `POST` | `/api/companies/[id]/reviewers` | ADMIN | Add a reviewer by email + name |
| `DELETE` | `/api/companies/[id]/reviewers` | ADMIN | Remove a reviewer. Body: `{ reviewerId }` |

### Roles

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/companies/[id]/roles` | ADMIN | List roles for a company, ordered by creation date |
| `POST` | `/api/companies/[id]/roles` | ADMIN | Create a role. Body: `{ title, description? }` |
| `PATCH` | `/api/companies/[id]/roles/[roleId]` | ADMIN | Update title and/or description. Only provided fields are updated. |
| `DELETE` | `/api/companies/[id]/roles/[roleId]` | ADMIN | Delete role. Existing assignments have `roleId` set to null (not deleted). |

### Assignments

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/companies/[id]/assign` | ADMIN | Assign one or more candidates to a role. Body: `{ candidateIds: string[], roleId: string }`. Calls Claude to generate a tailored summary per candidate. Returns partial success if some fail. |
| `DELETE` | `/api/companies/[id]/assign` | ADMIN | Remove a candidate from a role. Query: `?candidateId=&roleId=` |
| `POST` | `/api/companies/[id]/roles/[roleId]/assignments/[assignmentId]/tailor` | ADMIN | Regenerate the tailored summary for a single assignment. |

### Review Portal

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/magic-link` | Public | Request a magic link. Body: `{ email, companyToken }`. Validates that the email is a registered reviewer for the company. Returns `{ magicLink }` in development. |
| `GET` | `/api/review/[token]` | Reviewer session | Fetch company info + candidate list grouped with review statuses for the authenticated reviewer. Returns `{ authenticated: false }` if not signed in. |
| `POST` | `/api/reviews` | Reviewer session | Submit or update a review. Body: `{ candidateId, assignmentId, status, feedback? }`. Valid statuses: `REQUEST_INTERVIEW`, `NOT_INTERESTED`. |

### Team Tailor Integration

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/teamtailor/config` | ADMIN | Get current config. Returns `{ configured, maskedKey, region, lastSyncAt }`. |
| `POST` | `/api/teamtailor/config` | ADMIN | Save API key and region. Body: `{ apiKey, apiRegion }`. If `apiKey` is omitted or masked, only the region is updated. New keys are validated against the Team Tailor API before saving. |
| `GET` | `/api/teamtailor/jobs` | ADMIN | Proxy to Team Tailor — list active job postings. |
| `GET` | `/api/teamtailor/jobs/[id]/applicants` | ADMIN | Proxy to Team Tailor — list applicants for a specific job. |
| `POST` | `/api/teamtailor/import` | ADMIN | Import candidates. Body: array of candidate objects from Team Tailor. Upserts on `teamTailorId`. Calls Claude to extract resume data for new candidates. |

---

## Pages & UI

### Admin (`/admin/*`) — ADMIN role required

| Route | Description |
|---|---|
| `/admin` | Dashboard: total candidate count, company count, completed reviews, pending reviews. Recent review activity feed. Company list with review progress. |
| `/admin/candidates` | Full candidate list. |
| `/admin/candidates/[id]` | Candidate detail: edit profile fields, view company/role assignments, manage skills and experience. |
| `/admin/companies` | Company list with assignment and reviewer counts. |
| `/admin/companies/[id]` | Company detail page. Manage roles (add / edit / delete inline), assign candidates to roles, view tailored summaries, regenerate summaries, manage reviewers, copy or rotate the review link. |
| `/admin/settings` | Configure Team Tailor API key and region. Browse job listings and select applicants to import. |

### Review Portal (`/review/[token]`) — Reviewer auth required

The public-facing portal shared with hiring managers via a unique URL.

- **Auth screen:** Magic link (enter email → click link) or password login toggle
- **Candidate grid:** Cards for all candidates assigned to the company, automatically grouped by role when more than one role exists
- **Filter bar:** All / To Review / Interview / Not Interested
- **Progress indicator:** `X of Y reviewed` counter + progress bar in the header
- **Candidate detail:** Full profile view — photo, tailored summary (falls back to general summary), skills, work experience timeline, education
- **Review panel:** Two-option picker — **Request Interview** or **Not Interested** — plus optional feedback text field

### Login (`/login`)

Admin email + password login. Redirects to `/admin` on success.

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- An [Anthropic API key](https://console.anthropic.com/)
- (Optional) A [Team Tailor](https://www.teamtailor.com/) account and API key for ATS import

### 1. Clone and Install

```bash
git clone <repo-url>
cd roster/app
npm install
# Prisma client is generated automatically via the postinstall script
```

### 2. Configure Environment

Create a `.env` file in the `app/` directory (see [Environment Variables](#environment-variables) for all options):

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/roster"
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
ANTHROPIC_API_KEY="sk-ant-..."
```

### 3. Set Up the Database

```bash
# Create the PostgreSQL database
createdb roster

# Apply all migrations
npx prisma migrate deploy
```

Optionally open Prisma Studio to browse and edit data:

```bash
npx prisma studio
```

### 4. Create Your First Admin User

There is no seed script — insert the first admin user directly via psql or Prisma Studio.

**Generate a bcrypt hash for your password:**

```bash
node -e "require('bcryptjs').hash('your-password', 10).then(h => console.log(h))"
```

**Insert via psql:**

```sql
INSERT INTO "User" (id, email, name, "passwordHash", role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@yourcompany.com',
  'Admin',
  '<paste-bcrypt-hash>',
  'ADMIN',
  now(),
  now()
);
```

### 5. Run the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000/admin](http://localhost:3000/admin) and sign in with your admin credentials.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string, e.g. `postgresql://user:password@localhost:5432/roster` |
| `NEXTAUTH_SECRET` | Yes | Random string used to sign JWTs. Generate with `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | Yes | Full URL of the app, e.g. `http://localhost:3000` in dev or `https://yourdomain.com` in prod. |
| `ANTHROPIC_API_KEY` | Yes | API key from [console.anthropic.com](https://console.anthropic.com/). Used for resume extraction and tailored summaries. |

> **Security:** Never commit a `.env` file containing real credentials. Add it to `.gitignore`. The default Next.js `.gitignore` excludes `.env*`.

### Team Tailor API Key

The Team Tailor API key is **not** an environment variable — it is stored in the `TeamTailorConfig` database table and managed through **Admin → Settings**. This allows rotating credentials without redeploying the application.

---

## Database Setup

### Migrations

Roster uses Prisma Migrate for schema versioning. Migration SQL files are committed to the repository so the full history is reproducible.

```bash
# Apply all pending migrations — use this in production and CI
npx prisma migrate deploy

# Create a new migration during development (interactive, requires TTY)
npx prisma migrate dev --name describe-your-change

# Check which migrations are applied vs pending
npx prisma migrate status

# Manually regenerate the Prisma client (normally automatic)
npx prisma generate
```

The Prisma client is output to `src/generated/prisma/` (gitignored). It is rebuilt automatically:
- **On `npm install`** via the `postinstall` script
- **On `npm run build`** before Next.js compiles

If you see TypeScript errors about unknown Prisma models after a schema change, run `npx prisma generate` and restart the dev server.

### Migration History

| Migration | Description |
|---|---|
| `20260305125246_init` | Initial schema: User, Company, Candidate, CandidateAssignment, Review, MagicToken, TeamTailorConfig |
| `20260305180000_add_roles` | Role model; `roleId`, `tailoredSummary`, `updatedAt` added to CandidateAssignment; unique constraint updated to `(candidateId, companyId, roleId)` |
| `20260305190000_remove_interested_status` | Removed `INTERESTED` from `ReviewStatus` enum; existing INTERESTED reviews migrated to `NOT_REVIEWED` |

---

## Development Workflow

### Running Locally

```bash
npm run dev          # Next.js dev server with Turbopack (hot reload)
npx prisma studio    # Web UI to browse and edit the database
```

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server at `http://localhost:3000` |
| `npm run build` | Regenerate Prisma client, then compile for production |
| `npm start` | Start the production server (requires a prior build) |
| `npm run lint` | Run ESLint |
| `npx tsc --noEmit` | Type-check without emitting files |
| `npx prisma generate` | Regenerate the Prisma client after schema changes |
| `npx prisma studio` | Open database browser UI |
| `npx prisma migrate deploy` | Apply pending migrations (production) |
| `npx prisma migrate dev` | Create and apply a new migration (development) |

### Team Tailor Import Flow

1. Go to `/admin/settings` → enter your Team Tailor API key and region → Save
2. Click **Browse Jobs** → select a job from the list
3. View applicants for that job → select candidates → click **Import**
4. Claude processes each resume in the background and creates/updates candidate records

### Review Portal Flow (end-to-end)

1. Create a company at `/admin/companies`
2. Open the company → add one or more **Roles** (title + optional description)
3. On each role, click **+ Candidates** → select candidates from the list → **Assign**
   - Claude generates a role-tailored summary for each candidate (~2–5 seconds per candidate)
4. Add **Reviewers** (name + email) to the company
5. Copy the **Review Link** and share it with the hiring manager
6. Hiring manager visits the link → authenticates via magic link email → reviews candidates by marking each as **Request Interview** or **Not Interested**

---

## Deployment

### Environment Variables

Set all [required environment variables](#environment-variables) in your hosting platform's secret store before deploying.

For production specifically:
- `NEXTAUTH_URL` must be your actual public domain (e.g. `https://roster.yourcompany.com`)
- `NEXTAUTH_SECRET` must be a strong random string: `openssl rand -base64 32`
- `DATABASE_URL` must point to a production PostgreSQL instance

### Database Migration

Add `npx prisma migrate deploy` to your deployment pipeline (before starting the app) to apply any pending migrations automatically.

### Hosting Options

| Platform | Notes |
|---|---|
| **Vercel** | Recommended. Zero-config Next.js deployment. Add a Vercel Postgres addon or connect an external PostgreSQL URL. |
| **Railway** | Add a PostgreSQL service, link it via `DATABASE_URL`, and deploy from the GitHub repo. |
| **Render** | Use a Web Service + PostgreSQL addon. Set the start command to `npm start`. |
| **Docker** | `npm run build && npm start`. Pass env vars via `--env-file` or your orchestrator's secret injection. |

### Magic Link Emails

In development, the magic link URL is returned directly in the `/api/magic-link` response body (visible in the browser DevTools Network tab) for easy testing.

**For production**, the magic link must be emailed to the reviewer. Update `src/app/api/magic-link/route.ts` to send an email using a transactional email provider instead of returning the link in the response:

| Provider | SDK |
|---|---|
| [Resend](https://resend.com/) | `npm install resend` |
| [SendGrid](https://sendgrid.com/) | `npm install @sendgrid/mail` |
| [Postmark](https://postmarkapp.com/) | `npm install postmark` |

---

## Design System

Roster uses Tailwind CSS v4 with a custom design system based on two palettes:

| Palette | Scale | Usage |
|---|---|---|
| **Navy** | `navy-50` → `navy-950` | Page backgrounds, text, borders, sidebar |
| **Orange** | `orange-400` → `orange-600` | Primary actions, brand accent, icons |
| **Cream** | `cream-50` | Page background (`bg-cream-50`) |

### Common Patterns

```
Card:              bg-white rounded-lg border border-navy-200
Primary button:    bg-orange-500 hover:bg-orange-600 text-white rounded-md font-semibold
Secondary button:  border border-navy-200 text-navy-600 rounded-md hover:bg-navy-50
Input:             border border-navy-200 rounded-md focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500
Dark surface:      bg-navy-950 text-white  (review portal header, auth screen)
Spinner:           animate-spin rounded-full border-2 border-navy-200 border-t-orange-500
```

---

## Troubleshooting

### "Failed to load company" in the admin UI

This is almost always caused by a stale Prisma client after a schema change. Fix:

```bash
npx prisma generate
# Then restart the dev server (Ctrl+C → npm run dev)
```

### Prisma TypeScript errors after pulling new code

The generated client (`src/generated/prisma/`) is gitignored and must be rebuilt locally:

```bash
npm install   # triggers postinstall → prisma generate automatically
```

Or manually:

```bash
npx prisma generate
```

### `DATABASE_URL` not found / P1003 error

Next.js loads `.env` automatically in dev. Outside of Next.js (e.g. running a node script directly), you must load it manually or prefix with `dotenv`:

```bash
node -e "require('dotenv/config'); ..."
```

Ensure `app/.env` (relative to the repo root) exists and contains a valid `DATABASE_URL`.

### Magic link not working

- Check that the `companyToken` in the request matches the `shareToken` of an active company
- Check that the reviewer's email is in the `User` table with `role = 'REVIEWER'` and `companyId` matching that company
- Magic tokens expire after 1 hour and are single-use

### "middleware is deprecated" warning on dev server start

This is a pre-existing Next.js deprecation warning about the middleware file naming convention. It does not affect functionality. It will be addressed in a future update.

---

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Verify TypeScript: `npx tsc --noEmit`
4. Verify the build: `npm run build`
5. Open a pull request against `main`
