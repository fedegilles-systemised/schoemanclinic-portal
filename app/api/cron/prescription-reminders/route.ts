import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { sendRunOutReminders } from "@/lib/prescriptions/reminders";

function sameValue(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Run daily by Vercel Cron (vercel.json), which sends "Bearer CRON_SECRET". Reminds patients three
 * weeks before a prescription runs out. Without CRON_SECRET it does nothing.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return new NextResponse(null, { status: 404 });
  if (!sameValue(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) return new NextResponse(null, { status: 401 });
  try {
    const result = await sendRunOutReminders();
    return NextResponse.json(result);
  } catch {
    console.error("Prescription reminder run failed.");
    return new NextResponse(null, { status: 500 });
  }
}
