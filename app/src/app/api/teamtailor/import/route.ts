import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractResume } from "@/lib/extract-resume";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { candidates } = await req.json();

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return NextResponse.json({ error: "No candidates provided" }, { status: 400 });
  }

  const imported = [];

  for (const c of candidates) {
    const existing = await prisma.candidate.findUnique({
      where: { teamTailorId: c.teamTailorId },
    });

    if (existing) {
      // Resync - update TT fields but preserve manual summary
      const updated = await prisma.candidate.update({
        where: { id: existing.id },
        data: {
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          phone: c.phone,
          pictureUrl: c.pictureUrl,
          resumeUrl: c.resumeUrl,
          linkedinUrl: c.linkedinUrl,
          tags: c.tags || [],
          // Only update summary if not manually edited
          ...(existing.summaryIsManual ? {} : { summary: c.pitch || existing.summary }),
          lastSyncedAt: new Date(),
        },
      });
      imported.push(updated);
    } else {
      // New import — extract structured resume data via Claude
      const extracted = await extractResume(c.resumeUrl ?? null, c.resumeSummary ?? "");
      const created = await prisma.candidate.create({
        data: {
          teamTailorId: c.teamTailorId,
          firstName: c.firstName,
          lastName: c.lastName || "",
          email: c.email,
          phone: c.phone,
          pictureUrl: c.pictureUrl,
          resumeUrl: c.resumeUrl,
          linkedinUrl: c.linkedinUrl,
          summary: extracted.summary || c.pitch || "",
          tags: c.tags || [],
          skills: extracted.skills,
          experience: extracted.experience,
          education: extracted.education,
          certifications: [],
          lastSyncedAt: new Date(),
        },
      });
      imported.push(created);
    }
  }

  return NextResponse.json({ imported: imported.length });
}
