-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "roster";

-- CreateEnum
CREATE TYPE "roster"."UserRole" AS ENUM ('ADMIN', 'REVIEWER');

-- CreateEnum
CREATE TYPE "roster"."ReviewStatus" AS ENUM ('NOT_REVIEWED', 'REQUEST_INTERVIEW', 'NOT_INTERESTED');

-- CreateTable
CREATE TABLE "roster"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "role" "roster"."UserRole" NOT NULL DEFAULT 'REVIEWER',
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster"."MagicToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster"."Candidate" (
    "id" TEXT NOT NULL,
    "teamTailorId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "pictureUrl" TEXT,
    "resumeUrl" TEXT,
    "summary" TEXT,
    "summaryIsManual" BOOLEAN NOT NULL DEFAULT false,
    "skills" JSONB NOT NULL DEFAULT '[]',
    "experience" JSONB NOT NULL DEFAULT '[]',
    "education" JSONB NOT NULL DEFAULT '[]',
    "certifications" JSONB NOT NULL DEFAULT '[]',
    "linkedinUrl" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster"."Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "notes" TEXT,
    "shareToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster"."CandidateAssignment" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "roleId" TEXT,
    "tailoredSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster"."Review" (
    "id" TEXT NOT NULL,
    "status" "roster"."ReviewStatus" NOT NULL DEFAULT 'NOT_REVIEWED',
    "feedback" TEXT,
    "reviewerId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster"."TeamTailorConfig" (
    "id" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "apiRegion" TEXT NOT NULL DEFAULT 'eu',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamTailorConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster"."Role" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "roster"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MagicToken_token_key" ON "roster"."MagicToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_teamTailorId_key" ON "roster"."Candidate"("teamTailorId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_shareToken_key" ON "roster"."Company"("shareToken");

-- CreateIndex
CREATE INDEX "CandidateAssignment_roleId_idx" ON "roster"."CandidateAssignment"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateAssignment_candidateId_companyId_roleId_key" ON "roster"."CandidateAssignment"("candidateId", "companyId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_reviewerId_candidateId_assignmentId_key" ON "roster"."Review"("reviewerId", "candidateId", "assignmentId");

-- AddForeignKey
ALTER TABLE "roster"."User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "roster"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster"."MagicToken" ADD CONSTRAINT "MagicToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "roster"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster"."CandidateAssignment" ADD CONSTRAINT "CandidateAssignment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "roster"."Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster"."CandidateAssignment" ADD CONSTRAINT "CandidateAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "roster"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster"."CandidateAssignment" ADD CONSTRAINT "CandidateAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roster"."Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster"."Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "roster"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster"."Review" ADD CONSTRAINT "Review_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "roster"."Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster"."Review" ADD CONSTRAINT "Review_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "roster"."CandidateAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster"."Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "roster"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
