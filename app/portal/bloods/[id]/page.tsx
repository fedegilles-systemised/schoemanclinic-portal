import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { Barcode } from "@/components/orders/barcode";
import { OrderStatusPill } from "@/components/orders/parts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { OrderSteps } from "@/components/ui/order-steps";
import { PageHeader } from "@/components/ui/page-header";
import { getPortalPatientId } from "@/lib/data/education";
import { getOrder } from "@/lib/data/orders";
import { isStripeConfigured } from "@/lib/env";
import { formatDate, formatMoney } from "@/lib/format";
import { payOrder } from "@/lib/orders/actions";
import { ROUTE_HELP, ROUTE_LABELS, type OrderStatus } from "@/lib/orders/constants";

export const metadata: Metadata = { title: "Blood test · The Schoeman Clinic" };

const STEPS = ["Ordered", "Paid", "Sample taken", "Results in"];
const DONE_THROUGH: Record<OrderStatus, number> = { sent_to_patient: 0, paid: 1, sample_taken: 2, results_in: 3, reviewed: 3, cancelled: -1 };

const BANNERS: Record<string, { variant: "success" | "info" | "warning"; text: string }> = {
  paid: { variant: "info", text: "Thank you. Your payment is being confirmed. Your barcode appears here as soon as it is." },
  cancelled: { variant: "warning", text: "Payment was not completed. Your order is saved: pay below when you are ready." },
  failed: { variant: "warning", text: "We could not open the payment page. Please try again in a moment." },
  busy: { variant: "warning", text: "Too many attempts at once. Please wait a while and try again." },
};

export default async function PortalOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; cancelled?: string; payment?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [patient, order, query] = await Promise.all([getPortalPatientId(), getOrder(id), searchParams]);
  // The portal shows the patient currently chosen in the portal, never another record the person can read.
  if (!patient || !order || order.patientId !== patient.id) notFound();

  const banner = query.paid ? BANNERS.paid : query.cancelled ? BANNERS.cancelled : query.payment === "failed" ? BANNERS.failed : query.payment === "busy" ? BANNERS.busy : null;
  const unpaid = order.status === "sent_to_patient";
  const cancelled = order.status === "cancelled";

  return (
    <>
      <Link href="/portal/bloods" className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        Lab orders
      </Link>
      <PageHeader eyebrow={order.orderRef} title="Your " accent="blood test">
        <OrderStatusPill status={order.status} />
      </PageHeader>

      {banner && !(query.paid && order.paidAt) ? (
        <div className="mb-6">
          <Alert variant={banner.variant}>
            <AlertDescription>{banner.text}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      {cancelled ? null : (
        <div className="mb-6">
          <OrderSteps steps={STEPS} doneThrough={DONE_THROUGH[order.status]} />
        </div>
      )}

      <Card className="mb-6">
        <CardTitle>{order.panelName}</CardTitle>
        <CardContent>
          <dl className="type-body grid gap-x-8 gap-y-2 sm:grid-cols-[auto_1fr]">
            {order.dueBy ? (
              <>
                <dt className="text-content-muted">Have your sample taken by</dt>
                <dd>{formatDate(order.dueBy)}</dd>
              </>
            ) : null}
            {order.route ? (
              <>
                <dt className="text-content-muted">How</dt>
                <dd>
                  {ROUTE_LABELS[order.route]}. {ROUTE_HELP[order.route]}
                </dd>
              </>
            ) : null}
            <dt className="text-content-muted">Price</dt>
            <dd>
              {formatMoney(order.pricePence)}
              {order.feePence > 0 ? <span className="text-content-muted"> including {formatMoney(order.feePence)} for taking the sample</span> : null}
            </dd>
          </dl>
        </CardContent>
      </Card>

      {order.fasting || order.preparation ? (
        <Card className="mb-6">
          <CardTitle>How to prepare</CardTitle>
          <CardContent>
            {order.fasting ? <p className="type-body mb-2">You need to fast for this test.</p> : null}
            {order.preparation ? <p className="type-body whitespace-pre-wrap">{order.preparation}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {unpaid && patient.canAct ? (
        isStripeConfigured() ? (
          <form action={payOrder}>
            <input type="hidden" name="orderId" value={order.id} />
            <Button type="submit">Pay {formatMoney(order.pricePence)}</Button>
          </form>
        ) : (
          <Alert variant="info">
            <AlertDescription>Online payment is not switched on yet. The clinic will contact you about payment.</AlertDescription>
          </Alert>
        )
      ) : null}

      {order.barcode && !cancelled ? (
        <Card>
          <CardTitle>Your barcode</CardTitle>
          <CardContent>
            <p className="type-body mb-4">
              {order.route === "tdl_kit"
                ? "The clinic will arrange your home kit. Keep this barcode: it identifies your sample."
                : "Show this barcode at the collection point. It tells the lab which tests to run."}
            </p>
            <Barcode value={order.barcode} />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
