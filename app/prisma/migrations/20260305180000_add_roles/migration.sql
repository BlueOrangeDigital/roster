-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add new columns to CandidateAssignment
ALTER TABLE "CandidateAssignment" ADD COLUMN "roleId" TEXT;
ALTER TABLE "CandidateAssignment" ADD COLUMN "tailoredSummary" TEXT;
ALTER TABLE "CandidateAssignment" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropIndex: old unique constraint (candidateId, companyId)
DROP INDEX "CandidateAssignment_candidateId_companyId_key";

-- CreateIndex: new unique constraint (candidateId, companyId, roleId)
CREATE UNIQUE INDEX "CandidateAssignment_candidateId_companyId_roleId_key" ON "CandidateAssignment"("candidateId", "companyId", "roleId");

-- CreateIndex: index on roleId
CREATE INDEX "CandidateAssignment_roleId_idx" ON "CandidateAssignment"("roleId");

-- AddForeignKey: Role -> Company
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CandidateAssignment -> Role
ALTER TABLE "CandidateAssignment" ADD CONSTRAINT "CandidateAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
