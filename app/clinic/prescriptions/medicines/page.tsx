import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AddListMedicineForm, ListMedicineToggle } from "@/components/prescriptions/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getCatalogue } from "@/lib/data/prescriptions";

export const metadata: Metadata = { title: "Medicine list · Clinic Hub" };

/** The medicines patients can choose when they request a repeat. Admins and doctors keep it. */
export default async function MedicineListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.roles.some((r) => r === "admin" || r === "doctor")) redirect("/clinic/prescriptions");
  const list = await getCatalogue({ includeArchived: true });
  const current = list.filter((m) => !m.archived);
  const removed = list.filter((m) => m.archived);

  return (
    <>
      <Link href="/clinic/prescriptions" className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        Prescriptions
      </Link>
      <PageHeader
        eyebrow="Prescriptions"
        title="The clinic's "
        accent="medicine list"
        description="Patients choose from this list, or from their own current medicines, when they request a repeat. Anything else they can type in."
      />
      <Card className="mb-12">
        <CardHeader>
          <CardTitle>Add a medicine</CardTitle>
          <CardDescription>A weight-loss medicine brings up the weight and side-effect questions.</CardDescription>
        </CardHeader>
        <CardContent>
          <AddListMedicineForm />
        </CardContent>
      </Card>
      <section aria-labelledby="on-list" className="mb-12 flex flex-col gap-4">
        <SectionHeader id="on-list" title="On the " accent="list" />
        <ul className="flex flex-col divide-y divide-surface-border border border-surface-border bg-surface-raised">
          {current.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-1">
              <span className="type-body">
                {m.name}
                {m.weightLoss ? <span className="type-small text-content-muted"> · weight loss</span> : null}
              </span>
              <ListMedicineToggle medicineId={m.id} name={m.name} archived={false} />
            </li>
          ))}
        </ul>
      </section>
      {removed.length > 0 ? (
        <section aria-labelledby="removed" className="flex flex-col gap-4">
          <SectionHeader id="removed" title="Taken " accent="off" />
          <ul className="flex flex-col divide-y divide-surface-border border border-surface-border bg-surface-raised">
            {removed.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-1">
                <span className="type-body text-content-muted">{m.name}</span>
                <ListMedicineToggle medicineId={m.id} name={m.name} archived />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
