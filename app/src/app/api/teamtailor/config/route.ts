import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await prisma.teamTailorConfig.findFirst();
  if (!config) {
    return NextResponse.json({ configured: false });
  }

  return NextResponse.json({
    configured: true,
    maskedKey: config.apiKey.slice(0, 4) + "••••••••" + config.apiKey.slice(-4),
    region: config.apiRegion,
    lastSyncAt: config.lastSyncAt,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { apiKey, apiRegion } = await req.json();

  if (!apiKey || apiKey.includes("••")) {
    // Update region only if key is masked
    const existing = await prisma.teamTailorConfig.findFirst();
    if (existing) {
      await prisma.teamTailorConfig.update({
        where: { id: existing.id },
        data: { apiRegion: apiRegion || "eu" },
      });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  // Validate the API key by making a test request
  const baseUrl = apiRegion === "us" ? "https://api.na.teamtailor.com" : "https://api.teamtailor.com";
  try {
    const testRes = await fetch(`${baseUrl}/v1/jobs?page%5Bsize%5D=1`, {
      headers: {
        Authorization: `Token token=${apiKey}`,
        "X-Api-Version": "20161108",
      },
    });
    if (!testRes.ok) {
      return NextResponse.json({ error: "Invalid API key or insufficient permissions" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Could not connect to Team Tailor API" }, { status: 500 });
  }

  // Upsert config
  const existing = await prisma.teamTailorConfig.findFirst();
  if (existing) {
    await prisma.teamTailorConfig.update({
      where: { id: existing.id },
      data: { apiKey, apiRegion: apiRegion || "eu" },
    });
  } else {
    await prisma.teamTailorConfig.create({
      data: { apiKey, apiRegion: apiRegion || "eu" },
    });
  }

  return NextResponse.json({ success: true });
}
