-- Update any existing INTERESTED reviews to NOT_REVIEWED
UPDATE "Review" SET "status" = 'NOT_REVIEWED' WHERE "status" = 'INTERESTED';

-- Drop the default so we can alter the column type
ALTER TABLE "Review" ALTER COLUMN "status" DROP DEFAULT;

-- Recreate the ReviewStatus enum without INTERESTED
-- PostgreSQL doesn't support removing enum values directly, so we must recreate the type.
ALTER TABLE "Review" ALTER COLUMN "status" TYPE TEXT;
DROP TYPE "ReviewStatus";
CREATE TYPE "ReviewStatus" AS ENUM ('NOT_REVIEWED', 'REQUEST_INTERVIEW', 'NOT_INTERESTED');
ALTER TABLE "Review" ALTER COLUMN "status" TYPE "ReviewStatus" USING "status"::"ReviewStatus";

-- Restore the default
ALTER TABLE "Review" ALTER COLUMN "status" SET DEFAULT 'NOT_REVIEWED'::"ReviewStatus";
