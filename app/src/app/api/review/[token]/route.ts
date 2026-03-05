import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const session = await auth();

  // Find company by share token
  const company = await prisma.company.findUnique({
    where: { shareToken: token },
  });

  if (!company || !company.isActive) {
    return NextResponse.json({ error: "Invalid or inactive link" }, { status: 404 });
  }

  // If user is authenticated and is a reviewer for this company
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user?.companyId === company.id && user?.role === "REVIEWER") {
      // Return candidates assigned to this company with this user's reviews
      const assignments = await prisma.candidateAssignment.findMany({
        where: { companyId: company.id },
        include: {
          candidate: {
            select: {
              id: true,
              firstName: true,
              summary: true,
              skills: true,
              experience: true,
              education: true,
              certifications: true,
              pictureUrl: true,
            },
          },
          reviews: {
            where: { reviewerId: session.user.id },
          },
          role: {
            select: { id: true, title: true },
          },
        },
      });

      return NextResponse.json({
        authenticated: true,
        company: { name: company.name },
        candidates: assignments.map((a) => ({
          assignmentId: a.id,
          tailoredSummary: a.tailoredSummary,
          role: a.role ? { id: a.role.id, title: a.role.title } : null,
          ...a.candidate,
          myReview: a.reviews[0] || null,
        })),
      });
    }
  }

  // Not authenticated — return company info for login screen
  return NextResponse.json({
    authenticated: false,
    company: { name: company.name },
  });
}
