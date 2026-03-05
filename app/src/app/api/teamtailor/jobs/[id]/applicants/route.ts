import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }

  const config = await prisma.teamTailorConfig.findFirst();
  if (!config) {
    return NextResponse.json({ error: "Team Tailor not configured" }, { status: 400 });
  }

  const baseUrl =
    config.apiRegion === "us"
      ? "https://api.na.teamtailor.com"
      : "https://api.teamtailor.com";

  try {
    // Fetch up to 100 applicants with candidate data included
    const url = new URL(`${baseUrl}/v1/job-applications`);
    url.searchParams.set("filter[job]", id);
    url.searchParams.set("page[size]", "100");
    url.searchParams.set("include", "candidate");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Token token=${config.apiKey}`,
        "X-Api-Version": "20161108",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch applicants from Team Tailor" }, { status: 502 });
    }

    const data = await res.json();

    // Build a map of candidate id → candidate data from included
    const candidateMap = new Map<string, any>();
    for (const item of data.included ?? []) {
      if (item.type === "candidates") {
        candidateMap.set(item.id, item.attributes);
      }
    }

    // Get TT candidate IDs to resolve import status
    const ttIds = [...candidateMap.keys()];
    const existing = await prisma.candidate.findMany({
      where: { teamTailorId: { in: ttIds } },
      select: { teamTailorId: true, id: true },
    });
    const importedMap = new Map(existing.map((c) => [c.teamTailorId, c.id]));

    // Deduplicate by candidate id (a candidate may have multiple applications)
    const seen = new Set<string>();
    const candidates = [];
    for (const app of data.data ?? []) {
      const candidateId = app.relationships?.candidate?.data?.id;
      if (!candidateId || seen.has(candidateId)) continue;
      seen.add(candidateId);

      const attrs = candidateMap.get(candidateId);
      if (!attrs) continue;

      candidates.push({
        teamTailorId: candidateId,
        firstName: attrs["first-name"] ?? "",
        lastName: attrs["last-name"] ?? "",
        email: attrs.email ?? "",
        pictureUrl:
          typeof attrs.picture === "object" && attrs.picture?.standard
            ? attrs.picture.standard
            : null,
        resumeUrl: attrs["original-resume"] ?? attrs.resume ?? null,
        linkedinUrl: attrs["linkedin-url"] ?? "",
        tags: attrs.tags ?? [],
        pitch: attrs.pitch ?? "",
        imported: importedMap.has(candidateId),
        rosterId: importedMap.get(candidateId) ?? null,
      });
    }

    return NextResponse.json({
      candidates,
      total: candidates.length,
      totalInTT: data.meta?.["record-count"] ?? candidates.length,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch applicants from Team Tailor" }, { status: 502 });
  }
}
