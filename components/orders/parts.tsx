import Link from "next/link";
import { Ban, CircleCheck, Clock, CreditCard, FlaskConical, Syringe, type LucideIcon } from "lucide-react";

import { StatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OrderSummary } from "@/lib/data/orders";
import { formatDate, formatMoney } from "@/lib/format";
import { ORDER_STATUS_LABELS, ROUTE_LABELS, type OrderStatus } from "@/lib/orders/constants";

const STATUS: Record<OrderStatus, { tone: "warning" | "success" | "neutral" | "info" | "danger"; icon: LucideIcon }> = {
  sent_to_patient: { tone: "warning", icon: CreditCard },
  paid: { tone: "info", icon: Clock },
  sample_taken: { tone: "info", icon: Syringe },
  results_in: { tone: "success", icon: FlaskConical },
  reviewed: { tone: "success", icon: CircleCheck },
  cancelled: { tone: "neutral", icon: Ban },
};

export function OrderStatusPill({ status, refunded = false }: { status: OrderStatus; refunded?: boolean }) {
  return <StatusPill tone={STATUS[status].tone} icon={STATUS[status].icon} label={refunded ? "Refunded" : ORDER_STATUS_LABELS[status]} />;
}

export function OrdersTable({ rows, base, showPatient }: { rows: OrderSummary[]; base?: string; showPatient: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          {showPatient ? <TableHead>Patient</TableHead> : null}
          <TableHead>How</TableHead>
          <TableHead>Due by</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              {base ? (
                <Link href={`${base}/${r.id}`} className="text-content">
                  {r.panelName}
                </Link>
              ) : (
                r.panelName
              )}
              <span className="type-small text-content-muted"> · {r.orderRef}</span>
            </TableCell>
            {showPatient ? (
              <TableCell>
                <Link href={`/clinic/patients/${r.patientId}`} className="text-content">
                  {r.patientName}
                </Link>
                <span className="type-small text-content-muted"> · {r.clinicRef}</span>
              </TableCell>
            ) : null}
            <TableCell>{r.route ? ROUTE_LABELS[r.route] : "Not recorded"}</TableCell>
            <TableCell>{r.dueBy ? formatDate(r.dueBy) : "No date"}</TableCell>
            <TableCell>{formatMoney(r.pricePence)}</TableCell>
            <TableCell>
              <OrderStatusPill status={r.status} refunded={Boolean(r.refundedAt)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
