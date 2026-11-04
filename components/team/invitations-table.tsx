"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Clock, Minus, TriangleAlert } from "lucide-react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InvitationRow, InvitationStatus } from "@/lib/data/invitations";
import { formatDate } from "@/lib/format";
import {
  KIND_LABELS,
  RELATIONSHIP_LABELS,
  TEAM_ROLE_LABELS,
  type TeamRole,
} from "@/lib/invitations/constants";
import {
  cancelInvitation,
  resendInvitation,
  type InvitationFormState,
} from "@/lib/invitations/actions";

const initial: InvitationFormState = {};

const STATUS: Record<InvitationStatus, { label: string; tone: "info" | "success" | "warning" | "neutral"; icon: typeof Check }> = {
  pending: { label: "Pending", tone: "info", icon: Clock },
  accepted: { label: "Accepted", tone: "success", icon: Check },
  expired: { label: "Expired", tone: "warning", icon: TriangleAlert },
  cancelled: { label: "Cancelled", tone: "neutral", icon: Minus },
};

const FILTERS: { id: "all" | InvitationStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "accepted", label: "Accepted" },
  { id: "expired", label: "Expired" },
  { id: "cancelled", label: "Cancelled" },
];

function describe(row: InvitationRow): string {
  if (row.kind === "team") {
    const role = row.role && row.role !== "patient" ? TEAM_ROLE_LABELS[row.role as TeamRole] : "Team member";
    return row.jobTitle ? `${role} · ${row.jobTitle}` : role;
  }
  if (row.kind === "guardian") {
    const relation = row.relationship ? RELATIONSHIP_LABELS[row.relationship] : "Guardian";
    return `${relation} of ${row.patientName ?? "a patient"}${row.canAct ? " · can act" : ""}`;
  }
  return `${KIND_LABELS.patient}${row.patientName ? ` · ${row.patientName}` : ""}`;
}

function RowActions({ row }: { row: InvitationRow }) {
  const [resendState, resend, resending] = useActionState(resendInvitation, initial);
  const [cancelState, cancel, cancelling] = useActionState(cancelInvitation, initial);
  if (row.status === "accepted") return null;

  const state = resendState.error || resendState.saved ? resendState : cancelState;
  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex gap-1">
        <form action={resend}>
          <input type="hidden" name="id" value={row.id} />
          <Button type="submit" variant="ghost" size="sm" loading={resending}>
            Resend
          </Button>
        </form>
        {row.status === "pending" ? (
          <form action={cancel}>
            <input type="hidden" name="id" value={row.id} />
            <Button type="submit" variant="ghost" size="sm" loading={cancelling}>
              Cancel
            </Button>
          </form>
        ) : null}
      </div>
      <FormMessage state={state} />
    </div>
  );
}

export function InvitationsTable({ rows }: { rows: InvitationRow[] }) {
  const [filter, setFilter] = useState<"all" | InvitationStatus>("all");
  const counts = useMemo(() => {
    const result: Record<string, number> = { all: rows.length };
    for (const row of rows) result[row.status] = (result[row.status] ?? 0) + 1;
    return result;
  }, [rows]);
  const visible = filter === "all" ? rows : rows.filter((row) => row.status === filter);

  return (
    <div className="flex flex-col gap-5">
      <div role="group" aria-label="Filter invitations" className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={filter === item.id ? "primary" : "outline"}
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label} {counts[item.id] ?? 0}
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState>
          {rows.length === 0 ? "Invitations you send will appear here." : "No invitations with this status."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto border border-surface-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>For</TableHead>
                <TableHead>Invited by</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => {
                const status = STATUS[row.status];
                return (
                  <TableRow key={row.id}>
                    <TableCell className="break-all">{row.email}</TableCell>
                    <TableCell>{describe(row)}</TableCell>
                    <TableCell>{row.invitedBy}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(row.sentAt)}</TableCell>
                    <TableCell>
                      <StatusPill tone={status.tone} icon={status.icon} label={status.label} />
                      {row.status === "pending" ? (
                        <div className="type-small mt-1 text-content-muted">Until {formatDate(row.expiresAt)}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <RowActions row={row} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
