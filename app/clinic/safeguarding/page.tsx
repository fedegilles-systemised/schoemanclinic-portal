import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { getSafeguardingAlerts } from "@/lib/data/patient-record";
import { formatDate } from "@/lib/format";
import { SEVERITY_LABELS } from "@/lib/record/constants";

export const metadata: Metadata = { title: "Safeguarding · The Schoeman Clinic" };

/** Active safeguarding alerts on every patient. Doctors, nurses, health coaches, PAs and admins read them. */
export default async function SafeguardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isStaff) redirect("/clinic");
  const alerts = (await getSafeguardingAlerts()).sort((a, b) => (a.reviewDue ?? "9999").localeCompare(b.reviewDue ?? "9999"));

  return (
    <>
      <PageHeader eyebrow="Clinical" title="Safeguarding " accent="alerts" description="Active alerts on every patient, soonest review first. Only the clinic team sees these. Doctors add and close them." />
      {alerts.length === 0 ? (
        <EmptyState>No active alerts.</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Concern</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Review by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Link href={`/clinic/patients/${a.patientId}#safeguarding`} className="text-content">
                    {a.patientName}
                  </Link>
                </TableCell>
                <TableCell>{a.alertType}</TableCell>
                <TableCell>
                  <StatusPill tone={a.severity === "high" ? "danger" : "warning"} icon={ShieldAlert} label={SEVERITY_LABELS[a.severity]} />
                </TableCell>
                <TableCell>{a.reviewDue ? formatDate(a.reviewDue) : "Not set"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
