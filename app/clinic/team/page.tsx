import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { InvitationsTable } from "@/components/team/invitations-table";
import { InviteSheet } from "@/components/team/invite-sheet";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getInvitations, getPatientOptions } from "@/lib/data/invitations";
import { INVITATION_DAYS, kindsFor } from "@/lib/invitations/constants";

export const metadata: Metadata = { title: "Team and settings · The Schoeman Clinic" };

/** For PAs and admins. The database also decides which invitations each of them reads. */
export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const kinds = kindsFor(user.roles);
  if (user.isSuspended || kinds.length === 0) redirect("/clinic");

  const patients = await getPatientOptions();
  const rows = await getInvitations(patients);

  return (
    <>
      <PageHeader
        eyebrow="Team and settings"
        title="Team "
        accent="invitations"
        description={`Invite patients, guardians and colleagues. Each link works for ${INVITATION_DAYS} days.`}
      >
        <InviteSheet kinds={kinds} patients={patients} />
      </PageHeader>
      <InvitationsTable rows={rows} />
    </>
  );
}
