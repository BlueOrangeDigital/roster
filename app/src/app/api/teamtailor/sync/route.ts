import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await prisma.teamTailorConfig.findFirst();
  if (!config) {
    return NextResponse.json({ error: "Team Tailor not configured" }, { status: 400 });
  }

  const baseUrl =
    config.apiRegion === "us"
      ? "https://api.na.teamtailor.com"
      : "https://api.teamtailor.com";

  // Get all candidates currently in the DB that came from TT
  const dbCandidates = await prisma.candidate.findMany({
    where: { teamTailorId: { not: null } },
    select: { teamTailorId: true, id: true },
  });

  const ttIds = dbCandidates
    .map((c) => c.teamTailorId)
    .filter((id): id is string => id !== null);

  if (ttIds.length === 0) {
    return NextResponse.json({ candidates: [] });
  }

  // Fetch each candidate directly from TT API
  const candidates = [];

  for (const ttId of ttIds) {
    try {
      const res = await fetch(`${baseUrl}/v1/candidates/${ttId}`, {
        headers: {
          Authorization: `Token token=${config.apiKey}`,
          "X-Api-Version": "20161108",
        },
      });

      if (!res.ok) continue;

      const data = await res.json();
      const attrs = data.data?.attributes;
      if (!attrs) continue;

      candidates.push({
        teamTailorId: ttId,
        firstName: attrs["first-name"] ?? "",
        lastName: attrs["last-name"] ?? "",
        email: attrs.email ?? "",
        phone: attrs.phone ?? "",
        pictureUrl:
          typeof attrs.picture === "object" && attrs.picture?.standard
            ? attrs.picture.standard
            : null,
        resumeUrl: attrs["original-resume"] ?? attrs.resume ?? null,
        linkedinUrl: attrs["linkedin-url"] ?? "",
        tags: attrs.tags ?? [],
        pitch: attrs.pitch ?? "",
        resumeSummary: attrs["resume-summary"] ?? "",
      });
    } catch {
      // Skip candidates that fail to fetch
      continue;
    }
  }

  return NextResponse.json({ candidates });
}
