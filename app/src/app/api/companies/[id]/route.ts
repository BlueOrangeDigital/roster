import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      assignments: {
        include: {
          candidate: true,
          reviews: {
            include: { reviewer: { select: { name: true, email: true, id: true } } },
          },
        },
      },
      reviewers: { select: { id: true, name: true, email: true } },
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
    },
  });

  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(company);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const data = await req.json();

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.contactName !== undefined) updateData.contactName = data.contactName;
  if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const company = await prisma.company.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(company);
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
  await prisma.company.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
