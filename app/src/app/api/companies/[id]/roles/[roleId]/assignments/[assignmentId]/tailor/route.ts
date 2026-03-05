import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tailorSummary } from "@/lib/tailor-summary";
import { Prisma } from "@/generated/prisma/client";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; roleId: string; assignmentId: string }> }
) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: companyId, roleId, assignmentId } = await params;

  try {
    const assignment = await prisma.candidateAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        candidate: { select: { summary: true, firstName: true, lastName: true } },
        role: true,
      },
    });
    if (!assignment || assignment.roleId !== roleId || !assignment.role || assignment.role.companyId !== companyId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const name = [assignment.candidate.firstName, assignment.candidate.lastName]
      .filter(Boolean)
      .join(" ");
    const tailored = await tailorSummary(
      assignment.candidate.summary || "",
      name,
      assignment.role.title,
      assignment.role.description
    );

    const updated = await prisma.candidateAssignment.update({
      where: { id: assignmentId },
      data: { tailoredSummary: tailored },
    });

    return NextResponse.json({ tailoredSummary: updated.tailoredSummary });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw e;
  }
}
