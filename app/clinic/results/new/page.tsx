import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";

import { EntryForm } from "@/components/results/entry-form";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getEntryOptions, getImportForEntry } from "@/lib/data/results";

export const metadata: Metadata = { title: "Add results · The Schoeman Clinic" };

/** PAs and doctors only. The entry function checks again, in the database. */
export default async function NewResultsPage({ searchParams }: { searchParams: Promise<{ import?: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.some((role) => role === "pa" || role === "doctor")) redirect("/clinic");

  const { import: importParam } = await searchParams;
  const importId = z.uuid().safeParse(importParam);
  const [options, queued] = await Promise.all([getEntryOptions(), importId.success ? getImportForEntry(importId.data) : null]);
  if (importId.success && !queued) redirect("/clinic/results");

  return (
    <>
      <PageHeader
        eyebrow="Results"
        title="Add "
        accent="results"
        description="Enter each value from the lab's report. A doctor reviews them before the patient sees anything."
      />
      <EntryForm
        options={options}
        queued={queued ? { importId: queued.id, documentId: queued.documentId, title: queued.title, patientId: queued.patientId } : undefined}
      />
    </>
  );
}
