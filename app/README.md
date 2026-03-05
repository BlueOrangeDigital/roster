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

---

## Overview

### The Problem

Recruitment agencies manage candidates across many client companies and open roles. Sharing candidate profiles with hiring managers is slow, requires exporting files, and gives hiring managers no structured way to give feedback.

### What Roster Does

1. **Import candidates** from Team Tailor (ATS) with one click. Claude extracts structured data (skills, experience, education, summary) from resumes automatically.
2. **Organise by company + role.** Each candidate is assigned to a client company and a specific job role.
3. **Generate tailored summaries.** When a candidate is assigned to a role, Claude rewrites their general summary to highlight fit for that specific role and its requirements.
4. **Share a review portal.** Each company gets a unique, shareable URL. Reviewers authenticate via magic link, then mark candidates as Interested, Request Interview, or Not Interested — with optional feedback.
5. **Track everything** from the admin dashboard: review progress, pending reviews, recent activity.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, TypeScript) |
| UI | [Tailwind CSS v4](https://tailwindcss.com/) |
| Database | PostgreSQL |
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
│  │  (ADMIN role)  │    │  (REVIEWER role /        │  │
│  └───────┬────────┘    │   magic link auth)       │  │
│          │             └──────────────┬───────────┘  │
│          │                            │              │
│  ┌───────▼────────────────────────────▼───────────┐  │
│  │              REST API  /api/*                   │  │
│  │  (NextAuth session-guarded route handlers)      │  │
│  └───────────────────────┬─────────────────────────┘  │
│                          │                            │
│  ┌───────────────────────▼─────────────────────────┐  │
│  │             Prisma ORM + PostgreSQL              │  │
│  └─────────────────────────────────────────────────┘  │
│                          │                            │
│  ┌───────────────────────▼─────────────────────────┐  │
│  │  Anthropic Claude API  (resume extraction,       │  │
│  │  tailored summaries)                             │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
         │
         │  Team Tailor API
         ▼
  ┌──────────────┐
  │  Team Tailor │  (ATS — source of candidates)
  └──────────────┘
```

### Directory Structure

```
app/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── prisma.config.ts       # Prisma configuration
│   └── migrations/            # SQL migration history
│       ├── 20260305125246_init/
│       └── 20260305180000_add_roles/
├── src/
│   ├── app/
│   │   ├── admin/             # Admin dashboard (protected)
│   │   │   ├── layout.tsx     # Sidebar navigation
│   │   │   ├── page.tsx       # Dashboard overview
│   │   │   ├── candidates/    # Candidate management
│   │   │   ├── companies/     # Company + role management
│   │   │   └── settings/      # Team Tailor integration config
│   │   ├── api/               # REST API route handlers
│   │   │   ├── auth/          # NextAuth endpoints
│   │   │   ├── candidates/    # Candidate CRUD
│   │   │   ├── companies/     # Company, role, assignment APIs
│   │   │   ├── magic-link/    # Magic link token generation
│   │   │   ├── review/        # Review portal data API
│   │   │   ├── reviews/       # Review submission
│   │   │   └── teamtailor/    # ATS integration
│   │   ├── login/             # Admin login page
│   │   ├── review/            # Public review portal
│   │   └── globals.css
│   └── lib/
│       ├── auth.ts            # NextAuth configuration
│       ├── db.ts              # Prisma client singleton
│       └── tailor-summary.ts  # Claude summary rewriting utility
└── docs/
    └── plans/                 # Implementation plans (archived)
```

---

## Data Model

```
User
├── id, email, name, passwordHash
├── role: ADMIN | REVIEWER
└── companyId? → Company (reviewer's assigned company)

Company
├── id, name, contactName, contactEmail, notes
├── shareToken (unique — used in review portal URL)
├── isActive
├── reviewers → User[]
├── roles → Role[]
└── assignments → CandidateAssignment[]

Role
├── id, title, description?
├── companyId → Company
└── assignments → CandidateAssignment[]

Candidate
├── id, teamTailorId?
├── firstName, lastName, email, phone
├── pictureUrl, resumeUrl, linkedinUrl
├── summary (general), summaryIsManual
├── skills: Json[], experience: Json[], education: Json[], certifications: Json[]
└── assignments → CandidateAssignment[]

CandidateAssignment          ← candidate assigned to a specific role at a company
├── id
├── candidateId → Candidate
├── companyId → Company
├── roleId? → Role
├── tailoredSummary?         ← Claude-generated, role-specific summary
├── @@unique([candidateId, companyId, roleId])
└── reviews → Review[]

Review
├── id, status: NOT_REVIEWED | INTERESTED | REQUEST_INTERVIEW | NOT_INTERESTED
├── feedback?
├── reviewerId → User
├── candidateId → Candidate
└── assignmentId → CandidateAssignment

MagicToken
├── id, token (unique)
├── userId → User
├── expiresAt (1 hour TTL)
└── used: Boolean

TeamTailorConfig
└── apiKey, apiRegion, lastSyncAt
```

---

## Authentication

Roster uses **NextAuth.js v5** with three Credentials providers:

### `admin-login`
Email + password login for ADMIN users. Passwords stored as bcrypt hashes. Used on `/login`.

### `reviewer-login`
Email + password login for REVIEWER users with a password set. Fallback for reviewers who prefer password auth over magic links.

### `magic-link`
Passwordless login for reviewers. Flow:

1. Reviewer visits `/review/<shareToken>`
2. Enters email → POST `/api/magic-link` → generates a 1-hour single-use token
3. Token URL is sent (currently returned in dev mode for easy testing)
4. Reviewer clicks link → `?token=<uuid>` query param → `magic-link` NextAuth provider validates and signs in

Session strategy is **JWT**. The JWT carries `role` and `companyId` claims so route handlers can authorise without an extra DB lookup.

---

## AI Features

Powered by **Anthropic Claude** (`claude-sonnet-4-6`).

### Resume Extraction (Team Tailor Import)

When importing candidates from Team Tailor, Claude reads the candidate's resume URL and extracts structured data:

- `skills` — array of skill strings
- `experience` — `[{ title, company, startDate, endDate, description }]`
- `education` — `[{ degree, school, year }]`
- `certifications` — array of certification strings
- `summary` — 2–3 sentence professional summary

Existing candidates with manually-edited summaries (`summaryIsManual: true`) have their summaries preserved during sync.

### Tailored Summaries (Role Assignment)

When a candidate is assigned to a role via POST `/api/companies/[id]/assign`, Claude rewrites the candidate's general summary to highlight their fit for that specific role. The rewrite:

- Takes the candidate's general summary + the role's title and description
- Returns a 2–3 sentence summary tailored to the role requirements
- Is stored as `CandidateAssignment.tailoredSummary`
- Shown in the review portal instead of the general summary when present

Tailored summaries can also be regenerated individually via POST `/api/companies/[id]/roles/[roleId]/assignments/[assignmentId]/tailor`.

The utility lives in `src/lib/tailor-summary.ts`:

```typescript
export async function tailorSummary(
  candidateSummary: string,
  candidateName: string,
  roleTitle: string,
  roleDescription: string | null
): Promise<string>
```

Falls back to the original summary if the Anthropic API call fails.

---

## API Reference

All admin endpoints require an authenticated session with `role === "ADMIN"`. The review portal endpoints require a valid share token.

### Candidates

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/candidates` | List all candidates |
| `POST` | `/api/candidates` | Create candidate |
| `GET` | `/api/candidates/[id]` | Get candidate detail |
| `PATCH` | `/api/candidates/[id]` | Update candidate |
| `DELETE` | `/api/candidates/[id]` | Delete candidate |

### Companies

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/companies` | List all companies |
| `POST` | `/api/companies` | Create company |
| `GET` | `/api/companies/[id]` | Get company with roles, assignments, reviewers |
| `PATCH` | `/api/companies/[id]` | Update company (name, contact, notes, isActive) |
| `DELETE` | `/api/companies/[id]` | Delete company |
| `POST` | `/api/companies/[id]/regenerate-link` | Rotate share token |
| `POST` | `/api/companies/[id]/reviewers` | Add reviewer by email |
| `DELETE` | `/api/companies/[id]/reviewers` | Remove reviewer |

### Roles

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/companies/[id]/roles` | List roles for company |
| `POST` | `/api/companies/[id]/roles` | Create role `{ title, description? }` |
| `PATCH` | `/api/companies/[id]/roles/[roleId]` | Update role title/description |
| `DELETE` | `/api/companies/[id]/roles/[roleId]` | Delete role (assignments set roleId → null) |

### Assignments

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/companies/[id]/assign` | Assign candidates to a role. Body: `{ candidateIds: string[], roleId: string }`. Generates tailored summaries via Claude. |
| `DELETE` | `/api/companies/[id]/assign?candidateId=&roleId=` | Remove candidate from a role |
| `POST` | `/api/companies/[id]/roles/[roleId]/assignments/[assignmentId]/tailor` | Regenerate tailored summary for one assignment |

### Review Portal

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/magic-link` | Request magic link. Body: `{ email, companyToken }`. Returns `{ magicLink }` (dev) or sends email (prod). |
| `GET` | `/api/review/[token]` | Fetch company info + candidate list for review portal. Returns `authenticated: false` if not signed in. |
| `POST` | `/api/reviews` | Submit or update a review. Body: `{ candidateId, assignmentId, status, feedback? }`. |

### Team Tailor Integration

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/teamtailor/config` | Get current config (masked API key) |
| `POST` | `/api/teamtailor/config` | Save API key and region |
| `GET` | `/api/teamtailor/jobs` | List jobs from Team Tailor |
| `GET` | `/api/teamtailor/jobs/[id]/applicants` | List applicants for a job |
| `POST` | `/api/teamtailor/import` | Import candidates. Body: array of candidate objects. Uses Claude to extract resume data. |

---

## Pages & UI

### Admin (`/admin/*`) — ADMIN role required

| Route | Description |
|---|---|
| `/admin` | Dashboard: stats (candidate count, company count, reviews), recent review activity, company overview |
| `/admin/candidates` | Searchable candidate list |
| `/admin/candidates/[id]` | Candidate detail: edit profile, view assignments, manage skills/experience |
| `/admin/companies` | Company list with review progress indicators |
| `/admin/companies/[id]` | Company detail: manage roles, assign candidates to roles, manage reviewers, copy/regenerate review link |
| `/admin/settings` | Configure Team Tailor API key and region; browse jobs and import candidates |

### Review Portal (`/review/[token]`) — Reviewer auth required

The public-facing review portal that hiring managers use. Accessed via the unique share token URL.

- **Auth screen:** Magic link (email) or password login
- **Candidate grid:** All candidates assigned to the company, grouped by role when multiple roles exist
- **Filter bar:** All / To Review / Interested / Interview / Not Interested
- **Progress bar:** `X of Y reviewed` in the header
- **Candidate detail:** Full profile (photo, tailored summary, skills, experience, education) + review panel
- **Review panel:** Three-option picker (Interested / Request Interview / Not Interested) + optional feedback text

### Login (`/login`)

Admin email + password login page.

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- An [Anthropic API key](https://console.anthropic.com/)
- (Optional) A [Team Tailor](https://www.teamtailor.com/) account and API key

### 1. Clone and Install

```bash
git clone <repo-url>
cd roster/app
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local with your values (see Environment Variables below)
```

### 3. Set Up the Database

```bash
# Create the PostgreSQL database
createdb roster

# Apply migrations
npx prisma migrate deploy

# (Optional) Open Prisma Studio to browse data
npx prisma studio
```

### 4. Create Your First Admin User

```bash
# Seed script (or use Prisma Studio to insert manually)
# User must have role=ADMIN and a bcrypt-hashed password
node -e "
const bcrypt = require('bcryptjs');
bcrypt.hash('your-password', 10).then(h => console.log(h));
"
# Then insert into the User table via psql or Prisma Studio
```

### 5. Run the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000/admin](http://localhost:3000/admin) and sign in with your admin credentials.

---

## Environment Variables

Create a `.env.local` file in the `app/` directory:

```bash
# PostgreSQL connection string
DATABASE_URL="postgresql://user:password@localhost:5432/roster"

# NextAuth — generate a strong random string for production
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# Anthropic Claude API key
# https://console.anthropic.com/
ANTHROPIC_API_KEY="sk-ant-..."
```

> **Important:** Never commit `.env.local` or any file containing your API keys. The `.gitignore` excludes `.env.local` by default.

### Team Tailor

The Team Tailor API key is stored in the database (not in env vars) and configured through the Admin → Settings UI. This allows rotating credentials without redeploying.

---

## Database Setup

### Migrations

The project uses Prisma Migrate for schema management.

```bash
# Apply all pending migrations (production / CI)
npx prisma migrate deploy

# Create a new migration after editing schema.prisma (development)
npx prisma migrate dev --name describe-your-change

# Check migration status
npx prisma migrate status

# Regenerate the Prisma client after schema changes
npx prisma generate
```

The Prisma client is generated to `src/generated/prisma/` (configured in `prisma.config.ts`).

### Migration History

| Migration | Description |
|---|---|
| `20260305125246_init` | Initial schema: User, Company, Candidate, CandidateAssignment, Review, MagicToken, TeamTailorConfig |
| `20260305180000_add_roles` | Role model; `roleId`, `tailoredSummary`, `updatedAt` on CandidateAssignment; updated unique constraint to include `roleId` |

---

## Development Workflow

### Running Locally

```bash
npm run dev      # Start Next.js dev server (hot reload)
npx prisma studio  # Browse/edit database in browser UI
```

### Type Checking

```bash
npx tsc --noEmit
```

### Linting

```bash
npm run lint
```

### Production Build (verification)

```bash
npm run build
```

### Team Tailor Import Flow

1. Go to `/admin/settings` and save your Team Tailor API key
2. Go to `/admin/settings` → Browse Jobs tab
3. Select a job → view applicants
4. Click Import → Claude processes each resume and creates candidate records

### Review Portal Flow

1. Create a company at `/admin/companies` (or click an existing one)
2. Add roles (e.g. "Senior Engineer", "Product Designer")
3. Click **+ Candidates** on a role → select candidates → click **Assign**
   - Claude generates a tailored summary for each candidate in the background
4. Add reviewers (name + email)
5. Copy the review link and share it with the hiring manager
6. Reviewer visits the link → authenticates via magic link → reviews candidates

---

## Deployment

### Environment

Set all [environment variables](#environment-variables) in your hosting platform's secrets manager.

For production, ensure:
- `NEXTAUTH_URL` matches your actual domain
- `NEXTAUTH_SECRET` is a cryptographically random string (e.g. `openssl rand -base64 32`)
- `DATABASE_URL` points to a production PostgreSQL instance

### Database

Run `npx prisma migrate deploy` as part of your deployment pipeline to apply any pending migrations.

### Next.js

The app is a standard Next.js application and can be deployed to:

- **Vercel** — zero-config, recommended
- **Railway / Render** — connect a PostgreSQL addon and set env vars
- **Docker** — `npm run build && npm start`

### Magic Link Emails

The current implementation returns the magic link URL in the API response (useful for development). For production, replace the magic-link API handler with an email delivery integration (SendGrid, Resend, Postmark, etc.) — send the link to `email` instead of returning it in the response.

---

## Design System

Roster uses a custom Tailwind CSS design system built on two primary palettes:

- **Navy** (`navy-50` through `navy-950`) — backgrounds, text, borders
- **Orange** (`orange-400` through `orange-600`) — primary actions, accents, brand

Key conventions:
- Cards: `rounded-lg border border-navy-200 bg-white`
- Primary buttons: `bg-orange-500 hover:bg-orange-600 text-white rounded-md`
- Secondary buttons: `border border-navy-200 text-navy-600 rounded-md`
- Page backgrounds: `bg-cream-50`
- Dark surfaces (review portal header, auth screen): `bg-navy-950`

---

## Contributing

1. Create a feature branch from `main`
2. Make changes with TypeScript + `npx tsc --noEmit` passing
3. Verify `npm run build` succeeds
4. Open a pull request against `main`
