import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FormList } from "@/components/forms/form-list";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getPortalPatientId } from "@/lib/data/education";
import { listForms } from "@/lib/data/forms";

export const metadata: Metadata = { title: "Your forms · The Schoeman Clinic" };

/** Every form submitted for the portal patient, as a permanent record of what was asked and said. */
export default async function PortalFormsPage() {
  const patient = await getPortalPatientId();
  if (!patient) redirect("/portal");
  const forms = await listForms(patient.id);
  return (
    <>
      <PageHeader
        eyebrow="Forms"
        title="Your "
        accent="forms"
        description="Every form sent to the clinic, with the questions and your answers. They are kept with your record and cannot be changed."
      />
      {forms.length === 0 ? <EmptyState>No forms yet.</EmptyState> : <FormList forms={forms} />}
    </>
  );
}
