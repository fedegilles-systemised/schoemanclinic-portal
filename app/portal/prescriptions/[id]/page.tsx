import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { WithdrawRequestButton } from "@/components/prescriptions/forms";
import { RequestAnswers, RequestStagePill } from "@/components/prescriptions/parts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getPortalPatientId } from "@/lib/data/education";
import { getRepeatRequest } from "@/lib/data/prescriptions";
import { isStripeConfigured } from "@/lib/env";
import { formatMoney } from "@/lib/format";
import { payRepeat } from "@/lib/prescriptions/actions";

export const metadata: Metadata = { title: "Repeat request · The Schoeman Clinic" };

const BANNERS: Record<string, { variant: "success" | "info" | "warning"; text: string }> = {
  paid: { variant: "success", text: "Thank you. Your payment is being confirmed, and your request will then go to the clinic." },
  sent: { variant: "info", text: "Your request has been sent. Online payment is not switched on yet, so the clinic will contact you about the fee." },
  cancelled: { variant: "warning", text: "Payment was not completed. Your request is saved: pay below when you are ready, or withdraw it." },
  failed: { variant: "warning", text: "We could not open the payment page. Please try again in a moment." },
  busy: { variant: "warning", text: "Too many attempts at once. Please wait a while and try again." },
};

export default async function RepeatRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; sent?: string; cancelled?: string; payment?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [patient, request, query] = await Promise.all([getPortalPatientId(), getRepeatRequest(id), searchParams]);
  // The portal shows the patient currently chosen in the portal, never another record the person can read.
  if (!patient || !request || request.patientId !== patient.id) notFound();

  const banner = query.paid ? BANNERS.paid : query.sent ? BANNERS.sent : query.cancelled ? BANNERS.cancelled : query.payment === "failed" ? BANNERS.failed : query.payment === "busy" ? BANNERS.busy : null;
  const unpaid = request.stage === "unpaid";

  return (
    <>
      <Link href="/portal/prescriptions" className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        Prescriptions
      </Link>
      <PageHeader eyebrow="Repeat request" title="Your " accent="request">
        <RequestStagePill stage={request.stage} />
      </PageHeader>

      {banner && !(query.paid && request.paidAt) ? (
        <div className="mb-6">
          <Alert variant={banner.variant}>
            <AlertDescription>{banner.text}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      {request.decisionNote && request.stage !== "unpaid" ? (
        <Card className="mb-6">
          <CardTitle>From the clinic</CardTitle>
          <p className="type-body whitespace-pre-wrap">{request.decisionNote}</p>
        </Card>
      ) : null}

      <Card className="mb-6">
        <CardContent>
          <RequestAnswers request={request} />
        </CardContent>
      </Card>

      {unpaid && patient.canAct ? (
        <div className="flex flex-col gap-4">
          {isStripeConfigured() ? (
            <form action={payRepeat}>
              <input type="hidden" name="requestId" value={request.id} />
              <Button type="submit">Pay {formatMoney(request.feePence)}</Button>
            </form>
          ) : null}
          <WithdrawRequestButton requestId={request.id} />
        </div>
      ) : null}
    </>
  );
}
