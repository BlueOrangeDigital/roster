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
      where: { candidateId_companyId_roleId: { candidateId, companyId, roleId } },
      create: { candidateId, companyId, roleId, tailoredSummary: tailored },
      update: { tailoredSummary: tailored },
    });
    results.push(assignment);
  }

  return NextResponse.json({ assigned: results.length });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { candidateId } = await req.json();

  await prisma.candidateAssignment.deleteMany({
    where: { companyId: id, candidateId },
  });

  return NextResponse.json({ success: true });
}
