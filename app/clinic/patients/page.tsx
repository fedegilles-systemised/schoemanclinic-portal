import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AddToCareTeamDialog, RELATIONSHIP_LABELS, RemoveFromCareTeamButton } from "@/components/patients/care-team-forms";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { getPatientList } from "@/lib/data/patients";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Patients · The Schoeman Clinic" };

/**
 * Every patient this person may see, and who looks after them. PAs and admins see everyone;
 * doctors, nurses and health coaches see the patients whose care team they are on. PAs, admins
 * and doctors keep the care team up to date here.
 */
export default async function PatientsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isStaff) redirect("/clinic");

  const { patients, staff } = await getPatientList();
  const canEdit = user.roles.some((role) => role === "pa" || role === "admin" || role === "doctor");
  const seesEveryone = user.roles.some((role) => role === "pa" || role === "admin");

  return (
    <>
      <PageHeader
        eyebrow="Patients"
        title="Patient "
        accent="list"
        description={
          seesEveryone
            ? "Every patient, and who looks after them. Doctors, nurses and health coaches see only the patients whose care team they are on."
            : "The patients whose care team you are on."
        }
      />
      {patients.length === 0 ? (
        <EmptyState>
          {seesEveryone ? "No patients yet." : "You are not on any patient's care team yet. A PA or admin adds you."}
        </EmptyState>
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
                  <div className="text-content">{patient.name}</div>
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
