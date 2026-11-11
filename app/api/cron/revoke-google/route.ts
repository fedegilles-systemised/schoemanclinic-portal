import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { revokeLeaverTokens } from "@/lib/calendar/leavers";

function sameValue(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Run daily by Vercel Cron (vercel.json), which sends "Bearer CRON_SECRET". Withdraws at Google the
 * calendar access of team members who were switched off. Without CRON_SECRET it does nothing.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return new NextResponse(null, { status: 404 });
  if (!sameValue(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) return new NextResponse(null, { status: 401 });
  try {
    const result = await revokeLeaverTokens();
    return NextResponse.json(result);
  } catch {
    console.error("Google revocation run failed.");
    return new NextResponse(null, { status: 500 });
  }
}
