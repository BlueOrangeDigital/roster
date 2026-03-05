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

  try {
    const url = new URL(`${baseUrl}/v1/jobs`);
    url.searchParams.set("page[size]", "30");
    url.searchParams.set("fields[jobs]", "title,human-status,internal-name");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Token token=${config.apiKey}`,
        "X-Api-Version": "20161108",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch jobs from Team Tailor" }, { status: 502 });
    }

    const data = await res.json();
    const jobs = (data.data ?? []).map((j: any) => ({
      id: j.id,
      title: j.attributes["title"] ?? j.attributes["internal-name"] ?? "Untitled",
      status: j.attributes["human-status"] ?? "unknown",
    }));

    return NextResponse.json({ jobs });
  } catch {
    return NextResponse.json({ error: "Failed to fetch jobs from Team Tailor" }, { status: 502 });
  }
}
