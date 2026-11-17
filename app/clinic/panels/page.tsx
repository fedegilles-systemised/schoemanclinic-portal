import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PanelForm, RouteFeeForm } from "@/components/orders/forms";
import { PanelImportForm } from "@/components/orders/panel-import";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getRouteFees, listLabPartners, listPanels } from "@/lib/data/orders";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Panels and fees · Clinic Hub" };

/** Admins keep the catalogue of panels and the fee for each way of taking the sample. */
export default async function PanelsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.roles.includes("admin")) redirect("/clinic");
  const [panels, fees, labs] = await Promise.all([listPanels(), getRouteFees(), listLabPartners()]);

  return (
    <>
      <Link href="/clinic/orders" className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        Lab orders
      </Link>
      <PageHeader
        eyebrow="Blood tests"
        title="Panels and "
        accent="fees"
        description="The panels a doctor or PA can order, what each costs, and the fee added for each way of taking the sample. A new price applies to new orders only."
      />

      <section aria-labelledby="fees" className="mb-12 flex flex-col gap-4">
        <SectionHeader id="fees" title="Sample " accent="fees" />
        {fees.map((fee) => (
          <RouteFeeForm key={fee.route} fee={fee} />
        ))}
      </section>

      <section aria-labelledby="panels" className="mb-12 flex flex-col gap-4">
        <SectionHeader id="panels" title="The " accent="panels" />
        {panels.map((panel) => (
          <Card key={panel.id}>
            <CardHeader>
              <CardTitle>
                {panel.code} · {panel.name}
              </CardTitle>
              <p className="type-small text-content-muted">
                {panel.labName} · {formatMoney(panel.pricePence)}
                {panel.active ? "" : " · not orderable"}
              </p>
            </CardHeader>
            <CardContent>
              <PanelForm panel={panel} />
            </CardContent>
          </Card>
        ))}
      </section>

      <section aria-labelledby="import" className="mb-12 flex flex-col gap-4">
        <SectionHeader id="import" title="Import from a " accent="spreadsheet" />
        <PanelImportForm labs={labs} />
      </section>

      <section aria-labelledby="add" className="flex flex-col gap-4">
        <SectionHeader id="add" title="Add a " accent="panel" />
        <PanelForm labs={labs} />
      </section>
    </>
  );
}
