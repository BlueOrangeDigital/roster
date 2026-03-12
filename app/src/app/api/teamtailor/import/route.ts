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
      // Resync - update TT fields and re-extract resume if profile is empty
      const needsExtraction = !existing.summaryIsManual && (
        !existing.summary ||
        (Array.isArray(existing.skills) && (existing.skills as unknown[]).length === 0) ||
        (typeof existing.skills === 'string' && existing.skills === '[]')
      );

      let extractedData: { summary?: string; skills?: string[]; experience?: any; education?: any } = {};
      if (needsExtraction) {
        try {
          const extracted = await extractResume(c.resumeUrl ?? null, c.resumeSummary ?? "");
          if (extracted.summary || extracted.skills.length > 0) {
            extractedData = {
              summary: extracted.summary || c.pitch || undefined,
              skills: extracted.skills.length > 0 ? extracted.skills : undefined,
              experience: extracted.experience.length > 0 ? (extracted.experience as any) : undefined,
              education: extracted.education.length > 0 ? (extracted.education as any) : undefined,
            };
          }
        } catch (err) {
          console.error(`Resume extraction failed for TT candidate ${c.teamTailorId}:`, err);
        }
      }

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
          ...(existing.summaryIsManual ? {} : { summary: extractedData.summary || c.pitch || existing.summary }),
          ...(extractedData.skills ? { skills: extractedData.skills } : {}),
          ...(extractedData.experience ? { experience: extractedData.experience } : {}),
          ...(extractedData.education ? { education: extractedData.education } : {}),
          lastSyncedAt: new Date(),
        },
      });
      imported.push(updated);
    } else {
      // New import — extract structured resume data via Claude
      let extracted = { summary: "", skills: [] as string[], experience: [] as any[], education: [] as any[] };
      try {
        extracted = await extractResume(c.resumeUrl ?? null, c.resumeSummary ?? "");
      } catch (err) {
        console.error(`Resume extraction failed for new TT candidate ${c.teamTailorId}:`, err);
      }

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
          experience: extracted.experience as any,
          education: extracted.education as any,
          certifications: [],
          lastSyncedAt: new Date(),
        },
      });
      imported.push(created);
    }
  }

  return NextResponse.json({ imported: imported.length });
}
