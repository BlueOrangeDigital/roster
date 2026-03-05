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

  if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
    return NextResponse.json({ error: "candidateIds must be a non-empty array" }, { status: 400 });
  }

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role || role.companyId !== companyId) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  const results = [];
  const failures: string[] = [];
  for (const candidateId of candidateIds) {
    try {
      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        select: { summary: true, firstName: true, lastName: true },
      });
      if (!candidate) continue;

      const name = `${candidate.firstName} ${candidate.lastName}`.trim();
      const tailored = await tailorSummary(candidate.summary || "", name, role.title, role.description);

      const assignment = await prisma.candidateAssignment.upsert({
        where: { candidateId_companyId_roleId: { candidateId, companyId, roleId } },
        create: { candidateId, companyId, roleId, tailoredSummary: tailored },
        update: { tailoredSummary: tailored },
      });
      results.push(assignment);
    } catch (err) {
      console.error(`assign: failed for candidate ${candidateId}`, err);
      failures.push(candidateId as string);
    }
  }

  return NextResponse.json({ assigned: results.length, failed: failures });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const candidateId = req.nextUrl.searchParams.get("candidateId");
  const roleId = req.nextUrl.searchParams.get("roleId");
  if (!candidateId) {
    return NextResponse.json({ error: "candidateId required" }, { status: 400 });
  }
  await prisma.candidateAssignment.deleteMany({
    where: {
      companyId: id,
      candidateId,
      ...(roleId ? { roleId } : {}),
    },
  });
  return NextResponse.json({ success: true });
}
