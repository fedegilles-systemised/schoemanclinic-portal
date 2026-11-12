import Link from "next/link";
import { Ban, CircleCheck, Clock, CreditCard, Send, X, type LucideIcon } from "lucide-react";

import { StatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RequestDetail, RequestSummary } from "@/lib/data/prescriptions";
import { formatDate } from "@/lib/format";
import { STAGE_LABELS, type RequestStage } from "@/lib/prescriptions/constants";

const STAGE: Record<RequestStage, { tone: "warning" | "success" | "neutral" | "info" | "danger"; icon: LucideIcon }> = {
  unpaid: { tone: "warning", icon: CreditCard },
  withdrawn: { tone: "neutral", icon: X },
  requested: { tone: "info", icon: Clock },
  approved: { tone: "success", icon: CircleCheck },
  sent_to_pharmacy: { tone: "success", icon: Send },
  declined: { tone: "danger", icon: Ban },
};

export function RequestStagePill({ stage }: { stage: RequestStage }) {
  return <StatusPill tone={STAGE[stage].tone} icon={STAGE[stage].icon} label={STAGE_LABELS[stage]} />;
}

export function RequestsTable({ rows, base, showPatient }: { rows: RequestSummary[]; base: string; showPatient: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Medicines</TableHead>
          {showPatient ? <TableHead>Patient</TableHead> : null}
          <TableHead>Requested</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <Link href={`${base}/${r.id}`} className="text-content">
                {r.firstItem}
              </Link>
              {r.itemCount > 1 ? <span className="type-small text-content-muted"> and {r.itemCount - 1} more</span> : null}
            </TableCell>
            {showPatient ? (
              <TableCell>
                {r.patientName}
                <span className="type-small text-content-muted"> · {r.clinicRef}</span>
              </TableCell>
            ) : null}
            <TableCell>{formatDate(r.requestedAt)}</TableCell>
            <TableCell>
              <RequestStagePill stage={r.stage} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const yes = (v: boolean | null) => (v === null ? "Not asked" : v ? "Yes" : "No");

/** The medicines and the answers given with them. */
export function RequestAnswers({ request }: { request: RequestDetail }) {
  const weightAsked = request.stillLosingWeight !== null || request.hasSideEffects !== null;
  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col divide-y divide-surface-border border border-surface-border">
        {request.items.map((item) => (
          <li key={item.id} className="type-body flex flex-wrap items-center justify-between gap-2 px-4 py-2">
            <span>
              {item.name}
              {item.source === "typed" ? <span className="type-small text-content-muted"> · typed in, not on the list</span> : null}
            </span>
            <span className="text-content-muted">{item.supplyMonths === 1 ? "1 month" : "2 months"}</span>
          </li>
        ))}
      </ul>
      <dl className="type-body grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
        <dt className="text-content-muted">Future appointment booked</dt>
        <dd>
          {yes(request.hasFutureAppointment)}
          {request.hasFutureAppointment === false && request.wantsAppointment ? ", would like to book one" : ""}
        </dd>
        {weightAsked ? (
          <>
            <dt className="text-content-muted">Still losing weight</dt>
            <dd>
              {yes(request.stillLosingWeight)}
              {request.weightLostLastMonth ? `, ${request.weightLostLastMonth} in the last month` : ""}
            </dd>
            <dt className="text-content-muted">Side effects</dt>
            <dd className="whitespace-pre-wrap">{request.hasSideEffects ? request.sideEffects : yes(request.hasSideEffects)}</dd>
          </>
        ) : null}
        {request.note ? (
          <>
            <dt className="text-content-muted">Note</dt>
            <dd className="whitespace-pre-wrap">{request.note}</dd>
          </>
        ) : null}
        <dt className="text-content-muted">Requested</dt>
        <dd>{formatDate(request.requestedAt)}</dd>
        <dt className="text-content-muted">Fee</dt>
        <dd>{request.paidAt ? `Paid on ${formatDate(request.paidAt)}` : "Not paid"}</dd>
      </dl>
    </div>
  );
}
