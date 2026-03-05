import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; roleId: string }> }) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { roleId } = await params;
  const { title, description } = await req.json();
  const role = await prisma.role.update({
    where: { id: roleId },
    data: { title: title?.trim(), description: description?.trim() || null },
  });
  return NextResponse.json({ role });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; roleId: string }> }) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { roleId } = await params;
  await prisma.role.delete({ where: { id: roleId } });
  return NextResponse.json({ ok: true });
}
