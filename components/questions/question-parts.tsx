import Link from "next/link";
import { CircleCheck, Clock, Lock, type LucideIcon } from "lucide-react";

import { StatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { QuestionMessage, QuestionSummary } from "@/lib/data/questions";
import { QUESTION_STATUS_LABELS, type QuestionStatus } from "@/lib/questions/constants";

const STATUS: Record<QuestionStatus, { tone: "warning" | "success" | "neutral"; icon: LucideIcon }> = {
  awaiting_reply: { tone: "warning", icon: Clock },
  answered: { tone: "success", icon: CircleCheck },
  closed: { tone: "neutral", icon: Lock },
};

export function QuestionStatusPill({ status }: { status: QuestionStatus }) {
  return <StatusPill tone={STATUS[status].tone} icon={STATUS[status].icon} label={QUESTION_STATUS_LABELS[status]} />;
}

export function whenSent(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export function QuestionsTable({ rows, base, showPatient }: { rows: QuestionSummary[]; base: string; showPatient: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Subject</TableHead>
          {showPatient ? <TableHead>Patient</TableHead> : null}
          <TableHead>Asked</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((q) => (
          <TableRow key={q.id}>
            <TableCell>
              <Link href={`${base}/${q.id}`} className="text-content">
                {q.subject}
              </Link>
              {q.urgency === "important" ? <span className="type-small text-content-muted"> · Important</span> : null}
            </TableCell>
            {showPatient ? (
              <TableCell>
                {q.patientName}
                <span className="type-small text-content-muted"> · {q.clinicRef}</span>
              </TableCell>
            ) : null}
            <TableCell>{whenSent(q.createdAt)}</TableCell>
            <TableCell>
              <QuestionStatusPill status={q.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** The conversation, oldest first. The patient side is named as "You" in the portal. */
export function Conversation({ messages, viewer }: { messages: QuestionMessage[]; viewer: "clinic" | "portal" }) {
  return (
    <ol className="flex flex-col gap-4">
      {messages.map((m) => (
        <li
          key={m.id}
          className={m.fromClinic ? "border border-surface-border bg-surface-raised p-4" : "border border-surface-border bg-surface-sunken p-4"}
        >
          <div className="type-small mb-2 text-content-muted">
            {m.fromClinic ? `${m.authorName}, The Schoeman Clinic` : viewer === "portal" ? "You" : `${m.authorName} (patient side)`} · {whenSent(m.createdAt)}
          </div>
          <p className="type-body whitespace-pre-wrap">{m.body}</p>
        </li>
      ))}
    </ol>
  );
}
