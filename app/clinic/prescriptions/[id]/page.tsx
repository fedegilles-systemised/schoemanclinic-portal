import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { DecisionForm, RefundRepeatButton, WithdrawRequestButton } from "@/components/prescriptions/forms";
import { RequestAnswers, RequestStagePill } from "@/components/prescriptions/parts";
import { SignatureRxSection } from "@/components/prescriptions/signaturerx-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getRepeatRequest } from "@/lib/data/prescriptions";
import { getSignatureRxPanel } from "@/lib/data/signaturerx";
import { formatDate, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Repeat request · Clinic Hub" };

export default async function ClinicRepeatRequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ refunded?: string }> }) {
  const { id } = await params;
  const { refunded } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.roles.some((r) => r === "doctor" || r === "pa" || r === "admin")) redirect("/clinic");
  const request = await getRepeatRequest(id);
  if (!request) notFound();

  const supabase = await createClient();
  const directory = await supabase.rpc("get_staff_directory");
  const names = new Map((directory.data ?? []).map((p) => [p.profile_id, p.full_name]));
  const requestedBy = names.get(request.requestedBy) ?? "the patient side";
  const decidedBy = request.decidedBy ? names.get(request.decidedBy) : null;
  const open = request.stage === "requested" || request.stage === "approved" || request.stage === "unpaid";
  // Admins read requests; doctors and PAs move them on (admins write no clinical data).
  const canDecide = user.roles.some((r) => r === "doctor" || r === "pa");
  const panel = await getSignatureRxPanel(request.id, request.patientId);

  return (
    <>
      <Link href="/clinic/prescriptions" className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        All requests
      </Link>
      <PageHeader eyebrow="Repeat request" title={`${request.patientName} `} description={`${request.clinicRef}. Requested by ${requestedBy}.`}>
        <RequestStagePill stage={request.stage} />
      </PageHeader>
      <Link href={`/clinic/patients/${request.patientId}#medications`} className="type-button-label mb-6 inline-block text-content no-underline">
        Open their record
      </Link>

      <Card className="mb-6">
        <CardContent>
          <RequestAnswers request={request} />
        </CardContent>
      </Card>

      {request.decisionNote ? (
        <Card className="mb-6">
          <CardTitle>Note to the patient</CardTitle>
          <p className="type-body whitespace-pre-wrap">{request.decisionNote}</p>
          {decidedBy ? <p className="type-small text-content-muted">Last changed by {decidedBy}.</p> : null}
        </Card>
      ) : null}

      {refunded && user.isAdmin ? (
        <div className="mb-6">
          <Alert variant={refunded === "told" ? "success" : "warning"}>
            <AlertDescription>
              {refunded === "told"
                ? "Refunded, and the patient has been told."
                : refunded === "already"
                  ? "That fee was already refunded."
                  : "Refunded. The patient could not be told by email or WhatsApp, so please let them know."}
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      {request.refundedAt ? (
        <div className="mb-6">
          <Alert variant="info">
            <AlertDescription>The fee of {formatMoney(request.feePence)} was refunded on {formatDate(request.refundedAt)}.</AlertDescription>
          </Alert>
        </div>
      ) : request.status === "declined" && request.paidAt && user.isAdmin ? (
        <Card className="mb-6">
          <CardContent className="flex flex-col gap-3">
            <p className="type-body">This request was declined and its fee of {formatMoney(request.feePence)} was paid. An admin can refund it in full.</p>
            <RefundRepeatButton requestId={request.id} amount={formatMoney(request.feePence)} />
          </CardContent>
        </Card>
      ) : null}

      {open && canDecide ? (
        <Card className="mb-6">
          <CardContent>
            <DecisionForm requestId={request.id} status={request.status} paid={request.paidAt !== null} />
          </CardContent>
        </Card>
      ) : null}
      <SignatureRxSection
        requestId={request.id}
        itemNames={request.items.map((item) => item.name)}
        panel={panel}
        isDoctor={user.roles.includes("doctor")}
        canCheck={canDecide}
        canResolve={user.roles.includes("doctor") || user.isAdmin}
        approved={request.status === "approved" && request.cancelledAt === null}
        names={Object.fromEntries(names)}
      />
      {request.stage === "unpaid" && canDecide ? <WithdrawRequestButton requestId={request.id} byClinic /> : null}
    </>
  );
}
