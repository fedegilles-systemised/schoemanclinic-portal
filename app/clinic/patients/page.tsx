import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AddToCareTeamDialog, RemoveFromCareTeamButton } from "@/components/patients/care-team-forms";
import { RELATIONSHIP_LABELS } from "@/lib/patients/care-team-labels";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { getPatientList } from "@/lib/data/patients";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Patients · The Schoeman Clinic" };

/**
 * Every patient, and who looks after them. The whole team sees everyone (the clinic's decision of
 * 27 November 2026). PAs, admins and doctors keep the care team up to date here.
 */
export default async function PatientsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isStaff) redirect("/clinic");

  const { patients, staff } = await getPatientList();
  const canEdit = user.roles.some((role) => role === "pa" || role === "admin" || role === "doctor");

  return (
    <>
      <PageHeader
        eyebrow="Patients"
        title="Patient "
        accent="list"
        description="Every patient, and who looks after them."
      />
      {patients.length === 0 ? (
        <EmptyState>No patients yet.</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Date of birth</TableHead>
              <TableHead>Care team</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.map((patient) => (
              <TableRow key={patient.id}>
                <TableCell>
                  <Link href={`/clinic/patients/${patient.id}`} className="text-content underline underline-offset-2">
                    {patient.name}
                  </Link>
                  <div className="type-small text-content-muted">{patient.clinicRef}</div>
                </TableCell>
                <TableCell className="tabular-nums">{formatDate(patient.dateOfBirth)}</TableCell>
                <TableCell>
                  <ul className="flex flex-col gap-1">
                    {patient.careTeam.length === 0 ? (
                      <li className="type-small text-content-muted">Nobody yet</li>
                    ) : (
                      patient.careTeam.map((member) => (
                        <li key={member.id} className="flex items-center gap-2">
                          <span>
                            {member.name}
                            <span className="type-small text-content-muted"> · {RELATIONSHIP_LABELS[member.relationship]}</span>
                          </span>
                          {canEdit ? <RemoveFromCareTeamButton careTeamId={member.id} label={member.name} /> : null}
                        </li>
                      ))
                    )}
                    {canEdit ? (
                      <li>
                        <AddToCareTeamDialog patientId={patient.id} patientName={patient.name} staff={staff} />
                      </li>
                    ) : null}
                  </ul>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
