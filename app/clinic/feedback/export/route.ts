import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { listAnsweredFeedback } from "@/lib/data/feedback";
import { RATING_LABELS } from "@/lib/feedback/constants";
import { londonDate } from "@/lib/format";

/** One CSV cell. A leading =, +, - or @ is neutralised so a spreadsheet never runs it as a formula. */
function cell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/**
 * Feedback as a CSV, read through the signed-in person's own access. "evidence": positive answers
 * the patient agreed may be used, with no name or reference, for the CQC. "all": every answer
 * with the clinic reference, rating and follow-up, for the clinic's own log.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.some((r) => r === "admin" || r === "pa" || r === "doctor")) {
    return new NextResponse(null, { status: 404 });
  }
  const set = new URL(request.url).searchParams.get("set") === "all" ? "all" : "evidence";
  const rows = await listAnsweredFeedback({ limit: 5000 });

  const lines =
    set === "evidence"
      ? [
          ["Date", "Score (0 to 10)", "What went well", "What could be better"].map(cell).join(","),
          ...rows
            .filter((r) => r.rating === "green" && r.mayQuote)
            .map((r) => [r.answeredAt ? londonDate(new Date(r.answeredAt)) : "", r.score, r.wentWell, r.couldImprove].map(cell).join(",")),
        ]
      : [
          ["Date", "Clinic reference", "Score (0 to 10)", "Rating", "Asked to be contacted", "May be quoted", "What went well", "What could be better", "Follow up by", "Followed up on", "Follow-up"].map(cell).join(","),
          ...rows.map((r) =>
            [
              r.answeredAt ? londonDate(new Date(r.answeredAt)) : "",
              r.clinicRef,
              r.score,
              r.rating ? RATING_LABELS[r.rating] : "",
              r.wantsContact ? "Yes" : "No",
              r.mayQuote ? "Yes" : "No",
              r.wentWell,
              r.couldImprove,
              r.followUpDue,
              r.followUp ? londonDate(new Date(r.followUp.at)) : "",
              r.followUp?.note,
            ]
              .map(cell)
              .join(","),
          ),
        ];

  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="feedback-${set}-${londonDate()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
