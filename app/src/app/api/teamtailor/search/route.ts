import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) {
    return NextResponse.json({ candidates: [] });
  }

  const config = await prisma.teamTailorConfig.findFirst();
  if (!config) {
    return NextResponse.json({ error: "Team Tailor not configured" }, { status: 400 });
  }

  const baseUrl =
    config.apiRegion === "us"
      ? "https://api.na.teamtailor.com"
      : "https://api.teamtailor.com";

  let ttData: any;
  try {
    const url = new URL(`${baseUrl}/v1/candidates`);
    url.searchParams.set("filter[query]", q);
    url.searchParams.set("page[size]", "20");
    const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Token token=${config.apiKey}`,
          "X-Api-Version": "20161108",
        },
      }
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: "Couldn't reach Team Tailor. Check your API key has Candidates scope." },
        { status: 502 }
      );
    }
    ttData = await res.json();
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach Team Tailor. Check your API key has Candidates scope." },
      { status: 502 }
    );
  }

  // Resolve imported status for matched candidates
  const ttIds = (ttData.data ?? []).slice(0, 20).map((c: any) => c.id);
  const existing = await prisma.candidate.findMany({
    where: { teamTailorId: { in: ttIds } },
    select: { teamTailorId: true, id: true },
  });
  const importedMap = new Map(existing.map((c) => [c.teamTailorId, c.id]));

  const candidates = (ttData.data ?? []).map((c: any) => ({
    teamTailorId: c.id,
    firstName: c.attributes["first-name"] ?? "",
    lastName: c.attributes["last-name"] ?? "",
    email: c.attributes.email ?? "",
    pictureUrl:
      typeof c.attributes.picture === "object" && c.attributes.picture?.standard
        ? c.attributes.picture.standard
        : null,
    resumeUrl: c.attributes["original-resume"] ?? c.attributes.resume ?? null,
    linkedinUrl: c.attributes["linkedin-url"] ?? "",
    tags: c.attributes.tags ?? [],
    pitch: c.attributes.pitch ?? "",
    imported: importedMap.has(c.id),
    rosterId: importedMap.get(c.id) ?? null,
  }));

  return NextResponse.json({ candidates });
}
