import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { sendFeedbackSurveys } from "@/lib/feedback/send";
import { sendRunOutReminders } from "@/lib/prescriptions/reminders";

function sameValue(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Run daily by Vercel Cron (vercel.json), which sends "Bearer CRON_SECRET". Sends the day's patient
 * messages: reminders three weeks before a prescription runs out, and feedback surveys after
 * appointments. One job does both, to stay within the plan's number of cron jobs; a failure in one
 * does not stop the other. Without CRON_SECRET it does nothing.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return new NextResponse(null, { status: 404 });
  if (!sameValue(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) return new NextResponse(null, { status: 401 });

  const [reminders, feedback] = await Promise.allSettled([sendRunOutReminders(), sendFeedbackSurveys()]);
  if (reminders.status === "rejected") console.error("Prescription reminder run failed.");
  if (feedback.status === "rejected") console.error("Feedback survey run failed.");
  const body = {
    reminders: reminders.status === "fulfilled" ? reminders.value : null,
    feedback: feedback.status === "fulfilled" ? feedback.value : null,
  };
  return NextResponse.json(body, { status: reminders.status === "rejected" || feedback.status === "rejected" ? 500 : 200 });
}
