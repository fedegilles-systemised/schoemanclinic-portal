import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { remindUncheckedOnlineBookings } from "@/lib/booking/unchecked";
import { sendFeedbackSurveys } from "@/lib/feedback/send";
import { purgeLabFiles } from "@/lib/labs/retention";
import { chaseUnpaidOrders } from "@/lib/orders/chase";
import { sendRunOutReminders } from "@/lib/prescriptions/reminders";
import { syncWearables } from "@/lib/wearables/sync";

// A daily run can read many wearables; Vercel allows up to a minute on this plan.
export const maxDuration = 60;

function sameValue(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Run daily by Vercel Cron (vercel.json), which sends "Bearer CRON_SECRET". Sends the day's patient
 * messages: reminders three weeks before a prescription runs out, and feedback surveys after
 * appointments. The same job also keeps lab files to their retention period (lib/labs/retention.ts) and reads
 * each patient's linked wearables (lib/wearables/sync.ts), reminds patients about blood test orders they have not paid
 * for and closes those left for 30 days (lib/orders/chase.ts), and reminds the team of online bookings nobody has checked
 * (lib/booking/unchecked.ts).
 * One job does all of it, to stay within the plan's number of cron jobs; a failure in one does not stop
 * the others. Without CRON_SECRET it does nothing.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return new NextResponse(null, { status: 404 });
  if (!sameValue(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) return new NextResponse(null, { status: 401 });

  const [reminders, feedback, labs, wearables, orders, online] = await Promise.allSettled([sendRunOutReminders(), sendFeedbackSurveys(), purgeLabFiles(), syncWearables(), chaseUnpaidOrders(), remindUncheckedOnlineBookings()]);
  if (reminders.status === "rejected") console.error("Prescription reminder run failed.");
  if (feedback.status === "rejected") console.error("Feedback survey run failed.");
  if (labs.status === "rejected") console.error("Lab file retention run failed.");
  if (wearables.status === "rejected") console.error("Wearable sync run failed.");
  if (orders.status === "rejected") console.error("Unpaid order run failed.");
  if (online.status === "rejected") console.error("Online booking reminder run failed.");
  const body = {
    reminders: reminders.status === "fulfilled" ? reminders.value : null,
    feedback: feedback.status === "fulfilled" ? feedback.value : null,
    labs: labs.status === "fulfilled" ? labs.value : null,
    wearables: wearables.status === "fulfilled" ? wearables.value : null,
    orders: orders.status === "fulfilled" ? orders.value : null,
    online: online.status === "fulfilled" ? online.value : null,
  };
  const failed = reminders.status === "rejected" || feedback.status === "rejected" || labs.status === "rejected" || (labs.status === "fulfilled" && labs.value.failed > 0) || wearables.status === "rejected" || orders.status === "rejected" || online.status === "rejected";
  return NextResponse.json(body, { status: failed ? 500 : 200 });
}
